import {invalidateCatalog} from '@/lib/catalog';
import {database,isAdmin,limit} from '@/lib/shop';
import {moderate,CustomerError} from '@/lib/customer';
import {boundedText} from '@/lib/payment-security';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){if(!await isAdmin())return reply({error:'Owner access required'},403);try{const db=database();const [reviews,returns,metrics]=await Promise.all([
 db.prepare("SELECT r.*,p.name AS product_name FROM reviews r LEFT JOIN products p ON p.id=r.product_id ORDER BY CASE r.status WHEN 'Pending' THEN 0 ELSE 1 END,r.updated DESC LIMIT 100").all(),
 db.prepare("SELECT r.*,o.total AS order_total FROM returns r JOIN orders o ON o.id=r.order_id ORDER BY CASE WHEN r.status IN ('Closed','Declined') THEN 1 ELSE 0 END,r.updated DESC LIMIT 100").all(),
 db.prepare("SELECT (SELECT COALESCE(sum(total),0) FROM orders WHERE payment_status='Paid' AND status<>'Refund required') AS paid_total,(SELECT count(*) FROM orders WHERE status IN ('Pending','Confirmed')) AS to_fulfill,(SELECT count(*) FROM products WHERE active=1 AND stock<=3) AS low_stock,(SELECT count(*) FROM returns WHERE status NOT IN ('Closed','Declined')) AS open_returns").first()]);return reply({reviews:reviews.results,returns:returns.results,metrics});}catch{return reply({error:'Could not load studio activity.'},503)}}
export async function POST(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin||!await isAdmin())return reply({error:'Owner access required'},403);try{await limit(req,'moderation',60);await moderate(database(),JSON.parse(await boundedText(req,5000)));await invalidateCatalog(req);return reply({ok:true});}catch(e){return reply({error:e instanceof CustomerError?e.message:'Could not save this change. Check the details and try again.'},e instanceof CustomerError?e.status:400)}}
