// Match the field.html reference direction; the image is contextual, not surveyed.
export function overviewProjection(plants){
 const valid=plants.filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude));
 if(!valid.length)return ()=>null;
 const lat=valid.reduce((s,p)=>s+p.latitude,0)/valid.length,lon=valid.reduce((s,p)=>s+p.longitude,0)/valid.length;
 const xy=p=>{const east=(p.longitude-lon)*111320*Math.cos(lat*Math.PI/180),north=(p.latitude-lat)*111320;return [-(east+north)*Math.SQRT1_2,(east-north)*Math.SQRT1_2];};
 const coords=valid.map(xy),xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);
 const minX=Math.min(...xs)-15,maxX=Math.max(...xs)+15,minY=Math.min(...ys)-15,maxY=Math.max(...ys)+15;
 const scale=Math.min(550/(maxX-minX),350/(maxY-minY));
 return p=>{if(!p||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude))return null;const [x,y]=xy(p);return [25+(x-minX)*scale,375-(y-minY)*scale];};
}
