import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database,limit} from '@/lib/shop';
import {sellerAction,sellerData} from '@/lib/sellers';
import {boundedText} from '@/lib/payment-security';
import {invalidateCatalog} from '@/lib/catalog';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){const u=await getChatGPTUser();if(!u)return reply({error:'Sign in required'},401);return reply(await sellerData(database(),u.userId));}
export async function POST(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid origin'},403);const u=await getChatGPTUser();if(!u)return reply({error:'Sign in required'},401);try{await limit(req,'seller',20);await sellerAction(database(),u,JSON.parse(await boundedText(req,7000)));await invalidateCatalog(req);return reply({ok:true});}catch(e){return reply({error:e instanceof Error?e.message:'Could not save'},400)}}
