import {elevation} from './field-core.js?v=20261029-ipad-1';
export class FieldHardware{
 constructor(env){this.env=env;this.samples=[];this.stream=null;this.token=0;this.listening=false;}
 async startSensor(onSample,onStatus){
  this.stopSensor();const token=this.token;
  const E=this.env.DeviceOrientationEvent;
  if(!this.env.isSecureContext)throw Error('感測器需使用 HTTPS；請在 iPad Safari 開啟正式網站。');
  if(!E)throw Error('這個瀏覽器未提供姿態感測器，請改用外部量角器手動輸入。');
  if(typeof E.requestPermission==='function'){
   let permission;try{permission=await E.requestPermission();}catch{throw Error('無法取得感測權限，請在 Safari 點按啟用按鈕，或改用外部量角器。');}if(token!==this.token)return;
   if(permission!=='granted')throw Error('未取得動作與方向權限。可重新允許，或改用手動輸入。');
  }
  if(token!==this.token)return;
  this.listener=e=>{try{const angle=elevation(e.beta,e.gamma),sample={angle,beta:e.beta,gamma:e.gamma,time:this.env.now()};this.samples.push(sample);this.samples=this.samples.filter(s=>sample.time-s.time<=1000).slice(-200);onSample(sample,this.samples);}catch{onStatus('裝置尚未提供有效角度。');}};
  this.env.addEventListener('deviceorientation',this.listener);this.listening=true;
  this.timer=this.env.setTimeout(()=>{if(!this.samples.length)onStatus('沒有收到感測資料。請確認 Safari 權限，或改用手動輸入。');},4000);
 }
 stopSensor(){this.token++;if(this.listener)this.env.removeEventListener('deviceorientation',this.listener);if(this.timer)this.env.clearTimeout(this.timer);this.listener=null;this.listening=false;this.samples=[];}
 async startCamera(){
  this.stopCamera();const token=this.cameraToken;
  if(!this.env.isSecureContext||!this.env.mediaDevices?.getUserMedia)throw Error('目前無法使用相機。請改用 HTTPS Safari，或使用照片選擇器。');
  const stream=await this.env.mediaDevices.getUserMedia({video:{facingMode:{exact:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
  if(token!==this.cameraToken){stream.getTracks().forEach(t=>t.stop());return null;}
  if(stream.getVideoTracks()[0]?.getSettings?.().facingMode==='user'){stream.getTracks().forEach(t=>t.stop());throw Error('偵測到前鏡頭。傾角瞄準需使用後鏡頭，請改用照片選擇器。');}
  this.stream=stream;return stream;
 }
 stopCamera(){this.cameraToken=(this.cameraToken||0)+1;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;}
 stop(){this.stopSensor();this.stopCamera();}
}
