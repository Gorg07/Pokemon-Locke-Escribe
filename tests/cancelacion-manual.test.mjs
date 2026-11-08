import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../migracion_cancelacion_manual_bo3_2026_11_08.sql',import.meta.url),'utf8');

test('BO3 manual: confirmar y cancelar resultados pendientes, con su manejador',()=>{
  assert.match(app,/data-confirm-replay=/);
  assert.match(app,/data-cancel-manual-game=/);
  assert.match(app,/\[data-cancel-manual-game\]/);
  assert.match(app,/rpc\('cancel_manual_game',\{p_game_id:id\}\)/);
  assert.match(app,/approved\.length<2/);
  assert.match(app,/g===games\[games\.length-1\]/);
});

test('Huevos manuales: confirmar o cancelar una propuesta no concedida',()=>{
  assert.match(app,/data-approve-eggs=/);
  assert.match(app,/data-cancel-eggs=/);
  assert.match(app,/\[data-cancel-eggs\]/);
  assert.match(app,/rpc\('cancel_manual_bo3_eggs',\{p_series_id:id\}\)/);
  assert.match(app,/approvals\.length\?/);
});

test('SQL: cancelar combate exige serie abierta, resultado manual, última partida y menos de dos confirmaciones',()=>{
  const fn=sql.match(/CREATE OR REPLACE FUNCTION public\.cancel_manual_game\([\s\S]*?(?=\nREVOKE ALL ON FUNCTION public\.cancel_manual_game)/)?.[0];
  assert.ok(fn);
  assert.match(fn,/private\.is_member\(\)/);
  assert.match(fn,/FOR UPDATE/);
  assert.match(fn,/v_status<>'open'/);
  assert.match(fn,/left\(v_replay_id,7\)<>'manual-'/);
  assert.match(fn,/game_no>v_game_no/);
  assert.match(fn,/v_confirmations>=2/);
  assert.match(fn,/DELETE FROM public\.replay_confirmations/);
  assert.match(fn,/DELETE FROM public\.replay_games/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.cancel_manual_game\(uuid\) TO authenticated/);
});

test('SQL: cancelar huevos solo elimina aprobaciones pendientes, no créditos ni partidas',()=>{
  const fn=sql.match(/CREATE OR REPLACE FUNCTION public\.cancel_manual_bo3_eggs\([\s\S]*?(?=\nREVOKE ALL ON FUNCTION public\.cancel_manual_bo3_eggs)/)?.[0];
  assert.ok(fn);
  assert.match(fn,/private\.is_member\(\)/);
  assert.match(fn,/FOR UPDATE/);
  assert.match(fn,/v_status<>'finished'/);
  assert.match(fn,/public\.reward_credits/);
  assert.match(fn,/DELETE FROM public\.manual_egg_approvals/);
  assert.doesNotMatch(fn,/DELETE FROM public\.reward_credits/);
  assert.doesNotMatch(fn,/DELETE FROM public\.replay_games/);
});
