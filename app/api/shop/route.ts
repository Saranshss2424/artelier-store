import { database, isAdmin, runtime, limit, cashfreeApi, cashfreeConfig, markOrderPaid, releaseExpiredReservations, releaseOrderReservation } from '@/lib/shop';
import { z } from 'zod';
import {onlineReady,expireReservations} from '@/lib/payments';
import {boundedText} from '@/lib/payment-security';

export const dynamic='force-dynamic';

const item=z.object({id:z.string().max(80),qty:z.number().int().min(1).max(99)});
const customer=z.object({name:z.string().trim().min(2).max(100),email:z.string().email().max(150),phone:z.string().regex(/^[+0-9 ()-]{8,20}$/),address:z.string().trim().min(10).max(500),city:z.string().trim().min(2).max(80),pin:z.string().regex(/^[0-9]{6}$/)});
const product=z.object({id:z.string().max(80).optional(),name:z.string().trim().min(2).max(120),category:z.enum(['Original art','Art prints','Ceramics','Handmade']),description:z.string().trim().min(5).max(3000),price:z.number().int().min(100).max(100000000),stock:z.number().int().min(0).max(100000),image:z.string().regex(/^\/api\/image\?id=[a-zA-Z0-9-]+$/),active:z.number().int().min(0).max(1)});

class ShopError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}

