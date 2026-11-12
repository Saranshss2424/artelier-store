export const fingers=['Thumb','Index','Middle','Ring','Little'] as const;
export const nailCategory='Press-on nails';
export const fitKey='artelier:fit:v1';
export type Fit={left:number[];right:number[];confirmed:true};
export function validWidth(v:unknown):v is number{return typeof v==='number'&&Number.isFinite(v)&&v>=3&&v<=35&&Math.abs(v*10-Math.round(v*10))<1e-8}
export function checkedFit(x:any):Fit {if(!x||x.confirmed!==true||![x.left,x.right].every(a=>Array.isArray(a)&&a.length===5&&Array.from(a).every(validWidth)))throw Error('Confirm all ten nail widths (3–35 mm, up to one decimal place) before checkout.');return {left:[...x.left],right:[...x.right],confirmed:true}}
export function readFit():Fit|null{try{return checkedFit(JSON.parse(sessionStorage.getItem(fitKey)||'null'))}catch{return null}}
export type Point={x:number;y:number};
export function photoWidth(points:Point[]){if(points.length!==4)return null;const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);const ref=distance(points[0],points[1]);if(ref<10)return null;const width=Math.round(100*distance(points[2],points[3])/ref)/10;return validWidth(width)?width:null}
