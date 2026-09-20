export async function trackingOrders(db:D1Database,session:string|null,lookup?:{id:string;email:string},before=Date.now()+1,userId:string|null=null){
 const rows=lookup?await db.prepare("SELECT * FROM orders WHERE id=? AND lower(json_extract(customer,'$.email'))=?").bind(lookup.id,lookup.email.trim().toLowerCase()).all<any>():await db.prepare('SELECT o.* FROM orders o LEFT JOIN order_owners own ON own.order_id=o.id WHERE ((o.session=? AND own.order_id IS NULL) OR own.user_id=?) AND o.created<? ORDER BY o.created DESC LIMIT 21').bind(session||'',userId||'',before).all<any>();
 const selected=rows.results.slice(0,20);
 const orders=await Promise.all(selected.map(async o=>({id:o.id,status:o.status,paymentStatus:o.payment_status,total:o.total,created:o.created,items:JSON.parse(o.items).map((i:any)=>({name:i.name,qty:i.qty})),carrier:o.carrier,trackingNumber:o.tracking_number,trackingUrl:o.tracking_url,events:(await db.prepare('SELECT status,created FROM order_events WHERE order_id=? ORDER BY created,rowid').bind(o.id).all()).results})));
 return {orders,nextBefore:rows.results.length>20?selected.at(-1)?.created:null};
}
