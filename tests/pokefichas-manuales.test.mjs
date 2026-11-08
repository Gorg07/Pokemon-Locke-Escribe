import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../migracion_pokefichas_manuales_2026_11_08.sql',import.meta.url),'utf8');

test('Tienda: botón para sumar PF propias y formulario con motivo y cancelar',()=>{
  assert.match(app,/data-action="manual-pf"/);
  assert.match(app,/function addManualPf\(\)/);
  assert.match(app,/id="manual-pf-amount"[^>]*min="1"[^>]*max="100"/);
  assert.match(app,/id="manual-pf-reason"[^>]*required/);
  assert.match(app,/id="manual-pf-cancel"/);
  assert.match(app,/if\(a==='manual-pf'\)addManualPf\(\)/);
});

test('RPC: solicita solo las PF del usuario autenticado y registra un motivo',()=>{
  assert.match(app,/rpc\('add_manual_pf_v1',\{p_amount:amount,p_reason:reason,p_request_id:requestId\}\)/);
  assert.match(sql,/v_owner uuid := auth\.uid\(\)/);
  assert.match(sql,/private\.is_member\(\)/);
  assert.match(sql,/VALUES\(v_owner,p_amount,v_kind,v_key\)/);
  assert.match(sql,/v_kind := 'Ajuste manual: ' \|\| v_reason/);
  assert.match(sql,/p_amount NOT BETWEEN 1 AND 100/);
  assert.match(sql,/char_length\(v_reason\) NOT BETWEEN 3 AND 100/);
});

test('Operación idempotente y permisos: el servidor no acepta inserciones anónimas',()=>{
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/WHERE player_id=v_owner AND source_key=v_key/);
  assert.match(sql,/RETURN v_event\.id/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.add_manual_pf_v1\(integer,text,uuid\) FROM PUBLIC,anon/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.add_manual_pf_v1\(integer,text,uuid\) TO authenticated/);
  assert.doesNotMatch(sql,/\b(UPDATE|DELETE|TRUNCATE)\s+public\.money_events\b/i);
});
