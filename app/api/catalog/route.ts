import {catalogResponse} from '@/lib/catalog';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return await catalogResponse(req)}catch{return Response.json({error:'The collection is temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store','Retry-After':'5'}})}}
