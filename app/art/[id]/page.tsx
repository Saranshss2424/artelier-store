import Piece from './piece';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Piece id={id}/>}
