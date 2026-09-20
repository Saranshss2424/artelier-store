export async function trackingOrders(db:D1Database,session:string|null,lookup?:{id:string;email:string},before=Date.now()+1){
 const rows=lookup?await db.prepare("SELECT * FROM orders WHERE id=? AND lower(json_extract(customer,'$.email'))=?").bind(lookup.id,lookup.email.trim().toLowerCase()).all<any>():session?await db.prepare('SELECT * FROM orders WHERE session=? AND created<? ORDER BY created DESC LIMIT 21').bind(session,before).all<any>():{results:[]};
 const selected=rows.results.slice(0,20);
 const orders=await Promise.all(selected.map(async o=>({id:o.id,status:o.status,paymentStatus:o.payment_status,total:o.total,created:o.created,items:JSON.parse(o.items).map((i:any)=>({name:i.name,qty:i.qty})),carrier:o.carrier,trackingNumber:o.tracking_number,trackingUrl:o.tracking_url,events:(await db.prepare('SELECT status,created FROM order_events WHERE order_id=? ORDER BY created,rowid').bind(o.id).all()).results})));
 return {orders,nextBefore:rows.results.length>20?selected.at(-1)?.created:null};
}
