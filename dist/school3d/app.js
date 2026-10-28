import * as THREE from 'three';
import {validateData,summarizeCarbon,mergeOfficialData} from './domain.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE='danan-ecology-v1';
const topics={campus:['校園空間','CAMPUS GUIDE','從校園，開始探索。','選擇地圖標記，認識每一處校園空間。'],carbon:['植物碳資訊','PLANTS & CARBON','看見樹木，也看見碳。','植物吸碳與維護排碳分開記錄，依年度比較。'],birds:['鳥類觀察','BIRD OBSERVATION','停下來，聽見自然。','認識觀察點、記錄鳥類，聆聽已匯入的鳥鳴。'],ecology:['生態景點','ECOLOGY SPOTS','每一處綠意，都有發現。','選擇景點，帶著一個小任務開始觀察。']};
let state,topic='campus',selected=null,query='',speciesFilter='',year=2026,placing=false,editingId=null,newPoint=false;
let scene,camera,renderer,controls,model,frame,markers=[],pointerStart=null,groundRay=new THREE.Raycaster();
const timer={};
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(timer.toast);timer.toast=setTimeout(()=>$('#toast').style.display='none',4500);}

function save(next){
 try{next=validateData(next);localStorage.setItem(STORE,JSON.stringify(next));state=next;$('#storage-state').textContent='變更已儲存在此瀏覽器';return true;}
 catch(e){const message=e.name==='QuotaExceededError'?'儲存空間不足，請減少音檔大小或先匯出備份。':e.message;if($('#editor').open)$('#form-error').textContent=message;else toast(message);return false;}
}
function current(){return state.points.find(p=>p.id===selected);}
function filtered(){return state.points.filter(p=>p.topic===topic&&(!speciesFilter||topic!=='carbon'||p.species===speciesFilter)&&`${p.name} ${p.area} ${p.species}`.toLowerCase().includes(query.toLowerCase()));}
function fmt(v,unit=''){return v===null||v===undefined?'待補':`${new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(v)}${unit?' '+unit:''}`;}
function row(label,value){return `<div class="info-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;}

function drawSummary(){
 const points=state.points.filter(p=>p.topic===topic);
 if(topic==='carbon'){
  const totals=summarizeCarbon(points,year);
  const {uptake:u,emissions:e,complete}=totals;
  const sourced=points.filter(p=>p.sourceTreeId),stocks=sourced.filter(p=>p.sourceStockCO2e!==null);
  const sourceSummary=sourced.length?`<p class="coverage">教育部平台 ${sourced.length} 株・${new Set(sourced.map(p=>p.species)).size} 樹種<br>平台估算儲碳 ${fmt(stocks.reduce((n,p)=>n+p.sourceStockCO2e,0))} kg CO₂e（${stocks.length}/${sourced.length} 株）<br>儲碳量不等於每年吸碳量。</p>`:'';
  $('#summary').innerHTML=sourceSummary+`<details class="annual-summary" ${sourced.length?'':'open'}><summary>年度吸碳與排碳比較</summary><label class="coverage">比較年度 <input id="reporting-year" aria-label="比較年度" type="number" min="1900" max="2200" value="${year}" style="width:80px;padding:4px;border:1px solid var(--line);border-radius:4px;background:transparent;color:inherit"></label><div class="kpis"><div class="kpi"><span>已填吸碳合計</span><strong>${fmt(u)}</strong><small>kg CO₂／年</small></div><div class="kpi emission"><span>已填維護排碳合計</span><strong>${fmt(e)}</strong><small>kg CO₂e／年</small></div></div><p class="coverage">吸碳 ${totals.uptakeCount}/${points.length} 筆・排碳 ${totals.emissionCount}/${points.length} 筆<br>年度差額：${complete?esc(fmt(e-u,'kg CO₂e／年'))+'（排碳－吸碳）':'資料未齊，尚不比較'}</p></details>`;
  $('#reporting-year').addEventListener('change',e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1900&&n<=2200){year=n;drawSummary();}else{e.target.value=year;toast('請輸入 1900–2200 年。');}});
 }else $('#summary').innerHTML=`<p class="intro">${topic==='birds'?'預留觀察點與鳥類介紹；匯入有授權的音檔後即可播放。':topic==='ecology'?'把觀察變成一個小任務，從校園的綠地開始。':'保留校舍、操場與樹帶的相對位置，逐步補齊校園故事。'}</p><span class="coverage">${points.length} 個${topic==='birds'?'觀察點':'地點'}・${points.filter(p=>p.confirmed).length} 個已確認</span>`;
}
function renderList(){
 const points=filtered();
 $('#point-list').innerHTML=points.length?points.map(p=>`<button class="point-row ${p.id===selected?'active':''}" data-id="${p.id}" aria-pressed="${p.id===selected}"><span class="point-number">${esc(p.label||p.id)}</span><span class="point-label">${esc(p.name)}<small>${esc(p.area||'區域待補')}</small></span><span class="point-arrow">↗</span></button>`).join(''):'<p class="empty">沒有符合的地點。可調整搜尋，或按 ＋ 新增。</p>';
 $('#point-list').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>select(b.dataset.id,true));
}
function renderDetail(){
 const p=current();
 if(!p||p.topic!==topic){$('#detail').innerHTML='<p class="empty">選擇一個地點，查看或編輯導覽資料。</p>';return;}
 let html=`<div class="detail-top"><h3>${esc(p.name)}</h3><button class="text-button" id="edit-selected">編輯</button></div><span class="status-pill">${p.confirmed?'位置已確認':p.sourceTreeId?'教育部平台登錄・點位待現勘':'候選位置・待確認'}</span><p class="detail-description">${esc(p.description||'介紹待補，可按「編輯」新增。')}</p>`;
 if(topic==='carbon'){
  if(p.sourceTreeId)html+=row('平台編號','104721-'+p.sourceTreeId.padStart(7,'0'))+row('學名',p.scientificName||'待補')+row('科名',p.family||'待補')+row('來源分類',p.origin||'待補')+row('葉形',p.leafShape||'待補')+row('花色 / 果實',`${p.flowerColor||'待補'} / ${p.fruit||'待補'}`)+row('平台估算儲碳',fmt(p.sourceStockCO2e,'kg CO₂e'))+row('平台碳量計算日期',p.sourceCarbonDate?.slice(0,10)||'待補')+row('原始經緯度',`${p.longitude}, ${p.latitude}`)+`<p class="coverage">資料擷取：${esc(p.retrievedAt)} · <a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener">查看教育部原始紀錄 ↗</a></p>`;
  html+=row('樹種',p.species||'待鑑定')+row('胸徑 / 樹高',`${fmt(p.dbh,'cm')} / ${fmt(p.height,'m')}`)+row('另填碳儲存量',fmt(p.stock,'kg C'))+row('年度',p.year||'待補')+row('每年吸碳',fmt(p.uptake,'kg CO₂／年'))+row('維護活動排碳',fmt(p.emissions,'kg CO₂e／年'))+row('方法與來源',p.method||'待補')+row('排碳範圍',p.boundary||'待補');
 }else if(topic==='birds'){
  html+=row('鳥類名稱',p.species||'待鑑定')+row('最近觀察時間',p.observedAt||'尚無紀錄');
  html+=`<div class="audio-area"><strong style="font-size:13px">鳥鳴播放</strong>${p.audioData?'<audio controls preload="none" id="bird-audio"></audio>':'<p>尚未匯入鳥鳴音檔。</p>'}<label class="file-button">${p.audioData?'更換':'匯入'}鳥鳴 <input id="audio-file" type="file" accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg" hidden></label>${p.audioData?'<button class="text-button" id="remove-audio">移除音檔</button>':''}<p>來源／授權：${esc(p.soundSource||'待補')}<br>僅供導覽聆聽，現地不以鳥音引誘鳥類。上限 2 MB。</p></div>`;
 }else if(topic==='ecology')html+=`<p class="eyebrow" style="margin-top:20px">TRY A LITTLE MISSION</p><p class="detail-description">${esc(p.mission||'任務待補')}</p>`;
 html+=row('地圖座標',`東向 ${p.x.toFixed(1)} m・南向 ${p.z.toFixed(1)} m`)+`<button class="move-button" id="move-point">在地圖上調整位置</button><button class="delete-button" id="delete-point">移除此地點</button>`;
 $('#detail').innerHTML=html;
 $('#edit-selected').onclick=()=>openEditor(p);
 $('#move-point').onclick=()=>{placing=true;document.body.classList.add('placing');$('#placing-hint').textContent='點一下地圖地面，或按 Esc 取消';$('#viewport').scrollIntoView({behavior:'smooth',block:'center'});toast('請點選地圖上的新位置。');};
 $('#delete-point').onclick=()=>{if(!window.confirm(`移除「${p.name}」？請先匯出保留備份。`))return;if(save({version:1,points:state.points.filter(v=>v.id!==p.id)})){selected=null;refresh();toast('地點已移除。');}};
 if(topic==='birds'){
  if(p.audioData){$('#bird-audio').src=p.audioData;$('#bird-audio').addEventListener('error',()=>toast('無法播放這個音檔，請改用有效的 MP3、WAV 或 OGG。'));$('#remove-audio').onclick=()=>{if(save({...state,points:state.points.map(v=>v.id===p.id?{...v,audioData:''}:v)}))renderDetail();};}
  $('#audio-file').onchange=async e=>{
   const f=e.target.files[0];if(!f)return;if(f.size>2*1024*1024){toast('音檔超過 2 MB，請縮短或壓縮後再匯入。');return;}
   const ext=f.name.split('.').pop().toLowerCase(),types={mp3:'mpeg',wav:'wav',ogg:'ogg'};
   if(!types[ext]){toast('請選擇 MP3、WAV 或 OGG 音檔。');return;}
   try{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(new Blob([f],{type:`audio/${types[ext]}`}));});if(save({...state,points:state.points.map(v=>v.id===p.id?{...v,audioData:data}:v)})){renderDetail();toast('音檔已匯入；請編輯並補上來源與授權。');}}catch{toast('無法讀取音檔。');}
  };
 }
}
function cancelPlacing(){placing=false;document.body.classList.remove('placing');$('#placing-hint').textContent='拖曳旋轉 · 滾輪縮放';}
function select(id,focus=false){cancelPlacing();selected=id;renderList();renderDetail();updateMarkerElements();if(matchMedia('(min-width:721px)').matches){const aside=$('.sidebar');aside.scrollTo({top:aside.scrollTop+$('#detail').getBoundingClientRect().top-aside.getBoundingClientRect().top-10,behavior:'smooth'});}else $('#detail').scrollIntoView({behavior:'smooth',block:'nearest'});if(focus&&camera){const p=current();const delta=new THREE.Vector3(p.x,0,p.z).sub(controls.target);controls.target.add(delta);camera.position.add(delta);controls.update();}}
function renderSpeciesFilter(){const wrap=$('#species-filter-wrap');wrap.hidden=topic!=='carbon';const counts=new Map();for(const p of state.points.filter(p=>p.topic==='carbon'))counts.set(p.species||'未鑑定',(counts.get(p.species||'未鑑定')||0)+1);$('#species-filter').innerHTML='<option value="">全部樹種</option>'+[...counts].sort((a,b)=>a[0].localeCompare(b[0],'zh-TW')).map(([name,count])=>`<option value="${esc(name)}">${esc(name)}（${count} 株）</option>`).join('');$('#species-filter').value=speciesFilter;}
function refresh(){drawSummary();renderSpeciesFilter();renderList();renderDetail();updateMarkerElements();}
function switchTopic(next){cancelPlacing();topic=next;query='';speciesFilter='';$('#search').value='';selected=state.points.find(p=>p.topic===topic)?.id||null;document.querySelectorAll('.topic').forEach(b=>{b.classList.toggle('active',b.dataset.topic===topic);if(b.dataset.topic===topic)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});const [title,kicker,heading,subtitle]=topics[topic];$('#section-title').textContent=title;$('#section-kicker').textContent=kicker;$('#map-title').textContent=heading;$('#map-subtitle').textContent=subtitle;refresh();}

