import { cashfreeConfig, cashfreeSignature, database, markOrderPaid, releaseOrderReservation } from '@/lib/shop';

export const dynamic='force-dynamic';

export async function POST(req:Request){
 try{
  const cfg=cashfreeConfig();
  if(!cfg.enabled)return Response.json({error:'Payment gateway is not configured.'},{status:503});
  const body=await req.text();
  const timestamp=req.headers.get('x-webhook-timestamp')||'';
  const supplied=req.headers.get('x-webhook-signature')||'';
  const expected=await cashfreeSignature(body,timestamp,cfg.secret);
  if(!timestamp||!supplied||expected!==supplied)return Response.json({error:'Invalid webhook signature.'},{status:401});
  const payload=JSON.parse(body);
  const gatewayOrderId=String(payload?.data?.order?.order_id||'');
  if(!gatewayOrderId)return Response.json({ok:true});
  const db=database();
  const order=await db.prepare('SELECT * FROM orders WHERE gateway_order_id=?').bind(gatewayOrderId).first<any>();
  if(!order)return Response.json({ok:true});
  const type=String(payload?.type||'');
  const paymentStatus=String(payload?.data?.payment?.payment_status||'');
  const amount=Math.round(Number(payload?.data?.order?.order_amount||0)*100);
  if((type==='PAYMENT_SUCCESS_WEBHOOK'||paymentStatus==='SUCCESS')&&amount===order.total){
   await markOrderPaid(order.id,String(payload?.data?.payment?.cf_payment_id||''));
  }else if(type==='PAYMENT_FAILED_WEBHOOK'||type==='PAYMENT_USER_DROPPED_WEBHOOK'||paymentStatus==='FAILED'||paymentStatus==='USER_DROPPED'){
   await releaseOrderReservation(order,paymentStatus==='USER_DROPPED'?'Cancelled':'Failed');
  }
  return Response.json({ok:true});
 }catch(error){
  console.error('Cashfree webhook failed',error);
  return Response.json({error:'Webhook processing failed.'},{status:400});
 }
}
