export async function verifyHmac(message:string,signature:string,secret:string){
 if(!/^[a-f0-9]{64}$/i.test(signature)||!secret)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const bytes=Uint8Array.from(signature.match(/../g)!,s=>parseInt(s,16));
 return crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(message));
}
export async function boundedText(request:Request,max=24000){
 const reader=request.body?.getReader();if(!reader)return '';let size=0;const chunks:Uint8Array[]=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('Request too large');}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}return new TextDecoder().decode(bytes);
}
