import {database,limit} from '@/lib/shop';
import {z} from 'zod';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 await limit(req,'product-read',120);const id=z.string().min(1).max(80).parse(new URL(req.url).searchParams.get('id'));const db=database();
 const product=await db.prepare('SELECT id,name,category,description,price,stock,image FROM products WHERE id=? AND active=1').bind(id).first<any>();if(!product)return Response.json({error:'This piece is not currently listed.'},{status:404,headers:{'Cache-Control':'no-store'}});
 const [reviews,rating,related]=await Promise.all([
 db.prepare("SELECT name,rating,title,body,created FROM reviews WHERE product_id=? AND status='Published' ORDER BY created DESC LIMIT 30").bind(id).all(),
 db.prepare("SELECT count(*) AS count,COALESCE(avg(rating),0) AS average FROM reviews WHERE product_id=? AND status='Published'").bind(id).first(),
 db.prepare('SELECT id,name,price,image,stock FROM products WHERE category=? AND active=1 AND id<>? ORDER BY stock>0 DESC,created DESC LIMIT 4').bind(product.category,id).all()]);
 return Response.json({product,reviews:reviews.results,rating,related:related.results},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:'This piece is temporarily unavailable. Please try again.'},{status:String(e).includes('Too many requests')?429:503,headers:{'Cache-Control':'no-store'}})}}
