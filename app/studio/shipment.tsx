'use client';
import {useState} from 'react';
export default function Shipment({order,onSaved}:{order:any;onSaved:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function save(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage('');try{const data=Object.fromEntries(new FormData(e.currentTarget));const r=await fetch('/api/shop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'shipment',id:order.id,...data})});const d:any=await r.json();if(!r.ok)throw Error(d.error);setMessage('Courier details saved.');await onSaved()}catch(e:any){setMessage(e.message)}finally{setBusy(false)}}
 return <form className="shipment-form" onSubmit={save}><label>Courier<input name="carrier" maxLength={80} defaultValue={order.carrier||''} placeholder="Courier name"/></label><label>Tracking number<input name="trackingNumber" maxLength={120} defaultValue={order.tracking_number||''}/></label><label>Courier tracking link<input name="trackingUrl" type="url" maxLength={1000} defaultValue={order.tracking_url||''} placeholder="https://…"/></label><button className="primary" disabled={busy}>Save courier details</button>{message&&<p role="status">{message}</p>}</form>
}
