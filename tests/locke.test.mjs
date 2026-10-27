import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalZone, locationName, mapStatusLabel, encounterMethod,
  decodePK6, parseSave, calcStats, planCaptureRoutes,
  getReplayId, interpretReplay, HOENN_ATLAS, BOSSES
} from '../app.js';

// Pruebas sin red, credenciales ni archivos main personales. Se usa PK6 sintético.
const write16=(a,i,v)=>{a[i]=v&255;a[i+1]=(v>>>8)&255};
const write32=(a,i,v)=>{a[i]=v&255;a[i+1]=(v>>>8)&255;a[i+2]=(v>>>16)&255;a[i+3]=(v>>>24)&255};

function dummyPK6(){
 const b=new Uint8Array(232);
 write32(b,0,0x12345678); // Encryption constant (EC)
 write16(b,8,25); // species = Pikachu, solo para probar el decodificador local
 write32(b,0x18,0xabc12345);
 write16(b,0xda,204); // Ruta 101
 b[0xdd]=5;
 write16(b,0x40,'A'.charCodeAt(0));
 let check=0;
 for(let i=8;i<232;i+=2)check=(check+(b[i]|b[i+1]<<8))&65535;
 write16(b,6,check);
 return b;
}

test('catálogo de Hoenn: 69 claves únicas, 34 rutas y coordenadas válidas',()=>{
 assert.equal(HOENN_ATLAS.length,69);
 const keys=HOENN_ATLAS.map(z=>z.key);
 assert.equal(new Set(keys).size,69);
 for(let i=101;i<=134;i++)assert.ok(keys.includes(`Ruta ${i}`));
 for(const z of HOENN_ATLAS){
  assert.ok(['route','water','city','special'].includes(z.kind),z.key);
  assert.ok([z.x,z.y,z.w,z.h].every(Number.isFinite),z.key);
  assert.ok(z.w>0&&z.h>0,z.key);
 }
});

test('nombres canónicos mantienen las claves de capturas anteriores',()=>{
 assert.equal(canonicalZone(' Pueblo Lavacalda '),'Ciudad Lavacalda');
 assert.equal(canonicalZone('Túnel Fervergal'),'Túnel Fervegal');
 assert.equal(canonicalZone('Ruta 101'),'Ruta 101');
});

test('ubicaciones de PK6: rutas, aliases y lugares desconocidos',()=>{
 assert.equal(locationName(204),'Ruta 101');
 assert.equal(locationName(270),'Ruta 134');
 assert.equal(locationName(176),'Ciudad Lavacalda');
 assert.equal(locationName(274),'Túnel Fervegal');
 assert.equal(locationName(999),'Lugar #999');
});

test('estados y métodos públicos tienen etiquetas comprensibles',()=>{
 assert.equal(mapStatusLabel('captured'),'Capturada');
 assert.equal(mapStatusLabel('failed'),'Fallida');
 assert.equal(mapStatusLabel('free'),'Disponible');
 assert.equal(mapStatusLabel('unknown'),'Sin verificar');
 assert.equal(encounterMethod('surf'),'Surf');
 assert.equal(encounterMethod('fish'),'Pesca');
 assert.equal(encounterMethod('grass'),'Hierba');
 assert.equal(encounterMethod('not-a-method'),'Por confirmar');
});

test('PK6: rechaza bloques de longitud inesperada y vacíos',()=>{
 assert.throws(()=>decodePK6(new Uint8Array(231)),/longitud/);
 assert.equal(decodePK6(new Uint8Array(232)),null);
});

test('PK6: decodifica campos básicos sin importar una partida privada',()=>{
 const pk=decodePK6(dummyPK6());
 assert.ok(pk);
 assert.equal(pk.species,25);
 assert.equal(pk.nickname,'A');
 assert.equal(pk.met_level,5);
 assert.equal(pk.met_location,204);
 assert.equal(pk.is_egg,false);
 assert.equal(pk.egg_location,0);
 assert.equal(pk.ivs.length,6);
});

