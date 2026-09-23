import {database,isAdmin,limit} from '@/lib/shop';
import {reviewSeller} from '@/lib/sellers';
import {invalidateCatalog} from '@/lib/catalog';
import {boundedText} from '@/lib/payment-security';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){if(!await isAdmin())return reply({error:'Owner access required'},403);return reply({sellers:(await database().prepare('SELECT * FROM sellers ORDER BY updated DESC LIMIT 100').all()).results,artists:(await database().prepare('SELECT id,name FROM artists ORDER BY name').all()).results});}
export async function POST(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin||!await isAdmin())return reply({error:'Owner access required'},403);try{await limit(req,'seller-review',30);await reviewSeller(database(),JSON.parse(await boundedText(req,3000)));await invalidateCatalog(req);return reply({ok:true});}catch(e){return reply({error:e instanceof Error?e.message:'Could not update seller'},400)}}
