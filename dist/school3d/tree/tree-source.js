export const MASTER_URL='https://panggihsieh.github.io/school3d-site/data.json';
export function masterPlants(data){
 if(!Array.isArray(data?.points))throw Error('主站校樹資料格式不符');
 const points=data.points.filter(p=>p.topic==='carbon');
 if(!points.length)throw Error('主站尚無校樹資料');
 const ids=new Set();
 return points.map(p=>{
  if(typeof p.id!=='string'||!p.id||ids.has(p.id)||typeof p.species!=='string')throw Error('主站校樹編號或樹種不完整');
  ids.add(p.id);
  const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
  return {...p,platformId:p.sourceTreeId,dbh:number(p.dbh),height:number(p.height),sourceStockCO2e:number(p.sourceStockCO2e),latitude:number(p.latitude),longitude:number(p.longitude)};
 });
}
export async function loadPlants(fetcher=fetch){
 try{
  const response=await fetcher(MASTER_URL,{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('主站回應失敗');
  return {plants:masterPlants(await response.json()),live:true};
 }catch{
  const response=await fetcher('./plants.json');
  if(!response.ok)throw Error('備份資料無法載入');
  const plants=await response.json();
  if(!Array.isArray(plants)||!plants.length)throw Error('備份資料格式不符');
  return {plants,live:false};
 }
}
