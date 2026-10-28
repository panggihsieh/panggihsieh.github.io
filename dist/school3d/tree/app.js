import {calculateCarbon} from './carbon.js';
const $=s=>document.querySelector(s),fmt=n=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:3}).format(n);
let plants=[],result=null,nextId=0;
function clearResult(){result=null;$('#emissions-result').textContent='待計算';$('#uptake-result').textContent='待補';$('#balance-result').textContent='尚不比較';$('#balance-note').textContent='請填寫同年度吸碳與維護排碳資料。';$('#result-context').textContent='完成左側資料後，即可計算。';$('#breakdown').replaceChildren();$('#download').disabled=true;$('#error').textContent='';}
function input(label,name,options={}){
 const l=document.createElement('label');l.textContent=label;const i=document.createElement('input');i.name=name;i.required=true;i.maxLength=1000;
 Object.assign(i,options);l.append(i);return l;
}
function addActivity(){
 if($('#activities').children.length>=30){$('#error').textContent='最多可填 30 筆活動。';return;}
 const box=document.createElement('div');box.className='activity';box.dataset.row=String(++nextId);
 const heading=document.createElement('div');heading.className='activity-heading';const h=document.createElement('h3');h.textContent='維護活動';const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='移除';remove.onclick=()=>{box.remove();clearResult();};heading.append(h,remove);box.append(heading);
 box.append(input('活動名稱','name',{placeholder:'例如：該株分攤的澆灌用電'}));
 const pair=document.createElement('div');pair.className='pair';pair.append(input('本年度活動量','quantity',{type:'number',min:'0',max:'1000000000',step:'any',inputMode:'decimal'}),input('活動量單位','unit',{placeholder:'例如：kWh、L、km'}));box.append(pair);
 box.append(input('排放係數（kg CO₂e／上述單位）','factor',{type:'number',min:'0',max:'1000000000',step:'any',inputMode:'decimal'}),input('係數來源與適用年度','source',{placeholder:'係數公告、報告名稱或網址'}));$('#activities').append(box);clearResult();
}
function updatePlant(){
 const p=plants.find(p=>p.id===$('#plant').value);$('#plant-info').textContent=p?`${p.species}｜${p.platformId}｜胸徑 ${p.dbh??'待補'} cm・樹高 ${p.height??'待補'} m｜平台估算儲碳 ${p.sourceStockCO2e===null?'待補':fmt(p.sourceStockCO2e)+' kg CO₂e'}（非年吸碳）`:'';clearResult();
}
$('#add').onclick=addActivity;
$('#calculator').addEventListener('input',clearResult);
$('#plant').onchange=()=>{for(const id of ['uptake','uptake-source'])$('#'+id).value='';$('#activities').replaceChildren();addActivity();updatePlant();};
$('#calculator').onsubmit=e=>{
 e.preventDefault();try{
 const value=$('#uptake').value;
 const activities=[...$('#activities').children].map(box=>Object.fromEntries(['name','quantity','unit','factor','source'].map(k=>{const v=box.querySelector(`[name="${k}"]`).value.trim();return[k,k==='quantity'||k==='factor'?(v===''?null:Number(v)):v];})));
 const computed=calculateCarbon({year:Number($('#year').value),uptake:value===''?null:Number(value),uptakeSource:$('#uptake-source').value.trim(),activities});
 result={version:1,scope:'所填單株維護活動的教學比較',plant:plants.find(p=>p.id===$('#plant').value),...computed};
 $('#result-context').textContent=`${result.year} 年｜${result.plant.species}｜${result.plant.label}`;
 $('#emissions-result').textContent=fmt(result.emissions);$('#uptake-result').textContent=result.uptake===null?'待補':fmt(result.uptake);
 $('#balance-result').textContent=result.difference===null?'尚不比較':fmt(result.difference)+' kg CO₂e';
 $('#balance-note').textContent=result.difference===null?'未提供年度吸碳量，不計算差額。':'負值表示所填吸碳量大於所填維護排碳；僅限本次記錄範圍。';
 $('#breakdown').replaceChildren();for(const a of result.activities){const r=document.createElement('div'),name=document.createElement('span'),v=document.createElement('span');name.textContent=a.name;v.textContent=fmt(a.emissions)+' kg CO₂e';r.append(name,v);$('#breakdown').append(r);}$('#download').disabled=false;
 }catch(err){$('#error').textContent=err.message;}
};
$('#calculator').onreset=()=>setTimeout(()=>{$('#activities').replaceChildren();addActivity();updatePlant();},0);
$('#download').onclick=()=>{if(!result)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));a.download=`${result.plant.label}_${result.year}_植物碳計算.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
addActivity();
try{const response=await fetch('./plants.json');if(!response.ok)throw Error();plants=await response.json();if(!plants.length)throw Error();$('#plant').replaceChildren();for(const p of plants){const option=document.createElement('option');option.value=p.id;option.textContent=p.label+'｜'+p.species;$('#plant').append(option);}$('#plant').disabled=false;$('#calculate').disabled=false;updatePlant();}catch{$('#plant-info').textContent='植物資料載入失敗，請重新整理頁面。';}
