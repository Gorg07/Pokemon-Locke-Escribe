import test from 'node:test';
import assert from 'node:assert/strict';
import {ORAS_BASE_STATS,getOrasBaseStats} from '../oras-base-stats.js';

test('721 especies ORAS con baseStats numéricas; sin secretos',()=>{
 assert.equal(ORAS_BASE_STATS.length,722);
 for(let id=1;id<=721;id++){
  const stats=ORAS_BASE_STATS[id];
  assert.equal(stats.length,6,`especie ${id}`);
  assert.ok(stats.every(v=>Number.isInteger(v)&&v>0&&v<=255),`especie ${id}`);
 }
});
test('ejemplos de estadísticas ORAS y Slaking 670 BST',()=>{
 assert.deepEqual(getOrasBaseStats(25),{hp:35,atk:55,def:40,spa:50,spd:50,spe:90});
 assert.equal(ORAS_BASE_STATS[289].reduce((a,b)=>a+b,0),670);
 assert.equal(getOrasBaseStats(999,'alternativo'),'alternativo');
});
