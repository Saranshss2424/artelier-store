import {database,limit,runtime} from '@/lib/shop';
import {boundedText,verifyHmac} from '@/lib/payment-security';
import {createCheckout,confirmPayment,onlineReady,sessionId,gateway} from '@/lib/payments';
import {z} from 'zod';
export const dynamic='force-dynamic';
const response=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){try{if(req.headers.get('origin')!==new URL(req.url).origin)return response({error:'Invalid origin'},403);const session=sessionId(req);if(!session)return response({error:'Please reload the shop before checking out.'},401);if(!onlineReady())return response({error:'Online payments are not activated yet.'},503);await limit(req);const b=z.record(z.unknown()).parse(JSON.parse(await boundedText(req)));if(b.action==='create')return response(await createCheckout(b,session));
const id=z.string().uuid().parse(b.id);const a=await database().prepare('SELECT * FROM payment_attempts WHERE id=? AND session=?').bind(id,session).first<any>();if(!a)return response({error:'Checkout not found'},404);
if(b.action==='verify'){const payment=z.string().regex(/^pay_[a-zA-Z0-9]+$/).parse(b.razorpay_payment_id);const signature=z.string().parse(b.razorpay_signature);if(b.razorpay_order_id!==a.provider_order||!await verifyHmac(a.provider_order+'|'+payment,signature,runtime().RAZORPAY_KEY_SECRET))return response({error:'Payment verification failed'},400);return response(await confirmPayment(payment));}
if(b.action==='status'){if(a.state==='paid'||a.state==='refund_required')return response({id:a.id,state:a.state,total:a.total});const payments=await gateway('orders/'+a.provider_order+'/payments');const captured=payments.items?.find((p:any)=>p.status==='captured');if(captured)return response(await confirmPayment(captured.id));return response({id:a.id,state:a.state});}return response({error:'Unknown action'},400);
}catch(e){console.error('Payment request failed',e instanceof Error?e.message:'error');return response({error:e instanceof z.ZodError?'Please check your delivery details.':e instanceof Error?e.message:'Could not complete checkout'},400);}}
