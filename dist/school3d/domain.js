export function validateData(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.points)||raw.points.length>300)throw Error('資料格式不符：請匯入本導覽匯出的版本 1 JSON。');
 const ids=new Set();
 const points=raw.points.map(p=>{
  if(!p||!['campus','carbon','birds','ecology'].includes(p.topic)||typeof p.id!=='string'||!/^[A-Z0-9_-]{1,32}$/.test(p.id)||ids.has(p.id))throw Error('地點編號重複或主題不符。');
  ids.add(p.id);
  const obj={id:p.id,topic:p.topic};
  for(const k of ['name','area','description','species','method','boundary','observedAt','soundSource','mission','label','sourceTreeId','sourceSpeciesCode','sourceName','sourceUrl','sourceCarbonDate','scientificName','family','leafShape','flowerColor','fruit','origin','retrievedAt']){
   if(p[k]!==undefined&&typeof p[k]!=='string')throw Error('文字欄位格式不符。');
   obj[k]=(p[k]||'').slice(0,k==='description'?3000:1000);
  }
  if(!obj.name.trim())throw Error('地點名稱不能空白。');
  for(const k of ['x','z']){if(typeof p[k]!=='number'||!Number.isFinite(p[k])||Math.abs(p[k])>500)throw Error('座標超出可用範圍。');obj[k]=p[k];}
  obj.confirmed=p.confirmed===true;
  for(const k of ['dbh','height','stock','uptake','emissions','year','sourceStockCO2e']){
   const v=p[k]??null;if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e12))throw Error('碳資料與尺寸必須是非負數或留白。');
   if(k==='year'&&v!==null&&(!Number.isInteger(v)||v<1900||v>2200))throw Error('請填寫有效的西元年度。');
   obj[k]=v;
  }
  for(const k of ['longitude','latitude']){
   const v=p[k]??null;
   if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>(k==='latitude'?90:180)))throw Error('原始經緯度不符。');
   obj[k]=v;
  }
  if(obj.sourceUrl&&!/^https:\/\/edutreemap\.moe\.edu\.tw\/trees\/#\/Map\?campusCode=104721&no=\d+$/.test(obj.sourceUrl))throw Error('原始資料連結不符。');
  if(p.audioData&&(!/^data:audio\/(mpeg|mp3|wav|x-wav|ogg);base64,[A-Za-z0-9+/=]+$/.test(p.audioData)||p.audioData.length>2800000))throw Error('音檔格式不符或超過 2 MB。');
  obj.audioData=p.audioData||'';
  if(p.topic==='carbon'&&(obj.uptake!==null||obj.emissions!==null)&&(!obj.year||!obj.method.trim()||!obj.boundary.trim()))throw Error('年度碳數據必須附年度、方法來源及排碳範圍。');
  return obj;
 });
 return {version:1,dataset:typeof raw.dataset==='string'?raw.dataset.slice(0,100):'',points};
}

export function mergeOfficialData(defaults,saved,legacy) {
 if(saved.dataset===defaults.dataset)return saved;
 const sourceIds=new Set(defaults.points.filter(p=>p.sourceTreeId).map(p=>p.id));
 const legacyById=new Map(legacy.points.map(p=>[p.id,p]));
 const fields=['name','area','description','species','x','z','confirmed','dbh','height','stock','uptake','emissions','year','method','boundary'];
 const retained=saved.points.filter(p=>{
  if(sourceIds.has(p.id))return false;
  const old=legacyById.get(p.id);
  return !(p.topic==='carbon'&&old&&fields.every(k=>p[k]===old[k]));
 });
 const retainedIds=new Set(retained.map(p=>p.id));
 return {version:1,dataset:defaults.dataset,points:[...retained,...defaults.points.filter(p=>!retainedIds.has(p.id))]};
}

export function summarizeCarbon(points, year) {
 const valid=p=>p.year===year&&p.method.trim()&&p.boundary.trim();
 const ups=points.filter(p=>valid(p)&&p.uptake!==null),ems=points.filter(p=>valid(p)&&p.emissions!==null);
 const uptake=ups.length?ups.reduce((a,p)=>a+p.uptake,0):null;
 const emissions=ems.length?ems.reduce((a,p)=>a+p.emissions,0):null;
 const complete=points.length>0&&ups.length===points.length&&ems.length===points.length;
 return {uptake,emissions,uptakeCount:ups.length,emissionCount:ems.length,complete,difference:complete?emissions-uptake:null};
}
