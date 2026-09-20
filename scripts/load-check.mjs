// Read-only, bounded catalog load check. Defaults to localhost; no purchase requests.
import {performance} from 'node:perf_hooks';
const target=new URL(process.argv[2]||'http://127.0.0.1:4173/api/catalog');
if(!['localhost','127.0.0.1','terminal.local'].includes(target.hostname)&&!process.argv.includes('--allow-remote'))throw Error('Remote testing requires --allow-remote on a staging host you own.');
const total=Math.min(500,Math.max(1,Number(process.env.REQUESTS)||100));
const concurrency=Math.min(50,Math.max(1,Number(process.env.CONCURRENCY)||10));
let next=0,failures=0,hits=0;const times=[];const statuses={};const begin=performance.now();
await Promise.all(Array.from({length:concurrency},async()=>{while(next++<total){const start=performance.now();try{const r=await fetch(target,{signal:AbortSignal.timeout(10000)});statuses[r.status]=(statuses[r.status]||0)+1;if(!r.ok)failures++;if(r.headers.get('X-Catalog-Cache')==='HIT')hits++;await r.arrayBuffer()}catch{failures++}times.push(performance.now()-start)}}));
times.sort((a,b)=>a-b);console.log(JSON.stringify({target:target.origin+target.pathname,total,concurrency,failures,statuses,cacheHits:hits,p50Ms:Math.round(times[Math.floor(times.length*.5)]),p95Ms:Math.round(times[Math.floor(times.length*.95)]),elapsedMs:Math.round(performance.now()-begin)},null,2));if(failures)process.exitCode=1;
