function amount(value,label){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e9)throw Error(`${label}需為 0 至 1,000,000,000 的數值。`);
 return value;
}
export function calculateCarbon({year,uptake,uptakeSource,activities}){
 if(!Number.isInteger(year)||year<1900||year>2200)throw Error('請填寫有效的年度。');
 if(!Array.isArray(activities)||activities.length===0||activities.length>30)throw Error('請至少填寫一筆維護活動，最多 30 筆。');
 const rows=activities.map(a=>{
  if(!a.name?.trim()||!a.unit?.trim()||!a.source?.trim())throw Error('每筆活動都需填寫名稱、單位與係數來源。');
  return {...a,emissions:amount(a.quantity,'活動量')*amount(a.factor,'排放係數')};
 });
 const emissions=rows.reduce((sum,a)=>sum+a.emissions,0);
 if(uptake!==null){amount(uptake,'年度吸碳量');if(!uptakeSource?.trim())throw Error('請補上年度吸碳量的方法與來源。');}
 return {year,uptake,uptakeSource:uptakeSource||'',emissions,difference:uptake===null?null:emissions-uptake,activities:rows};
}
