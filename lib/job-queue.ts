// Durable at-least-once queue. Handlers must be idempotent, including after lease expiry.
export async function enqueue(db:D1Database,id:string,kind:string,payload:unknown){
 const now=Date.now();await db.prepare("INSERT INTO jobs(id,kind,payload,state,available,created,updated) VALUES(?,?,?,'pending',?,?,?) ON CONFLICT(id) DO NOTHING").bind(id,kind,JSON.stringify(payload),now,now,now).run();
}
export async function runOne(db:D1Database,handler:(kind:string,payload:any)=>Promise<void>,now=Date.now()){
 const token=crypto.randomUUID();
 const job=await db.prepare("UPDATE jobs SET state='running',attempts=attempts+1,lease_token=?,lease_until=?,updated=? WHERE id=(SELECT id FROM jobs WHERE (state='pending' AND available<=?) OR (state='running' AND lease_until<=?) ORDER BY available LIMIT 1) AND (SELECT count(*) FROM jobs WHERE state='running' AND lease_until>?)<4 RETURNING *").bind(token,now+90000,now,now,now,now).first<any>();
 if(!job)return false;
 try{
  if(job.attempts>6)throw Error('Retry limit exceeded');
  await handler(job.kind,JSON.parse(job.payload));
  await db.prepare("UPDATE jobs SET state='done',lease_token=NULL,lease_until=0,last_error=NULL,updated=? WHERE id=? AND lease_token=?").bind(Date.now(),job.id,token).run();
 }catch{
  const delay=Math.min(3600000,15000*2**Math.min(job.attempts,8));
  // Never retain provider payloads or credentials in error text.
  await db.prepare("UPDATE jobs SET state=?,available=?,lease_token=NULL,lease_until=0,last_error='Processing failed; retry or inspect provider dashboard',updated=? WHERE id=? AND lease_token=?").bind(job.attempts>=6?'dead':'pending',Date.now()+delay,Date.now(),job.id,token).run();
  console.error(JSON.stringify({event:'job_failed',jobId:job.id,kind:job.kind,attempt:job.attempts}));
 }
 return true;
}
