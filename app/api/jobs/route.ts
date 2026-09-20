import {database,isAdmin,runtime} from '@/lib/shop';
import {drainJobs,enqueue} from '@/lib/jobs';
import {boundedText} from '@/lib/payment-security';
import {z} from 'zod';
export const dynamic='force-dynamic';
async function allowed(req:Request){const secret=runtime().JOB_RUNNER_SECRET;if(secret&&req.headers.get('authorization')===`Bearer ${secret}`)return true;return req.headers.get('origin')===new URL(req.url).origin&&await isAdmin();}
export async function POST(req:Request){
 if(!await allowed(req))return Response.json({error:'Owner or scheduler access required'},{status:403});
 try{
  const raw=await boundedText(req,2000);const body=raw?JSON.parse(raw):{};
  if(body.retry){const id=z.string().max(200).parse(body.retry);await database().prepare("UPDATE jobs SET state='pending',attempts=0,available=?,last_error=NULL WHERE id=? AND state='dead'").bind(Date.now(),id).run();}
  await enqueue(database(),'maintenance:'+Math.floor(Date.now()/60000),'maintenance',{});
  return Response.json(await drainJobs(),{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Job processing unavailable'},{status:503});}
}
