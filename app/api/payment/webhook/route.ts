import {cashfreeConfig,cashfreeSignature,database} from '@/lib/shop';
import {boundedText} from '@/lib/payment-security';
import {enqueue,kickJobs} from '@/lib/jobs';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const cfg=cashfreeConfig();if(!cfg.enabled)return Response.json({error:'Not configured'},{status:503});
 let raw:string;try{raw=await boundedText(req,100000)}catch{return Response.json({error:'Too large'},{status:413})}
 const timestamp=req.headers.get('x-webhook-timestamp')||'',supplied=req.headers.get('x-webhook-signature')||'';
 const expected=await cashfreeSignature(raw,timestamp,cfg.secret);
 let difference=expected.length^supplied.length;for(let i=0;i<expected.length;i++)difference|=expected.charCodeAt(i)^(supplied.charCodeAt(i)||0);
 if(!timestamp||difference)return Response.json({error:'Invalid signature'},{status:401});
 let event:any;try{event=JSON.parse(raw)}catch{return Response.json({error:'Invalid event'},{status:400})}
 const p=event?.data?.payment,order=event?.data?.order;
 if(!['SUCCESS','FAILED','USER_DROPPED'].includes(p?.payment_status))return Response.json({received:true});
 if(typeof order?.order_id!=='string'||order.order_id.length>150)return Response.json({error:'Invalid order'},{status:400});
 try{
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  await enqueue(database(),'cashfree:'+digest,'cashfree',{orderId:order.order_id,paymentId:String(p.cf_payment_id||''),status:p.payment_status,amount:Math.round(Number(order.order_amount)*100)});
  kickJobs(true);return Response.json({received:true});
 }catch{console.error('Cashfree queue insertion failed');return Response.json({error:'Please retry delivery'},{status:503});}
}
