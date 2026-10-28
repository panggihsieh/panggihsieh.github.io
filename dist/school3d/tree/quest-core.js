export const FORMULA='TW-Forest-BCEF-2026';
export const SOURCE='https://www.forest.gov.tw/0004712';
export const DEMO={bcef:0.7,r:0.26,cf:0.47,source:'教學假設值，非官方樹種係數',mode:'demo'};
export function number(v,label,min=0,max=10000){
 if(typeof v!=='number'||!Number.isFinite(v)||v<=min||v>max)throw Error(`${label}需大於 ${min}，且不超過 ${max}。`);return v;
}
export function geometry({steps,length,eye,mode='explore',fixedHeight=9.3,level=true,aligned=false,calibrated=true}){
 number(steps,'步數',0,100);number(length,'步長',0,3);number(eye,'眼高',0,3);
 const distance=steps*length;
 if(!['explore','field'].includes(mode))throw Error('測量模式不正確。');
 const height=mode==='field'?number(fixedHeight,'參考樹高',eye,100):distance+eye;
 const angle=Math.atan2(height-eye,distance)*180/Math.PI;
 const valid=level&&(mode==='explore'||(calibrated&&aligned&&Math.abs(angle-45)<=0.5));
 return {distance,height,angle,valid,estimatedHeight:valid?distance+eye:null,measurementMethod:mode==='explore'?'demo_45_degree':'field_45_degree'};
}
export function carbon({circumference,height,group,coefficients=null}){
 number(circumference,'胸圍',0,3000);number(height,'樹高',0,100);
 if(!['broadleaf','conifer'].includes(group))throw Error('請確認闊葉樹或針葉樹分類；棕櫚等其他樹形不套用此式。');
 const dbhCm=circumference/Math.PI,dbhM=dbhCm/100,f=group==='conifer'?0.5:0.45;
 const volume=dbhM**2*0.79*height*f;
 if(coefficients){
  number(coefficients.bcef,'BCEF',0,10);number(coefficients.cf,'CF',0,1);
  if(typeof coefficients.r!=='number'||!Number.isFinite(coefficients.r)||coefficients.r<0||coefficients.r>10)throw Error('R 需為 0 至 10。');
  if(!['demo','sourced'].includes(coefficients.mode)||typeof coefficients.source!=='string'||!coefficients.source.trim())throw Error('請填係數來源與適用範圍。');
 }
 return {dbhCm,dbhM,f,volume,co2Kg:coefficients?volume*coefficients.bcef*(1+coefficients.r)*coefficients.cf*44/12*1000:null};
}
export function validateRecord(r){
 if(!r||typeof r!=='object'||typeof r.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(r.id))throw Error('紀錄編號不正確。');
 for(const k of ['name','species','sourceUrl','estimatedAt','measurementMethod'])if(typeof r[k]!=='string'||r[k].length>2000)throw Error('紀錄欄位不完整。');
 if(!r.name.trim()||!r.species.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date+'T00:00:00Z'))||new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)!==r.date)throw Error('請填樹木名稱、樹種及有效日期。');
 if(r.formulaId!==FORMULA||!['demo_45_degree','field_45_degree'].includes(r.measurementMethod)||typeof r.demo!=='boolean')throw Error('紀錄模型或測量方法不支援。');
 if(!r.measurement||['level','aligned','calibrated'].some(k=>typeof r.measurement[k]!=='boolean')||!Number.isFinite(Date.parse(r.estimatedAt)))throw Error('紀錄需保留步長校正、地面與觀測條件及有效建立時間。');
 const g=geometry({...r.measurement,mode:r.measurementMethod==='field_45_degree'?'field':'explore'});
 if(!g.valid||Math.abs(g.estimatedHeight-r.height)>1e-8)throw Error('量測條件或樹高不一致。');
 const result=carbon(r);
 if(r.demo!==(r.measurementMethod==='demo_45_degree'||r.coefficients?.mode==='demo'))throw Error('示範資料標記不一致。');
 if(r.platformId!==null&&(typeof r.platformId!=='string'||!/^MOE\d+$/.test(r.platformId)))throw Error('校樹來源編號不正確。');
 if(r.location!==null){number(r.location.x+1000,'X',0,2000);number(r.location.z+1000,'Z',0,2000);}
 return {...r,result};
}
export function parseRecords(text){
 let data;try{data=JSON.parse(text);}catch{throw Error('檔案不是有效的 JSON 格式。');}
 if(!data||data.version!==1||!Array.isArray(data.records)||data.records.length>1000)throw Error('僅支援第 1 版紀錄，最多 1000 筆。');
 const records=data.records.map(validateRecord);if(new Set(records.map(r=>r.id)).size!==records.length)throw Error('紀錄編號重複。');return records;
}
export function summarize(rows){
 const bySpecies=new Map();let total=0,missing=0;
 for(const r of rows){const v=r.co2Kg;const item=bySpecies.get(r.species)||{species:r.species,count:0,total:0,missing:0};item.count++;if(v===null){missing++;item.missing++;}else{total+=v;item.total+=v;}bySpecies.set(r.species,item);}
 for(const item of bySpecies.values())if(item.count===item.missing)item.total=null;
 return {count:rows.length,total:rows.length===missing?null:total,missing,bySpecies:[...bySpecies.values()].sort((a,b)=>(b.total??0)-(a.total??0))};
}
export function latestRecords(records,demo){
 const latest=new Map();
 for(const r of records.filter(r=>r.demo===demo)){
  const key=r.platformId||r.id,old=latest.get(key);
  if(!old||r.date>old.date||(r.date===old.date&&Date.parse(r.estimatedAt)>Date.parse(old.estimatedAt)))latest.set(key,r);
 }
 return [...latest.values()];
}
export function csvCell(value){const s=String(value??'');return '"'+(/^[=+\-@\t\r]/.test(s)?"'":'')+s.replaceAll('"','""')+'"';}