function field(name,label,value='',type='text',extra=''){return `<label class="field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value??'')}" ${extra}></label>`;}
function openEditor(p,isNew=false){
 editingId=p.id;newPoint=isNew;
 $('#editor-title').textContent=isNew?'新增地點':'編輯地點';
 let html=field('name','名稱',p.name,'text','required maxlength="120"')+field('area','所在區域',p.area,'text','maxlength="120"')+`<label class="field">介紹<textarea name="description" maxlength="3000">${esc(p.description)}</textarea></label><div class="field-pair">${field('x','東向 X（m）',p.x,'number','required min="-500" max="500" step="0.1"')}${field('z','南向 Z（m）',p.z,'number','required min="-500" max="500" step="0.1"')}</div><label class="field"><input name="confirmed" type="checkbox" ${p.confirmed?'checked':''} style="display:inline;width:auto;margin-right:8px">已由校方確認位置</label>`;
 if(topic==='carbon')html+=field('species','樹種（未確定可留白）',p.species)+`<div class="field-pair">${field('dbh','胸徑（cm）',p.dbh,'number','min="0" step="any"')}${field('height','樹高（m）',p.height,'number','min="0" step="any"')}</div>`+field('stock','碳儲存量（kg C，非每年吸碳）',p.stock,'number','min="0" step="any"')+field('year','資料年度（填年度碳量時必填）',p.year,'number','min="1900" max="2200" step="1"')+field('uptake','每年吸碳量（kg CO₂／年）',p.uptake,'number','min="0" step="any"')+field('emissions','維護活動每年排碳（kg CO₂e／年）',p.emissions,'number','min="0" step="any"')+field('method','計算方法、係數來源或調查報告',p.method,'text','maxlength="1000"')+field('boundary','維護排碳涵蓋範圍',p.boundary,'text','maxlength="1000"');
 if(topic==='birds')html+=field('species','鳥類名稱（未鑑定可留白）',p.species)+field('observedAt','觀察日期與時間',p.observedAt,'text','placeholder="例如 2026-10-28 08:30"')+field('soundSource','鳥鳴來源與授權',p.soundSource,'text','maxlength="1000"');
 if(topic==='ecology')html+=field('mission','探索小任務',p.mission,'text','maxlength="1000"');
 $('#edit-fields').innerHTML=html;$('#form-error').textContent='';$('#editor').showModal();
}
$('#edit-form').onsubmit=e=>{
 e.preventDefault();const f=new FormData(e.target),base=newPoint?{id:editingId,topic}:current();const p={...base};
 for(const [key,val]of f.entries())p[key]=String(val).trim();p.confirmed=f.has('confirmed');
 for(const k of ['x','z','dbh','height','stock','uptake','emissions','year'])if(f.has(k))p[k]=f.get(k)===''?null:Number(f.get(k));
 if(save({...state,points:newPoint?[...state.points,p]:state.points.map(v=>v.id===p.id?p:v)})){$('#editor').close();selected=p.id;refresh();toast('地點已儲存。');}
};

