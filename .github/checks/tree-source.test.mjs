import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {masterPlants,loadPlants,MASTER_URL} from '../../dist/school3d/tree/tree-source.js';
const fixture={points:[{id:'A',topic:'carbon',species:'樟樹',sourceStockCO2e:null,stock:99,latitude:23,longitude:120},{id:'B',topic:'birds'}]};
assert.equal(masterPlants(fixture).length,1);assert.equal(masterPlants(fixture)[0].sourceStockCO2e,null);
assert.throws(()=>masterPlants({points:[]}));assert.throws(()=>masterPlants({points:[fixture.points[0],fixture.points[0]]}));
let calls=[];let r=await loadPlants(async url=>{calls.push(url);return {ok:true,json:async()=>fixture};});assert.equal(r.live,true);assert.deepEqual(calls,[MASTER_URL]);
r=await loadPlants(async url=>{if(url===MASTER_URL)throw Error();return {ok:true,json:async()=>[{id:'backup'}]};});assert.equal(r.live,false);
console.log('PASS: master source, separate stock units, duplicate rejection and explicit backup');

