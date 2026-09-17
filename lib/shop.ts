import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export const runtime=()=>env as any;
export const database=()=>runtime().DB as D1Database;
export async function isAdmin(){const u=await getChatGPTUser();return !!u && !!runtime().ADMIN_EMAIL && u.email.toLowerCase()===String(runtime().ADMIN_EMAIL).toLowerCase();}
export async function limit(req:Request){const key=req.headers.get('cf-connecting-ip')||'unknown'; const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));const id=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('')+':'+Math.floor(Date.now()/60000);const r=await database().prepare('INSERT INTO limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(id,Date.now()+120000).first<any>();if(Math.random()<.02)await database().prepare('DELETE FROM limits WHERE expires < ?').bind(Date.now()).run(); if(r.count>60)throw new Error('Too many requests. Please wait a minute.');}

export function cashfreeConfig(){
 const mode:'production'|'sandbox'=String(runtime().CASHFREE_ENV||'sandbox').toLowerCase()==='production'?'production':'sandbox';
 const appId=String(runtime().CASHFREE_APP_ID||'').trim();
 const secret=String(runtime().CASHFREE_SECRET_KEY||'').trim();
 return {mode,appId,secret,enabled:!!appId&&!!secret};
}

export function cashfreeApiBase(mode:'sandbox'|'production'){
 return mode==='production'?'https://api.cashfree.com/pg':'https://sandbox.cashfree.com/pg';
}

export async function cashfreeApi(path:string,init:RequestInit={}){
 const cfg=cashfreeConfig();
 if(!cfg.enabled) throw new Error('Cashfree is not configured');
 const headers=new Headers(init.headers);
 headers.set('Content-Type','application/json');
 headers.set('x-api-version','2026-01-01');
 headers.set('x-client-id',cfg.appId);
 headers.set('x-client-secret',cfg.secret);
 return fetch(`${cashfreeApiBase(cfg.mode)}${path}`,{...init,headers});
}

export async function cashfreeSignature(body:string,timestamp:string,secret:string){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+body));
 return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function markOrderPaid(id:string,paymentId?:string){
 const db=database();const order=await db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first<any>();if(!order||order.payment_status==='Paid')return order;const items=JSON.parse(order.items||'[]');
 try{await db.batch([...items.map((i:any)=>db.prepare("UPDATE products SET stock=stock-? WHERE id=? AND EXISTS(SELECT 1 FROM orders WHERE id=? AND stock_released=1 AND payment_status<>'Paid')").bind(i.qty,i.id,id)),db.prepare("UPDATE orders SET payment_status='Paid',status='Confirmed',stock_released=0,gateway_payment_id=COALESCE(?,gateway_payment_id),paid_at=? WHERE id=? AND payment_status<>'Paid'").bind(paymentId||null,Date.now(),id)]);}catch(e){if(!String(e).includes('stock_nonnegative'))throw e;await db.prepare("UPDATE orders SET payment_status='Paid',status='Refund required',gateway_payment_id=COALESCE(?,gateway_payment_id),paid_at=? WHERE id=? AND payment_status<>'Paid'").bind(paymentId||null,Date.now(),id).run();}
 return db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first<any>();
}
export async function releaseOrderReservation(order:any,paymentStatus='Failed'){
 const db=database();const items=JSON.parse(order.items||'[]');await db.batch([db.prepare("UPDATE orders SET payment_status='Releasing' WHERE id=? AND stock_released=0 AND payment_status='Awaiting'").bind(order.id),...items.map((i:any)=>db.prepare("UPDATE products SET stock=stock+? WHERE id=? AND EXISTS(SELECT 1 FROM orders WHERE id=? AND payment_status='Releasing' AND stock_released=0)").bind(i.qty,i.id,order.id)),db.prepare("UPDATE orders SET stock_released=1,payment_status=? WHERE id=? AND payment_status='Releasing'").bind(paymentStatus,order.id)]);
}

export async function releaseExpiredReservations(){
 const db=database();
 const cutoff=Date.now()-30*60*1000;
 const rows=(await db.prepare("SELECT * FROM orders WHERE payment_status='Awaiting' AND stock_released=0 AND created<? ORDER BY created LIMIT 50").bind(cutoff).all()).results||[];
 for(const order of rows)await releaseOrderReservation(order,'Expired');
}