function updateMarkerElements(){
 $('#markers').replaceChildren();markers=[];
 for(const p of filtered()){
  const el=document.createElement('button');el.className=`marker ${topic} ${p.sourceTreeId?'tree-marker':''} ${p.id===selected?'selected':''}`;el.textContent=p.sourceTreeId?(p.id===selected?p.label:''):(p.label||p.id);el.setAttribute('aria-label',p.name);el.title=p.name;el.onclick=()=>select(p.id);$('#markers').append(el);markers.push({el,p});
 }
}
function fitView(top=false){if(!camera||!model)return;const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3());center.y=0;controls.target.copy(center);const d=155;camera.position.copy(center.clone().add(top?new THREE.Vector3(0,d,.01):new THREE.Vector3(100,105,135)));camera.zoom=Math.min(1,$('#viewport').clientWidth/$('#viewport').clientHeight/1.25);camera.updateProjectionMatrix();controls.update();}
function resize(){if(!renderer)return;const v=$('#viewport'),w=v.clientWidth,h=v.clientHeight;renderer.setSize(w,h,false);camera.left=-110*w/h;camera.right=110*w/h;camera.top=110;camera.bottom=-110;camera.updateProjectionMatrix();if(model)fitView();}
function mapClick(event){if(!camera||!pointerStart||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>5)return;const r=$('#scene').getBoundingClientRect(),v=new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);groundRay.setFromCamera(v,camera);if(!placing){const hit=groundRay.intersectObject(model,true)[0];if(hit?.object.userData.treeId){const id=hit.object.userData.treeId;if(topic!=='carbon')switchTopic('carbon');speciesFilter='';query='';$('#search').value='';renderSpeciesFilter();select(id);}return;}const hit=new THREE.Vector3();if(groundRay.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),hit)){const p=current();if(save({...state,points:state.points.map(v=>v.id===p.id?{...v,x:Math.round(hit.x*10)/10,z:Math.round(hit.z*10)/10,confirmed:false}:v)})){cancelPlacing();refresh();toast('位置已更新，請現地確認。');}}}
async function setupScene(){
 try{
  scene=new THREE.Scene();scene.background=new THREE.Color('#e9edde');camera=new THREE.OrthographicCamera(-110,110,110,-110,.1,1000);
  renderer=new THREE.WebGLRenderer({canvas:$('#scene'),antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.45;
  scene.add(new THREE.HemisphereLight(0xfffce8,0x849175,2.7));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-50,100,80);scene.add(sun);
  controls=new OrbitControls(camera,$('#scene'));controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2-.05;controls.minZoom=.5;controls.maxZoom=5;controls.enablePan=true;
  resize();new ResizeObserver(resize).observe($('#viewport'));
  const loader=new GLTFLoader();const gltf=await loader.loadAsync('./assets/campus.glb');model=gltf.scene;model.traverse(o=>{const match=o.name.match(/MOE\d+/);if(match)o.userData.treeId=match[0];});scene.add(model);fitView();$('#loading').hidden=true;
  $('#scene').addEventListener('pointerdown',e=>pointerStart={x:e.clientX,y:e.clientY});$('#scene').addEventListener('click',mapClick);
  const projected=new THREE.Vector3(),north=new THREE.Vector3(),origin=new THREE.Vector3();
  const animate=()=>{frame=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);const vw=$('#viewport').clientWidth,vh=$('#viewport').clientHeight;origin.copy(controls.target).project(camera);north.copy(controls.target).add(new THREE.Vector3(0,0,-10)).project(camera);$('#north-arrow').style.transform=`rotate(${Math.atan2((north.x-origin.x)*vw,(north.y-origin.y)*vh)}rad)`;for(const {el,p}of markers){projected.set(p.x,4,p.z).project(camera);el.style.left=`${(projected.x*.5+.5)*vw}px`;el.style.top=`${(-projected.y*.5+.5)*vh}px`;el.hidden=projected.z>1||projected.z<-1||Math.abs(projected.x)>1||Math.abs(projected.y)>1;}};animate();
 }catch(e){console.error(e);$('#loading').textContent='此裝置暫時無法顯示 3D。仍可使用右側清單查看與編輯資料。';$('#fallback-map').hidden=false;$('#map-status').textContent='3D 顯示暫不可用';}
}
$('#reset-view').onclick=()=>fitView();$('#top-view').onclick=()=>fitView(true);
for(const [selector,factor]of [['#zoom-in',1.25],['#zoom-out',.8]])$(selector).onclick=()=>{if(camera){camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,.5,5);camera.updateProjectionMatrix();}};
document.querySelectorAll('.topic').forEach(b=>b.onclick=()=>switchTopic(b.dataset.topic));
$('#species-filter').onchange=e=>{speciesFilter=e.target.value;selected=filtered()[0]?.id||null;renderList();renderDetail();updateMarkerElements();};
$('#search').oninput=e=>{query=e.target.value;renderList();updateMarkerElements();};
$('#add-point').onclick=()=>{const prefix={campus:'C',carbon:'T',birds:'B',ecology:'E'}[topic];let n=1;while(state.points.some(p=>p.id===prefix+String(n).padStart(2,'0')))n++;openEditor({id:prefix+String(n).padStart(2,'0'),topic,name:'',area:'',description:'',x:Math.round(controls?.target.x||0),z:Math.round(controls?.target.z||0),confirmed:false},true);};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
$('#about-button').onclick=()=>$('#about').showModal();document.addEventListener('keydown',e=>{if(e.key==='Escape')cancelPlacing();});
$('#export-button').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='大南國小_生態導覽資料.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('已匯出目前的導覽資料。');};
$('#import-button').onclick=()=>$('#import-file').click();
$('#import-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>12000000)throw Error('資料檔超過 12 MB。');const next=validateData(JSON.parse(await f.text()));if(window.confirm('匯入會取代目前導覽資料，確定已保留備份並繼續？')&&save({...next,dataset:state.dataset})){selected=state.points.find(p=>p.topic===topic)?.id||null;refresh();toast('導覽資料已匯入。');}}catch(error){toast(error instanceof SyntaxError?'JSON 格式錯誤，請檢查檔案。':error.message);}finally{e.target.value='';}};
$('#fallback-map').onclick=()=>window.open('./assets/campus-map.png','_blank','noopener');
try{const response=await fetch('./data.json');if(!response.ok)throw Error('無法載入地點資料');const defaults=validateData(await response.json());state=defaults;try{const saved=localStorage.getItem(STORE);if(saved){const old=validateData(JSON.parse(saved));if(old.dataset!==defaults.dataset){const legacyResponse=await fetch('./legacy-data.json');if(!legacyResponse.ok)throw Error('舊版資料範本載入失敗');const legacy=validateData(await legacyResponse.json());state=mergeOfficialData(defaults,old,legacy);save(state);toast('已加入教育部樹木資料，保留原有自訂編輯。');}else state=old;}}catch{toast('無法讀取本機資料，先使用原始配置。');}selected=state.points.find(p=>p.topic==='campus')?.id;const requested=new URLSearchParams(location.search).get('topic');if(Object.hasOwn(topics,requested))switchTopic(requested);else refresh();setupScene();}catch(e){$('#loading').textContent='導覽資料載入失敗，請重新整理頁面。';$('#detail').textContent=e.message;}
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);renderer?.dispose();});
