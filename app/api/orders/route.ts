import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database,limit} from '@/lib/shop';
import {sessionId} from '@/lib/payments';
import {trackingOrders} from '@/lib/tracking';
import {boundedText} from '@/lib/payment-security';
import {kickJobs} from '@/lib/jobs';
import {z} from 'zod';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',...(status===429?{'Retry-After':'60'}:{})}});
export async function GET(req:Request){try{await limit(req,'tracking-read',120);const raw=new URL(req.url).searchParams.get('before');const before=raw?z.coerce.number().int().positive().parse(raw):Date.now()+1;kickJobs();return reply(await trackingOrders(database(),sessionId(req),undefined,before,(await getChatGPTUser())?.userId||null));}catch(e){return reply({error:'Could not load orders. Please try again shortly.'},String(e).includes('Too many requests')?429:503)}}
export async function POST(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid origin'},403);
 await limit(req,'tracking-lookup',10);
 const lookup=z.object({id:z.string().uuid(),email:z.string().trim().email().max(150)}).parse(JSON.parse(await boundedText(req,2000)));
 const result=await trackingOrders(database(),null,lookup);
 return result.orders.length?reply(result):reply({error:'No matching order. Check the full reference and checkout email.'},404);
 }catch(e){return reply({error:'Check your details or wait a minute before trying again.'},String(e).includes('Too many requests')?429:400)}}
