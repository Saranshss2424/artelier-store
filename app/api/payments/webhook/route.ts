import {runtime,database} from '@/lib/shop';
import {enqueue,kickJobs} from '@/lib/jobs';
import {boundedText,verifyHmac} from '@/lib/payment-security';
export async function POST(req:Request){
 const secret=runtime().RAZORPAY_WEBHOOK_SECRET;if(!secret)return Response.json({error:'Not configured'},{status:503});
 let raw:string;try{raw=await boundedText(req,100000)}catch{return Response.json({error:'Too large'},{status:413})}
 if(!await verifyHmac(raw,req.headers.get('x-razorpay-signature')||'',secret))return Response.json({error:'Invalid signature'},{status:400});
 let event:any;try{event=JSON.parse(raw)}catch{return Response.json({error:'Invalid event'},{status:400})}
 try{
  const capture=['payment.captured','order.paid'].includes(event.event);const refund=event.event==='refund.processed';
  if(capture||refund){
   const paymentId=capture?event.payload?.payment?.entity?.id:event.payload?.refund?.entity?.payment_id;
   if(typeof paymentId!=='string'||!/^pay_[a-zA-Z0-9]+$/.test(paymentId))return Response.json({error:'Missing payment'},{status:400});
   const kind=capture?'capture':'refund';
   // Refund events are distinct: an earlier partial refund must not suppress the final full refund.
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   await enqueue(database(),kind==='capture'?`razorpay:capture:${paymentId}`:`razorpay:refund:${digest}`,kind,{paymentId});
   kickJobs(true);
  }
  // Acknowledge only after durable insertion; duplicate events reuse their queue record.
  return Response.json({received:true});
 }catch{console.error('Webhook queue insertion failed');return Response.json({error:'Please retry delivery'},{status:503});}
}
