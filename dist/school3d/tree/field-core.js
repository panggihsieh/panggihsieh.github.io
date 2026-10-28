export const CONDITIONS={
 fork_below:{label:'胸高以下已分岔／多幹',advice:'先標出分岔高度與各幹位置，由教師選擇適用調查方法。不可把各幹胸圍相加後套單幹公式。'},
 fork_near:{label:'胸高附近分岔或膨大',advice:'胸圍測點需避開分岔膨大處；記錄實際測量高度，請教師確認。'},
 buttress:{label:'板根、支持根或樹基隆起',advice:'約 1.3 m 處可能不是正常幹形，需另外確認測量點與適用材積模型。'},
 leaning:{label:'樹幹傾斜或彎曲',advice:'簡易三角法得到的是垂直高度，不等於傾斜幹長；胸徑測點也需沿幹判定。'},
 hollow:{label:'樹洞、腐朽或幹部傷口',advice:'外部胸圍無法判定內部實材積。不要自動扣除或猜測腐朽比例。'},
 crown_damage:{label:'斷梢、明顯枯死或缺失樹冠',advice:'通用生物量擴展係數可能不適用，需由教師另選模型。'},
 unknown:{label:'看不清楚／不確定',advice:'先保留照片與備註，不把未確認的樹形當作正常單幹。'}
};
function positive(n,label,max){if(typeof n!=='number'||!Number.isFinite(n)||n<=0||n>max)throw Error(`${label}需大於 0 且不超過 ${max}。`);return n;}
export function elevation(beta,gamma){
 if(typeof beta!=='number'||typeof gamma!=='number'||!Number.isFinite(beta)||!Number.isFinite(gamma)||beta< -180||beta>180||gamma< -90||gamma>90)throw Error('感測器沒有有效的 beta／gamma 角度。');
 // W3C intrinsic Z-X′-Y″ rotations: rear camera looks along device -Z.
 return Math.asin(Math.max(-1,Math.min(1,-Math.cos(beta*Math.PI/180)*Math.cos(gamma*Math.PI/180))))*180/Math.PI;
}
export function stableReading(samples,now){
 const recent=samples.filter(s=>now-s.time<=1000&&now-s.time>=0&&Number.isFinite(s.angle));
 const empty={stable:false,mean:null,spread:null,count:recent.length};
 if(!recent.length)return empty;
 const spread=Math.max(...recent.map(s=>s.angle))-Math.min(...recent.map(s=>s.angle));
 return {mean:recent.reduce((n,s)=>n+s.angle,0)/recent.length,spread,count:recent.length,stable:recent.length>=10&&recent.at(-1).time-recent[0].time>=500&&spread<=2&&now-recent.at(-1).time<=250};
}
export function clinometer({distance,eye,angle,level,aligned,calibrated,source}){
 positive(distance,'水平距離',200);positive(eye,'鏡頭離地高度',3);
 if(typeof angle!=='number'||!Number.isFinite(angle)||angle<1||angle>80)throw Error('仰角需介於 1° 到 80°。太陡的角度請退到安全平坦處重測。');
 if(!['sensor','manual','demo'].includes(source))throw Error('測量來源不正確。');
 const height=distance*Math.tan(angle*Math.PI/180)+eye;
 if(height>100)throw Error('估算樹高超過 100 m，請檢查水平距離及角度。');
 return {height,valid:level===true&&aligned===true&&calibrated===true,method:source==='sensor'?'sensor_clinometer':source==='manual'?'manual_clinometer':'demo_clinometer'};
}
export function conditionReview({inspected,flags,notes='',measurementHeight=1.3}){
 if(typeof inspected!=='boolean'||!Array.isArray(flags)||new Set(flags).size!==flags.length||flags.some(f=>!Object.hasOwn(CONDITIONS,f)))throw Error('樹形檢核資料不完整。');
 if(typeof notes!=='string'||notes.length>1500)throw Error('備註最多 1500 字。');positive(measurementHeight,'胸圍測點高度',10);
 const warnings=flags.map(f=>CONDITIONS[f].advice);
 if(!inspected)warnings.unshift('尚未完成目視檢查，請先檢查根部到胸高的幹形。');
 if(Math.abs(measurementHeight-1.3)>.01)warnings.push('測點偏離約 1.3 m，需確認適用模型；已保留實際測點高度。');
 return {requiresReview:warnings.length>0,warnings};
}
export function validateInstrument(i){
 if(!i||typeof i!=='object')throw Error('缺少現地量測資訊。');
 const result=clinometer(i);if(!result.valid)throw Error('請確認校正、瞄準與地面條件。');
 if(!Number.isFinite(Date.parse(i.capturedAt)))throw Error('量測時間不正確。');
 if(i.source==='sensor'){
  if(!i.sensor||!Number.isFinite(i.sensor.zero)||Math.abs(i.sensor.zero)>20||i.sensor.spread<0||i.sensor.spread>2||!Number.isFinite(i.sensor.spread)||!Array.isArray(i.sensor.samples))throw Error('缺少感測器校正與穩定度紀錄。');
  const samples=i.sensor.samples;
  if(samples.length<10||samples.length>200||samples.some(s=>!s||!Number.isFinite(s.time)||!Number.isFinite(s.beta)||!Number.isFinite(s.gamma)))throw Error('感測器原始讀值不完整。');
  const last=samples.at(-1).time;
  if(samples.some((s,n)=>s.time>last||last-s.time>1000||(n&&s.time<samples[n-1].time)))throw Error('感測器時間序不正確。');
  const values=samples.map(s=>({time:s.time,angle:elevation(s.beta,s.gamma)})),reading=stableReading(values,last);
  if(!reading.stable||Math.abs(reading.spread-i.sensor.spread)>1e-7||Math.abs(reading.mean-i.sensor.zero-i.angle)>1e-7)throw Error('鎖定角度與原始感測資料不一致。');
 }
 conditionReview(i.condition);
 return result;
}
export function parseObservations(text){
 let data;try{data=JSON.parse(text);}catch{throw Error('現勘檔案不是有效的 JSON。');}
 if(!data||data.version!==1||data.type!=='field_observations'||!Array.isArray(data.observations)||data.observations.length>300)throw Error('請選擇本網站匯出的現勘 JSON（最多 300 筆），不是碳儲量調查 JSON。');
 const rows=data.observations.map(o=>{
  if(!o||typeof o.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(o.id)||typeof o.name!=='string'||!o.name.trim()||o.name.length>100||typeof o.createdAt!=='string'||!Number.isFinite(Date.parse(o.createdAt))||o.conditionDetection!=='human_checklist'||typeof o.photoRecorded!=='boolean'||o.photoIncluded!==false||o.co2Kg!==null)throw Error('現勘欄位或人工檢核標記不完整。');
  const review=conditionReview(o.condition);if(o.platformId!==null&&(typeof o.platformId!=='string'||!/^MOE\d+$/.test(o.platformId)))throw Error('現勘校樹編號不正確。');
  if(o.instrument!==null){validateInstrument(o.instrument);for(const key of ['inspected','notes','measurementHeight'])if(o.instrument.condition[key]!==o.condition[key])throw Error('現勘與量測的樹形資訊不一致。');if(o.instrument.condition.flags.join(',')!==o.condition.flags.join(','))throw Error('現勘樹形標記不一致。');}
  return {id:o.id,name:o.name,platformId:o.platformId,createdAt:o.createdAt,condition:o.condition,status:review.requiresReview?'requires_review':'visually_checked',conditionDetection:'human_checklist',instrument:o.instrument,photoRecorded:o.photoRecorded,photoIncluded:false,co2Kg:null};
 });
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('現勘紀錄編號重複。');return rows;
}
