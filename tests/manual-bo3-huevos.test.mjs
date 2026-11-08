import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeManualGame,manualSeriesPf} from '../manual-rules.js';
import {renderBattlesManual,renderEggsManual} from '../app.js';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../migracion_bo3_huevos_manuales_2026_11_08.sql',import.meta.url),'utf8');

test('formulario manual valida ganador, ronda y KO, incluido forfeit',()=>{
  assert.deepEqual(normalizeManualGame({gameNo:'2',winnerSlot:'1',kos1:'3',kos2:'2',forfeit:true}),
    {game_no:2,winner_slot:1,kos_1:3,kos_2:2,forfeit:true});
  for(const gameNo of [0,4,NaN])assert.throws(()=>normalizeManualGame({gameNo,winnerSlot:1,kos1:1,kos2:0}));
  for(const winnerSlot of [0,3,'abc'])assert.throws(()=>normalizeManualGame({gameNo:1,winnerSlot,kos1:1,kos2:0}));
  for(const kos1 of [-1,7,1.5,'aa'])assert.throws(()=>normalizeManualGame({gameNo:1,winnerSlot:1,kos1,kos2:0}));
});

test('dos forfaits y tercera partida normal: 6 PF fijas al ganador y KO al resto',()=>{
  const games=[
    {forfeit:true,winner_slot:1,kos_1:3,kos_2:4},
    {forfeit:true,winner_slot:2,kos_1:2,kos_2:1},
    {forfeit:false,winner_slot:1,kos_1:6,kos_2:5}
  ];
  assert.equal(manualSeriesPf(games,1),14); // 6 + 2 + 6
  assert.equal(manualSeriesPf(games,2),15); // 4 + 6 + 5
  assert.equal(manualSeriesPf(games,1,2),18); // 6 + 4 + 12 = 22, tope 18
  assert.equal(manualSeriesPf([{forfeit:true,winner_slot:1,kos_1:5,kos_2:0}],1),6);
});

test('interfaz usa únicamente los formularios manuales en las páginas activas',()=>{
  assert.match(app,/combates:renderBattlesManual/);
  assert.match(app,/huevos:renderEggsManual/);
  assert.match(app,/id="manual-game-form"/);
  assert.match(app,/id="manual-egg-form"/);
  assert.match(app,/register_manual_game/);
  assert.match(app,/approve_manual_bo3_eggs/);
  assert.match(app,/claim_manual_egg/);
  assert.match(app,/no se suben ni guardan enlaces o archivos de replay/i);
});

test('SQL: resultados nuevos no contienen URL ni contenido de replay',()=>{
  const m=sql.match(/CREATE OR REPLACE FUNCTION public\.register_manual_game\([\s\S]*?(?=\nREVOKE ALL ON FUNCTION public\.register_manual_game)/);
  assert.ok(m);
  assert.match(m[0],/\x27manual-\x27 \|\| gen_random_uuid\(\)::text,\x27\x27/);
  assert.match(m[0],/\x27\[\]\x27::jsonb/);
  assert.match(sql,/DROP POLICY IF EXISTS "games add" ON public\.replay_games/);
  assert.match(m[0],/p_game_no<>v_count\+1/);
});

test('SQL: cierra BO3 confirmado, paga 6 por forfeit y no concede huevos automáticamente',()=>{
  const m=sql.match(/CREATE OR REPLACE FUNCTION public\.finalize_series\([\s\S]*?(?=\nREVOKE ALL ON FUNCTION public\.finalize_series)/);
  assert.ok(m);
  assert.match(m[0],/public\.replay_confirmations/);
  assert.match(m[0],/THEN 6 ELSE kos_1\*v_rate END/);
  assert.match(m[0],/THEN 6 ELSE kos_2\*v_rate END/);
  assert.match(m[0],/least\(18,/);
  assert.doesNotMatch(m[0],/\x27egg\x27/);
  assert.match(sql,/DROP TRIGGER IF EXISTS locke_bo3_egg_rewards/);
  assert.match(sql,/DROP TRIGGER IF EXISTS locke_bo3_forfeit_pfs/);
});

test('SQL: dos aprobaciones manuales para 2/4 créditos, sin duplicar los existentes',()=>{
  const m=sql.match(/CREATE OR REPLACE FUNCTION public\.approve_manual_bo3_eggs\([\s\S]*?(?=\nREVOKE ALL ON FUNCTION public\.approve_manual_bo3_eggs)/);
  assert.ok(m);
  assert.match(m[0],/v_approvals=2/);
  assert.match(m[0],/generate_series\(1,2\)/);
  assert.match(m[0],/generate_series\(1,4\)/);
  assert.match(m[0],/ON CONFLICT\(player_id,type,source_key\) DO NOTHING/);
  assert.match(m[0],/type='egg' AND source_key LIKE/);
});

test('SQL: solo el dueño puede reclamar su huevo con crédito, y se desactiva el sorteo',()=>{
  const m=sql.match(/CREATE OR REPLACE FUNCTION public\.claim_manual_egg\([\s\S]*?(?=\nREVOKE ALL ON FUNCTION public\.claim_manual_egg)/);
  assert.ok(m);
  assert.match(m[0],/owner_id=v_owner AND is_egg=true AND present=true AND claimed=false/);
  assert.match(m[0],/player_id=v_owner AND type='egg' AND used_at IS NULL/);
  assert.match(m[0],/FOR UPDATE LIMIT 1/);
  assert.match(m[0],/UPDATE public\.reward_credits SET used_at=now\(\)/);
  assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.draw_weighted_egg\(\)/);
});

test('vistas manuales generan sus formularios sin depender del navegador ni de replays',()=>{
  const battleHtml=renderBattlesManual();
  const eggHtml=renderEggsManual();
  assert.match(battleHtml,/id="manual-game-form"/);
  assert.doesNotMatch(battleHtml,/id="replay-form"/);
  assert.match(eggHtml,/id="manual-egg-form"/);
  assert.doesNotMatch(eggHtml,/data-action="draw-egg"/);
});
