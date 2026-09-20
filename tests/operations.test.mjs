import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import ts from 'typescript';
const sqlite=new DatabaseSync(':memory:');
for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+f,'utf8'));
const db={prepare(sql){let values=[];return {bind(...v){values=v;return this},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {results:sqlite.prepare(sql).all(...values)}},async run(){return sqlite.prepare(sql).run(...values)}}}};
mkdirSync('.sites-runtime',{recursive:true});
async function module(name,replace=s=>s){writeFileSync(`.sites-runtime/${name}-ops.mjs`,replace(ts.transpileModule(readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText));return import(`../.sites-runtime/${name}-ops.mjs`)}
const {enqueue,runOne}=await module('job-queue');
const {trackingOrders}=await module('tracking');
await enqueue(db,'a','capture',{paymentId:'pay_A'});await enqueue(db,'a','capture',{paymentId:'pay_A'});
assert.equal(sqlite.prepare('SELECT count(*) n FROM jobs').get().n,1);
let calls=0;await Promise.all(Array.from({length:10},()=>runOne(db,async()=>{calls++;await new Promise(r=>setTimeout(r,5))})));assert.equal(calls,1);assert.equal(sqlite.prepare('SELECT state FROM jobs').get().state,'done');
await enqueue(db,'bad','capture',{});await runOne(db,async()=>{throw Error('test')});assert.equal(sqlite.prepare("SELECT state FROM jobs WHERE id='bad'").get().state,'pending');assert.equal(await runOne(db,async()=>{}),false);
for(let i=0;i<5;i++){sqlite.prepare("UPDATE jobs SET available=0 WHERE id='bad'").run();await runOne(db,async()=>{throw Error('test')});}
assert.equal(sqlite.prepare("SELECT state FROM jobs WHERE id='bad'").get().state,'dead');
await enqueue(db,'crashed','capture',{});sqlite.prepare("UPDATE jobs SET state='running',lease_until=0,lease_token='old' WHERE id='crashed'").run();await runOne(db,async()=>{});assert.equal(sqlite.prepare("SELECT state FROM jobs WHERE id='crashed'").get().state,'done');
// A stale worker cannot acknowledge a lease acquired by another worker.
await enqueue(db,'fenced','capture',{});await runOne(db,async()=>{sqlite.prepare("UPDATE jobs SET lease_token='new-owner' WHERE id='fenced'").run()});assert.equal(sqlite.prepare("SELECT state FROM jobs WHERE id='fenced'").get().state,'running');sqlite.prepare("UPDATE jobs SET state='done' WHERE id='fenced'").run();
for(let i=0;i<8;i++)await enqueue(db,'limit'+i,'capture',{});
let concurrent=0,peak=0;await Promise.all(Array.from({length:12},()=>runOne(db,async()=>{peak=Math.max(peak,++concurrent);await new Promise(r=>setTimeout(r,10));concurrent--})));assert.equal(peak,4);
sqlite.prepare("INSERT INTO orders(id,session,customer,items,total,status,created) VALUES(?,?,?,?,?,'Pending',?)").run('order-a','session-a',JSON.stringify({email:'Owner@example.com',address:'PRIVATE',phone:'PRIVATE'}),JSON.stringify([{name:'Art',qty:1,price:12300}]),12300,1000);
sqlite.prepare("UPDATE orders SET status='Shipped',carrier='Test courier',tracking_number='TRACK1' WHERE id='order-a'").run();
assert.equal((await trackingOrders(db,'wrong-session')).orders.length,0);
assert.equal((await trackingOrders(db,null,{id:'order-a',email:'wrong@example.com'})).orders.length,0);
const tracked=(await trackingOrders(db,null,{id:'order-a',email:'owner@example.com'})).orders[0];assert.equal(tracked.status,'Shipped');assert.equal(tracked.events.length,2);assert.ok(!JSON.stringify(tracked).includes('PRIVATE'));assert.equal(tracked.trackingNumber,'TRACK1');
assert.equal((await trackingOrders(db,'session-a')).orders.length,1);
assert.match(sqlite.prepare('EXPLAIN QUERY PLAN SELECT * FROM orders WHERE session=? AND created<? ORDER BY created DESC LIMIT 21').all('session-a',Date.now())[0].detail,/orders_session_created/);
let reads=0;globalThis.__catalogDB={prepare(){return {async all(){reads++;return {results:[{id:'public-art',stock:1}]}}}}};
const cache=new Map();globalThis.caches={default:{async match(key){return cache.get(key.url)?.clone()},async put(key,value){cache.set(key.url,value.clone())},async delete(key){return cache.delete(key.url)}}};
const {catalogResponse,invalidateCatalog}=await module('catalog',s=>s.replace("import { database } from './shop';",'const database=()=>globalThis.__catalogDB;'));
const request=new Request('https://shop.test/api/catalog?ignored=1',{headers:{cookie:'private-session'}});
const miss=await catalogResponse(request);assert.equal(miss.headers.get('X-Catalog-Cache'),'MISS');assert.equal(miss.headers.get('Set-Cookie'),null);
const hit=await catalogResponse(new Request('https://shop.test/api/catalog'));assert.equal(hit.headers.get('X-Catalog-Cache'),'HIT');assert.equal(reads,1);assert.equal(hit.headers.get('Cache-Control'),'public, max-age=0, s-maxage=15');
await invalidateCatalog(request);await catalogResponse(request);assert.equal(reads,2);
console.log('PASS: durable deduplication, concurrent claims, retry backoff/dead letters, lease recovery/fencing, 4-job concurrency cap, tracking isolation/history, query index, public-only cache and invalidation');
