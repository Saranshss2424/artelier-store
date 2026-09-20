import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database,limit} from '@/lib/shop';
import {sessionId} from '@/lib/payments';
import {customerData,customerAction,CustomerError} from '@/lib/customer';
import {boundedText} from '@/lib/payment-security';
import {z} from 'zod';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store',...(status===429?{'Retry-After':'60'}:{})}});
function failure(e:unknown){return reply({error:e instanceof CustomerError?e.message:e instanceof z.ZodError?'Please check the details you entered.':String(e).includes('Too many requests')?'Too many requests. Please wait a minute.':'Your account is temporarily unavailable.'},e instanceof CustomerError?e.status:e instanceof z.ZodError?400:String(e).includes('Too many requests')?429:503)}
export async function GET(req:Request){try{const u=await getChatGPTUser();if(!u)return reply({user:null});await limit(req,'account-read',90);return reply({user:{name:u.fullName||'Art lover',email:u.email},...await customerData(database(),u.userId)});}catch(e){return failure(e)}}
export async function POST(req:Request){try{if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid origin'},403);const u=await getChatGPTUser();if(!u)return reply({error:'Please sign in to your account.'},401);await limit(req,'account-write',30);await customerAction(database(),u.userId,sessionId(req),JSON.parse(await boundedText(req,10000)));return reply({ok:true});}catch(e){return failure(e)}}
