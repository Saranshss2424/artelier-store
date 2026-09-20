import {database} from './shop';
// Cache public catalog data only. Checkout always reads authoritative stock/prices.
export async function catalogResponse(request:Request){
 const key=new Request(new URL('/api/catalog',request.url).toString());
 const cache=typeof caches!=='undefined'?(caches as any).default as Cache|undefined:undefined;
 try{const hit=await cache?.match(key);if(hit){const out=new Response(hit.body,hit);out.headers.set('X-Catalog-Cache','HIT');out.headers.set('Cache-Control','public, max-age=0, s-maxage=15');return out;}}catch{console.warn('Catalog cache unavailable');}
 const products=(await database().prepare(`SELECT id,name,category,description,price,stock,image,(SELECT avg(rating) FROM reviews WHERE product_id=products.id AND status='Published') AS rating,(SELECT count(*) FROM reviews WHERE product_id=products.id AND status='Published') AS reviewCount FROM products WHERE active=1 ORDER BY created DESC LIMIT 200`).all()).results;
 const response=Response.json({products},{headers:{'Cache-Control':'public, max-age=0, s-maxage=15','X-Catalog-Cache':'MISS'}});
 try{const stored=response.clone();stored.headers.set('Cache-Control','public, max-age=15');await cache?.put(key,stored);}catch{console.warn('Catalog cache write unavailable');}
 return response;
}
export async function invalidateCatalog(request:Request){try{await (caches as any).default?.delete(new Request(new URL('/api/catalog',request.url).toString()));}catch{/* Other edges expire within 15 seconds. */}}
