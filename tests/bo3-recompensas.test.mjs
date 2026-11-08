import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Contrato estático. La ejecución en PostgreSQL/Supabase requiere una prueba aparte.
const sql = readFileSync(new URL('../migracion_bo3_huevos_2026_11_08.sql', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('BO3: la interfaz anuncia 2 huevos al ganador y 4 al perdedor', () => {
  assert.match(app, /2 huevos para el ganador y 4 para el perdedor/);
  assert.doesNotMatch(app, /\+1 huevo al ganador/);
});

test('BO3: los créditos solo se conceden al cerrar una serie nueva', () => {
  assert.match(sql, /AFTER UPDATE OF status ON public\.combat_series/);
  assert.match(sql, /OLD\.status = 'open' AND NEW\.status = 'finished'/);
  assert.match(sql, /ON CONFLICT \(player_id,type,source_key\) DO NOTHING/g);
  assert.doesNotMatch(sql, /UPDATE public\.combat_series SET status/);
});

test('BO3: dos créditos al ganador y cuatro al perdedor sin duplicar el crédito heredado', () => {
  assert.match(sql, /\(v_winner,'egg','series:' \|\| NEW\.id::text\)/);
  assert.match(sql, /\(v_winner,'egg','series:' \|\| NEW\.id::text \|\| ':bo3:egg:2'\)/);
  assert.match(sql, /generate_series\(1,4\)/);
});
