import {scheduleIntegrations,sendOrderEmail,syncShipment} from './integrations';
import {after} from 'next/server';
import {database,releaseExpiredReservations,markOrderPaid,releaseOrderReservation} from './shop';
import {confirmPayment,reconcileRefund,expireReservations} from './payments';
import {enqueue,runOne} from './job-queue';
export {enqueue};
export async function handleJob(kind:string,p:any){
 if(kind==='email'){await sendOrderEmail(p.id);return;}
 if(kind==='courier'){await syncShipment(p.id);return;}
 if(kind==='capture'){await confirmPayment(p.paymentId);return;}
 if(kind==='refund'){await reconcileRefund(p.paymentId);return;}
 if(kind==='cashfree'){
  const order=await database().prepare('SELECT * FROM orders WHERE gateway_order_id=?').bind(p.orderId).first<any>();
  if(!order)throw Error('Order missing');
  if(p.status==='SUCCESS'){if(p.amount!==order.total)throw Error('Amount mismatch');await markOrderPaid(order.id,p.paymentId);}
  else if(['FAILED','USER_DROPPED'].includes(p.status))await releaseOrderReservation(order,p.status==='USER_DROPPED'?'Cancelled':'Failed');
  return;
 }
 if(kind==='maintenance'){await expireReservations();await releaseExpiredReservations();await scheduleIntegrations();return;}
 throw Error('Unknown job type');
}
export async function drainJobs(){
 const db=database();const started=Date.now();let processed=0;
 // Bounded work fits the post-response lifetime; interrupted jobs recover by lease.
 while(processed<2&&Date.now()-started<10000){if(!await runOne(db,handleJob))break;processed++;}
 return {processed};
}
let lastKick=0;
export function kickJobs(force=false){
 if(!force&&Date.now()-lastKick<30000)return;lastKick=Date.now();
 after(async()=>{try{
  await enqueue(database(),'maintenance:'+Math.floor(Date.now()/60000),'maintenance',{});
  await drainJobs();
  // Bounded retention cleanup, with dead letters retained for the owner.
  await database().prepare("DELETE FROM jobs WHERE id IN (SELECT id FROM jobs WHERE state='done' AND updated<? LIMIT 100)").bind(Date.now()-7*86400000).run();
 }catch{console.error('Background job runner unavailable');}});
}