function session(r:Request){return r.headers.get('cookie')?.match(/(?:^|; )art_cart=([a-f0-9-]{36})(?:;|$)/)?.[1]||crypto.randomUUID();}
function reply(data:any,s:string,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','Set-Cookie':`art_cart=${s}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`}});}
function jsonBody(raw:string){try{return z.record(z.unknown()).parse(JSON.parse(raw));}catch{throw new ShopError('Please send a valid request.',400);}}

async function productLines(items:Array<{id:string;qty:number}>){
 const db=database();
 const lines:any[]=[];
 for(const i of items){
  const p=await db.prepare('SELECT id,name,price,stock FROM products WHERE id=? AND active=1').bind(i.id).first<any>();
  if(!p)throw new ShopError('An item in your bag is no longer available.',409);
  if(p.stock<i.qty)throw new ShopError('An item is no longer available in this quantity. Please update your bag.',409);
  lines.push({id:p.id,name:p.name,price:p.price,qty:i.qty});
 }
 return {lines,total:lines.reduce((n,p)=>n+p.price*p.qty,0)};
}

async function reserveOrder(orderId:string,s:string,customerData:any,items:Array<{id:string;qty:number}>,paymentMethod:'cod'|'online'){
 const db=database();
 const {lines,total}=await productLines(items);
 const gatewayOrderId=paymentMethod==='online'?`art_${orderId.replaceAll('-','')}`:null;
 await db.batch([
  ...lines.map(p=>db.prepare('UPDATE products SET stock=stock-? WHERE id=?').bind(p.qty,p.id)),
  db.prepare('INSERT INTO orders(id,session,customer,items,total,status,payment_method,payment_status,gateway_order_id,stock_released,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(orderId,s,JSON.stringify(customerData),JSON.stringify(lines),total,'Pending',paymentMethod,paymentMethod==='online'?'Awaiting':'Unpaid',gatewayOrderId,0,Date.now()),
  db.prepare('DELETE FROM carts WHERE id=?').bind(s),
 ]);
 return {lines,total,gatewayOrderId};
}

async function fetchCashfreeOrder(gatewayOrderId:string){
 const r=await cashfreeApi(`/orders/${encodeURIComponent(gatewayOrderId)}`,{method:'GET',headers:{Accept:'application/json'}});
 const raw=await r.text();
 let data:any={};try{data=JSON.parse(raw);}catch{}
 if(!r.ok)throw new Error(`Cashfree order lookup failed: ${r.status}`);
 return data;
}

function publicOrder(order:any){
 return {id:order.id,total:order.total,status:order.status,payment_method:order.payment_method,payment_status:order.payment_status,created:order.created};
}

export async function GET(req:Request){
 const s=session(req);
 try{
  await releaseExpiredReservations();await expireReservations();
  const db=database();
  const params=new URL(req.url).searchParams;
  if(params.get('studio')){
   if(!await isAdmin())return reply({error:'Studio access needs your approved owner email. Sign in with the owner account after setup.'},s,403);
   return reply({products:(await db.prepare('SELECT * FROM products ORDER BY created DESC LIMIT 200').all()).results,orders:(await db.prepare('SELECT orders.*,payment_attempts.state AS payment_state,payment_attempts.payment_id AS payment_id FROM orders LEFT JOIN payment_attempts ON orders.id=payment_attempts.id ORDER BY orders.created DESC LIMIT 100').all()).results,onlinePayments:cashfreeConfig().enabled,cod:runtime().ENABLE_COD==='true'},s);
  }
  const paymentId=params.get('payment');
  if(paymentId){
   const id=z.string().uuid().parse(paymentId);
   let order=await db.prepare('SELECT * FROM orders WHERE id=? AND session=?').bind(id,s).first<any>();
   if(!order)return reply({error:'Order not found.'},s,404);
   if(order.payment_method==='online'&&order.payment_status==='Awaiting'&&order.gateway_order_id&&cashfreeConfig().enabled){
    try{
     const remote=await fetchCashfreeOrder(order.gateway_order_id);
     if(remote.order_status==='PAID')order=await markOrderPaid(order.id);
     else if(remote.order_status==='EXPIRED'){await releaseOrderReservation(order,'Expired');order=await db.prepare('SELECT * FROM orders WHERE id=?').bind(order.id).first<any>();}
    }catch(error){console.error('Cashfree status lookup failed',error);}
   }
   return reply({order:publicOrder(order)},s);
  }
  const products=(await db.prepare('SELECT * FROM products WHERE active=1 ORDER BY created DESC LIMIT 200').all()).results;
  const cart=await db.prepare('SELECT items FROM carts WHERE id=?').bind(s).first<any>();
  const cfg=cashfreeConfig();
  const pendingCheckout=await db.prepare("SELECT id,state FROM payment_attempts WHERE session=? AND state IN ('pending','refund_required') ORDER BY created DESC LIMIT 1").bind(s).first();return reply({products,cart:cart?JSON.parse(cart.items):[],cod:runtime().ENABLE_COD==='true',online:onlineReady()||cfg.enabled,onlinePayments:cfg.enabled,paymentProvider:onlineReady()?'razorpay':cfg.enabled?'cashfree':'razorpay',cashfreeMode:cfg.mode,testPayments:onlineReady()?String(runtime().RAZORPAY_KEY_ID).startsWith('rzp_test_'):cfg.mode==='sandbox',pendingCheckout},s);
 }catch(e:any){
  console.error(e);
  return reply({error:e instanceof z.ZodError?'That payment reference is not valid.':e.message==='Too many requests. Please wait a minute.'?e.message:'The shop is temporarily unavailable. Please try again.'},s,e instanceof z.ZodError?400:503);
 }
}

export async function POST(req:Request){
 const s=session(req);
 try{
  if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid request origin.'},s,403);
  if(Number(req.headers.get('content-length')||0)>24000)return reply({error:'Request too large'},s,413);
  await limit(req);
  const raw=await boundedText(req);
  if(raw.length>24000)return reply({error:'Request too large'},s,413);
  const b=jsonBody(raw);
  const db=database();

  if(b.action==='cart'){
   const items=z.array(item).max(40).parse(b.items);
   if(new Set(items.map(i=>i.id)).size!==items.length)throw new ShopError('Duplicate items in your bag.');
   await db.prepare('INSERT INTO carts(id,items,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET items=excluded.items,updated=excluded.updated').bind(s,JSON.stringify(items),Date.now()).run();
   return reply({ok:true},s);
  }

  if(b.action==='order'){
   if(runtime().ENABLE_COD!=='true')throw new ShopError('Cash on delivery is not open yet. Your bag is saved.',409);
   const key=z.string().uuid().parse(b.key);if(await db.prepare('SELECT id FROM payment_attempts WHERE id=?').bind(key).first())throw new ShopError('An online checkout already uses this reference. Check its status first.',409);
   const existing=await db.prepare('SELECT * FROM orders WHERE id=? AND session=?').bind(key,s).first<any>();
   if(existing)return reply({order:publicOrder(existing)},s);
   const details=customer.parse(b.customer);
   const items=z.array(item).min(1).max(40).parse(b.items);
   const {total}=await reserveOrder(key,s,details,items,'cod');
   return reply({order:{id:key,total,payment_method:'cod',payment_status:'Unpaid'}},s,201);
  }

  if(b.action==='payment-init'){
   const cfg=cashfreeConfig();
   if(!cfg.enabled)throw new ShopError('Online payments are not connected yet. Add the Cashfree production keys in your site settings.',503);
   const key=z.string().uuid().parse(b.key);if(await db.prepare('SELECT id FROM payment_attempts WHERE id=?').bind(key).first())throw new ShopError('An online checkout already uses this reference. Check its status first.',409);
   const existing=await db.prepare('SELECT * FROM orders WHERE id=? AND session=?').bind(key,s).first<any>();
   if(existing?.payment_session_id)return reply({paymentSessionId:existing.payment_session_id,orderId:existing.id,total:existing.total/100,mode:cfg.mode},s);
   if(existing)throw new ShopError('This checkout attempt has expired. Refresh your bag and try again.',409);
   const details=customer.parse(b.customer);
   const items=z.array(item).min(1).max(40).parse(b.items);
   const {total,gatewayOrderId}=await reserveOrder(key,s,details,items,'online');
   const origin=new URL(req.url).origin;
   try{
    const r=await cashfreeApi('/orders',{method:'POST',headers:{'x-idempotency-key':key},body:JSON.stringify({order_id:gatewayOrderId,order_amount:total/100,order_currency:'INR',customer_details:{customer_id:s,customer_name:details.name,customer_email:details.email,customer_phone:details.phone.replace(/[^0-9]/g,'')},order_meta:{return_url:`${origin}/?payment=${encodeURIComponent(key)}`,notify_url:`${origin}/api/payment/webhook`},order_note:'Artelier artwork order',order_tags:{internal_order_id:key}})});
    const rawResponse=await r.text();
    let data:any={};try{data=JSON.parse(rawResponse);}catch{}
    if(!r.ok||!data.payment_session_id)throw new Error(`Cashfree order creation failed: ${r.status}`);
    await db.prepare('UPDATE orders SET gateway_order_id=?,payment_session_id=? WHERE id=? AND session=?').bind(data.order_id||gatewayOrderId,data.payment_session_id,key,s).run();
    return reply({paymentSessionId:data.payment_session_id,orderId:key,total:total/100,mode:cfg.mode},s,201);
   }catch(error){
    console.error('Cashfree order creation failed',error);
    const reserved=await db.prepare('SELECT * FROM orders WHERE id=? AND session=?').bind(key,s).first<any>();
    if(reserved)await releaseOrderReservation(reserved,'Failed');
    throw new ShopError('Online payment could not be started. Please try again.',502);
   }
  }

  if(!await isAdmin())return reply({error:'Owner access required.'},s,403);
  if(b.action==='product'){
   const p=product.parse(b.product);
   await db.prepare('INSERT INTO products(id,name,category,description,price,stock,image,active,created) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,description=excluded.description,price=excluded.price,stock=excluded.stock,image=excluded.image,active=excluded.active').bind(p.id||crypto.randomUUID(),p.name,p.category,p.description,p.price,p.stock,p.image,p.active,Date.now()).run();
   return reply({ok:true},s);
  }
  if(b.action==='status'){
   const status=z.enum(['Pending','Confirmed','Shipped','Delivered']).parse(b.status);
   const id=z.string().uuid().parse(b.id);
   await db.prepare("UPDATE orders SET status=? WHERE id=? AND status NOT IN ('Refund required','Refunded') AND (payment_method='cod' OR payment_status='Paid')").bind(status,id).run();
   return reply({ok:true},s);
  }
  return reply({error:'Unknown action'},s,400);
 }catch(e:any){
  console.error(e);
  const status=e instanceof ShopError?e.status:e instanceof z.ZodError?400:String(e).includes('stock_nonnegative')?409:String(e).includes('Too many requests')?429:400;
  const error=e instanceof z.ZodError?'Please check your details and quantities.':String(e).includes('stock_nonnegative')?'Stock changed while checking out. Please update your bag.':String(e).includes('Too many requests')?'Too many requests. Please wait a minute.':e.message||'Could not save. Please refresh and try again.';
  return reply({error},s,status);
 }
}
