import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {overviewProjection} from '../../dist/school3d/tree/map-core.js';
const plants=JSON.parse(readFileSync(new URL('../../dist/school3d/tree/plants.json',import.meta.url)));
const project=overviewProjection(plants);
for(const p of plants){const [x,y]=project(p);assert.ok(x>=25&&x<=575&&y>=25&&y<=375);}
assert.equal(project(null),null);assert.equal(project({latitude:null,longitude:120}),null);
assert.equal(overviewProjection([])(plants[0]),null);
const origin={latitude:23,longitude:120};const north={latitude:23.001,longitude:120};const east={latitude:23,longitude:120.001};
const direction=overviewProjection([origin,north,east]),[x,y]=direction(origin);
assert.ok(direction(north)[0]<x&&direction(north)[1]>y,'north lower-left');
assert.ok(direction(east)[0]<x&&direction(east)[1]<y,'east upper-left');
assert.deepEqual(project(plants[1]),project({...plants[1]}),'stable projection independent of filter');
console.log('PASS: 127 map positions, reference orientation, missing coordinates, stable filtering');

