import {z} from 'zod';
export class CustomerError extends Error{constructor(message:string,public status=400){super(message)}}
export const addressDetails=z.object({name:z.string().trim().min(2).max(100),email:z.string().trim().email().max(150),phone:z.string().regex(/^[+0-9 ()-]{8,20}$/),address:z.string().trim().min(10).max(500),city:z.string().trim().min(2).max(80),pin:z.string().regex(/^[0-9]{6}$/)});
export async function customerData(db:D1Database,userId:string){
 const [addresses,wishlist,reviews,returns,orders]=await Promise.all([
 db.prepare('SELECT id,label,details FROM addresses WHERE user_id=? ORDER BY updated DESC').bind(userId).all<any>(),
 db.prepare('SELECT w.product_id AS id,p.name,p.price,p.image,p.stock,p.active FROM wishlist w LEFT JOIN products p ON p.id=w.product_id WHERE w.user_id=? ORDER BY w.created DESC LIMIT 100').bind(userId).all(),
 db.prepare('SELECT id,order_id,product_id,rating,name,title,body,status FROM reviews WHERE user_id=? ORDER BY updated DESC LIMIT 100').bind(userId).all(),
 db.prepare('SELECT id,order_id,reason,details,status,reply,created,updated FROM returns WHERE user_id=? ORDER BY created DESC LIMIT 100').bind(userId).all(),
 db.prepare('SELECT o.id,o.status,o.payment_status,o.items,o.total,o.created FROM orders o JOIN order_owners own ON own.order_id=o.id WHERE own.user_id=? ORDER BY o.created DESC LIMIT 100').bind(userId).all<any>()]);
 return {addresses:addresses.results.map(a=>({...a,details:JSON.parse(a.details)})),wishlist:wishlist.results,reviews:reviews.results,returns:returns.results,orders:orders.results.map(o=>({...o,items:JSON.parse(o.items)}))};
}
export async function customerAction(db:D1Database,userId:string,session:string|null,raw:unknown){
 const b=z.record(z.unknown()).parse(raw);const now=Date.now();
 if(b.action==='address'){
  const a=z.object({id:z.string().uuid().optional(),label:z.string().trim().min(1).max(40),details:addressDetails}).parse(b);const id=a.id||crypto.randomUUID();
  const result=await db.prepare('INSERT INTO addresses(id,user_id,label,details,updated) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM addresses WHERE user_id=?)<5 OR EXISTS(SELECT 1 FROM addresses WHERE id=? AND user_id=?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,details=excluded.details,updated=excluded.updated WHERE addresses.user_id=excluded.user_id').bind(id,userId,a.label,JSON.stringify(a.details),now,userId,id,userId).run();
  if(!result.meta.changes)throw new CustomerError('Address could not be saved. You can keep up to five addresses.',409);return;
 }
 if(b.action==='delete-address'){const id=z.string().uuid().parse(b.id);await db.prepare('DELETE FROM addresses WHERE id=? AND user_id=?').bind(id,userId).run();return;}
 if(b.action==='wishlist'){
  const p=z.string().min(1).max(80).parse(b.productId);const saved=z.boolean().parse(b.saved);const id=userId+':'+p;
  if(!saved){await db.prepare('DELETE FROM wishlist WHERE id=? AND user_id=?').bind(id,userId).run();return;}
  const result=await db.prepare('INSERT INTO wishlist(id,user_id,product_id,created) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM products WHERE id=? AND active=1) AND ((SELECT count(*) FROM wishlist WHERE user_id=?)<100 OR EXISTS(SELECT 1 FROM wishlist WHERE id=?)) ON CONFLICT(id) DO NOTHING').bind(id,userId,p,now,p,userId,id).run();
  if(!result.meta.changes&&!await db.prepare('SELECT id FROM wishlist WHERE id=?').bind(id).first())throw new CustomerError('This piece is unavailable, or your wishlist is full.',409);return;
 }
 if(b.action==='link-orders'){
  if(!session)throw new CustomerError('No orders from this browser to link.');
  await db.prepare('INSERT INTO order_owners(order_id,user_id) SELECT o.id,? FROM orders o WHERE o.session=? AND NOT EXISTS(SELECT 1 FROM order_owners own WHERE own.order_id=o.id) ON CONFLICT(order_id) DO NOTHING').bind(userId,session).run();return;
 }
 if(b.action==='review'){
  const r=z.object({orderId:z.string().uuid(),productId:z.string().min(1).max(80),rating:z.number().int().min(1).max(5),name:z.string().trim().min(2).max(40),title:z.string().trim().min(3).max(100),body:z.string().trim().min(10).max(1500)}).parse(b);
  const id=r.orderId+':'+r.productId;
  const result=await db.prepare("INSERT INTO reviews(id,user_id,order_id,product_id,rating,name,title,body,status,created,updated) SELECT ?,?,?,?,?,?,?,?,'Pending',?,? FROM orders o JOIN order_owners own ON own.order_id=o.id WHERE o.id=? AND own.user_id=? AND o.status='Delivered' AND (o.payment_method='cod' OR o.payment_status='Paid') AND EXISTS(SELECT 1 FROM json_each(o.items) item WHERE json_extract(item.value,'$.id')=?) ON CONFLICT(id) DO UPDATE SET rating=excluded.rating,name=excluded.name,title=excluded.title,body=excluded.body,status='Pending',updated=excluded.updated WHERE reviews.user_id=excluded.user_id").bind(id,userId,r.orderId,r.productId,r.rating,r.name,r.title,r.body,now,now,r.orderId,userId,r.productId).run();
  if(!result.meta.changes)throw new CustomerError('Reviews are available only for your delivered purchases.',403);return;
 }
 if(b.action==='return'){
  const r=z.object({orderId:z.string().uuid(),reason:z.enum(['Arrived damaged','Wrong item','Not as described','Other']),details:z.string().trim().min(10).max(2000)}).parse(b);
  const result=await db.prepare("INSERT INTO returns(id,order_id,user_id,reason,details,status,created,updated) SELECT ?,o.id,?,?,?,'Requested',?,? FROM orders o JOIN order_owners own ON own.order_id=o.id WHERE o.id=? AND own.user_id=? AND o.status='Delivered' AND (o.payment_method='cod' OR o.payment_status='Paid') ON CONFLICT(order_id) DO NOTHING").bind(crypto.randomUUID(),userId,r.reason,r.details,now,now,r.orderId,userId).run();
  if(!result.meta.changes)throw new CustomerError('A request already exists, or this order is not eligible for a delivered-item return request.',409);return;
 }
 throw new CustomerError('Unknown action');
}
export async function moderate(db:D1Database,raw:unknown){
 const b=z.record(z.unknown()).parse(raw);
 if(b.action==='review-status'){
  const r=z.object({id:z.string().max(150),status:z.enum(['Published','Hidden'])}).parse(b);
  const result=await db.prepare('UPDATE reviews SET status=?,updated=? WHERE id=?').bind(r.status,Date.now(),r.id).run();if(!result.meta.changes)throw new CustomerError('Review not found',404);return;
 }
 if(b.action==='return-status'){
  const r=z.object({id:z.string().uuid(),status:z.enum(['Approved','Declined','Received','Refund pending','Closed']),reply:z.string().trim().min(5).max(1000)}).parse(b);
  const previous=await db.prepare('SELECT status FROM returns WHERE id=?').bind(r.id).first<any>();if(!previous)throw new CustomerError('Request not found',404);
  const transitions:Record<string,string[]>={Requested:['Approved','Declined'],Approved:['Received'],Received:['Refund pending','Closed'],'Refund pending':['Closed'],Declined:[],Closed:[]};
  if(r.status!==previous.status&&!transitions[previous.status]?.includes(r.status))throw new CustomerError('That return status change is not allowed',409);
  const result=await db.prepare('UPDATE returns SET status=?,reply=?,updated=? WHERE id=? AND status=?').bind(r.status,r.reply,Date.now(),r.id,previous.status).run();if(!result.meta.changes)throw new CustomerError('Request changed. Reload and try again.',409);return;
 }
 throw new CustomerError('Unknown action');
}