test('main: tamaño erróneo y guardado vacío se rechazan',()=>{
 assert.throws(()=>parseSave(new Uint8Array(10)),/483.328/);
 assert.throws(()=>parseSave(new Uint8Array(0x76000)),/No se encontró ningún Pokémon válido/);
});

test('estadísticas al nivel de captura: valores de una naturaleza neutra',()=>{
 const base={hp:45,atk:49,def:49,spa:65,spd:65,spe:45};
 assert.deepEqual(calcStats(base,5,[0,0,0,0,0,0],0),[19,9,9,11,11,9]);
 assert.equal(calcStats(null,5,[0,0,0,0,0,0],0),null);
});

test('naturalezas: suben y bajan las estadísticas correctas',()=>{
 const base={hp:100,atk:100,def:100,spa:100,spd:100,spe:100};
 const ivs=[31,31,31,31,31,31];
 const neutral=calcStats(base,50,ivs,0);
 const adamant=calcStats(base,50,ivs,3); // Firme: +Ataque, -Ataque especial
 assert.equal(adamant[1],Math.floor(neutral[1]*1.1));
 assert.equal(adamant[3],Math.floor(neutral[3]*0.9));
 assert.equal(adamant[0],neutral[0]);
});

test('capturas: propuestas sin confirmación automática; huevos y regalos excluidos',()=>{
 const wild={is_egg:false,egg_location:0,met_location:204,nickname:'Uno'};
 const other={is_egg:false,egg_location:0,met_location:206,nickname:'Dos'};
 const gifted={is_egg:false,egg_location:170,met_location:204,nickname:'Regalo'};
 const egg={is_egg:true,egg_location:204,met_location:204,nickname:'Huevo'};
 const unknown={is_egg:false,egg_location:0,met_location:999,nickname:'Desconocido'};
 const save={party:[wild,gifted,egg,unknown],pc:[other,{...other,nickname:'Tres'}]};
 const routes=planCaptureRoutes(save,new Set(),{});
 assert.deepEqual(routes.map(r=>r.zone_key).sort(),['Ruta 101','Ruta 102']);
 for(const r of routes){
  assert.equal(r.status,'unknown');
  assert.equal(r.nickname,'');
  assert.equal(r.stat_total,null);
 }
 assert.deepEqual(planCaptureRoutes(save,new Set(['Ruta 101','Ruta 102']),{}),[]);
});

test('replays: acepta solamente URL de replay.pokemonshowdown.com',()=>{
 assert.equal(getReplayId('https://replay.pokemonshowdown.com/gen6ou-123456789'), 'gen6ou-123456789');
 assert.equal(getReplayId('https://replay.pokemonshowdown.com/gen6ou-123456789.json'), 'gen6ou-123456789');
 assert.throws(()=>getReplayId('https://replay.pokemonshowdown.com.evil.example/gen6ou-1'),/replay.pokemonshowdown.com/);
 assert.throws(()=>getReplayId('https://psim.us/r/battle-test'),/replay.pokemonshowdown.com/);
});

test('replays: lee vencedor, bajas y datos públicos revelados',()=>{
 const log=[
  '|player|p1|Varo|',
  '|player|p2|Rival|',
  '|poke|p1|Pikachu, M|',
  '|poke|p2|Eevee, F|',
  '|switch|p1a: Chispa|Pikachu, M|100/100',
  '|switch|p2a: Nube|Eevee, F|100/100',
  '|move|p1a: Chispa|Thunderbolt|p2a: Nube',
  '|faint|p2a: Nube',
  '|win|Varo'
 ].join('\n');
 const r=interpretReplay({log});
 assert.equal(r.winner,'Varo');
 assert.equal(r.ko.p1,1);
 assert.equal(r.ko.p2,0);
 assert.ok(r.reveals.some(m=>m.side==='p1'&&m.nickname==='Chispa'&&m.moves.includes('Thunderbolt')));
 assert.throws(()=>interpretReplay({log:'|player|p1|Varo\n|win|Varo'}),/dos jugadores/);
});


test('límites RO_2.0 para gimnasios: resto pendiente',()=>{
  assert.deepEqual(BOSSES.map(x=>x[1]),[18,21,27,36,39,46,59,60,48,52,53,54,55,59]);
});
