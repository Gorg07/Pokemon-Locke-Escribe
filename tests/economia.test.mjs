import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {repriceShopItem,extraLifePurchased} from '../economia-reglas.js';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const match=app.match(/SHOP = (\[\{.*?\}\]);\s*\n/s);
assert.ok(match,'Catálogo público');
const original=JSON.parse(match[1]);
const items=original.map(repriceShopItem);
const byId=id=>items.find(x=>x.id===id);

test('377 productos originales mantienen sus identificadores y categorías',()=>{
 assert.equal(items.length,377);
 assert.deepEqual(items.map(x=>x.id),original.map(x=>x.id));
});
test('economía de consumibles: bolas, repelentes, bayas y escamas',()=>{
 assert.deepEqual([byId(4).price,byId(4).quantity],[1,10]);
 assert.deepEqual([byId(317).price,byId(317).quantity],[1,30]);
 assert.deepEqual([byId(314).price,byId(314).quantity],[1,3]);
 for(const x of items.filter(x=>x.category.startsWith('Bayas'))){assert.equal(x.price,1);assert.equal(x.quantity,5);}
});
test('megapiedras, fósiles, evoluciones y recompensas',()=>{
 for(const x of items.filter(x=>x.category.startsWith('Megapiedras')))assert.equal(x.price,18);
 for(const x of items.filter(x=>x.category==='Fósiles (captura adicional)'))assert.equal(x.price,20);
 for(const x of items.filter(x=>x.category.startsWith('Evolución —')))assert.equal(x.price,1);
 for(const id of [84,85,144])assert.equal(byId(id).price,1);
 assert.equal(byId(15).price,14);
 assert.equal(repriceShopItem({id:378,category:'Recompensas',price:40,quantity:1}).price,30);
 assert.equal(repriceShopItem({id:379,category:'Recompensas',price:10,quantity:1}).price,10);
 assert.equal(repriceShopItem({id:380,category:'Entrenamiento — otros',price:3,quantity:1}).price,3);
});
test('precios ordinarios positivos y máximo de 24 PF',()=>{
 for(const x of items.filter(x=>x.category!=='Fósiles (captura adicional)')){
   assert.ok(x.price>=1&&x.price<=24,`${x.name}: ${x.price}`);
   assert.ok(x.quantity>=1,`${x.name}: cantidad inválida`);
 }
});
test('vida extra un solo evento de compra y del jugador correcto',()=>{
 const events=[{player_id:'A',item_id:379,kind:'compra'},{player_id:'B',item_id:378,kind:'compra'}];
 assert.equal(extraLifePurchased(events,'A'),true);
 assert.equal(extraLifePurchased(events,'B'),false);
 assert.equal(extraLifePurchased(events,'C'),false);
});
