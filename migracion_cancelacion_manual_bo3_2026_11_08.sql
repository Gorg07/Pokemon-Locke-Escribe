-- Locke Escribe · Cancelación de resultados y propuestas manuales · 08/11/2026
-- Complemento a migracion_bo3_huevos_manuales_2026_11_08.sql.
-- No altera combates finalizados, compras, créditos ni huevos ya reclamados.
BEGIN;

DO $precheck$
BEGIN
  IF to_regclass('public.combat_series') IS NULL OR
     to_regclass('public.replay_games') IS NULL OR
     to_regclass('public.replay_confirmations') IS NULL OR
     to_regclass('public.manual_egg_approvals') IS NULL OR
     to_regclass('public.reward_credits') IS NULL OR
     to_regprocedure('public.register_manual_game(uuid,integer,integer,integer,integer,boolean)') IS NULL OR
     to_regprocedure('public.approve_manual_bo3_eggs(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Primero debes instalar la migración de BO3 y huevos manuales. No se modifica nada.';
  END IF;
END;
$precheck$;

-- Cualquiera de los dos jugadores puede cancelar el último resultado manual
-- pendiente de doble confirmación, por ejemplo si el rival discrepa de los KO.
-- El bloqueo de la serie evita que se confirme mientras se cancela.
CREATE OR REPLACE FUNCTION public.cancel_manual_game(p_game_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_series_id uuid;
  v_status text;
  v_game_no integer;
  v_replay_id text;
  v_confirmations integer;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_member() THEN
    RAISE EXCEPTION 'Cuenta no autorizada';
  END IF;
  IF p_game_id IS NULL THEN RAISE EXCEPTION 'Combate no indicado'; END IF;
  SELECT series_id INTO v_series_id
  FROM public.replay_games WHERE id=p_game_id;
  IF v_series_id IS NULL THEN RAISE EXCEPTION 'El combate ya no existe'; END IF;

  SELECT status INTO v_status FROM public.combat_series
  WHERE id=v_series_id FOR UPDATE;
  IF NOT FOUND OR v_status<>'open' THEN
    RAISE EXCEPTION 'No se puede cancelar un combate de una serie finalizada';
  END IF;
  SELECT game_no,replay_id INTO v_game_no,v_replay_id
  FROM public.replay_games WHERE id=p_game_id AND series_id=v_series_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El combate ya no existe'; END IF;
  IF left(v_replay_id,7)<>'manual-' THEN
    RAISE EXCEPTION 'Solo se pueden cancelar resultados manuales';
  END IF;
  IF EXISTS(SELECT 1 FROM public.replay_games
    WHERE series_id=v_series_id AND game_no>v_game_no) THEN
    RAISE EXCEPTION 'Cancela primero los combates posteriores';
  END IF;
  SELECT count(*) INTO v_confirmations FROM public.replay_confirmations
  WHERE game_id=p_game_id;
  IF v_confirmations>=2 THEN
    RAISE EXCEPTION 'El resultado ya fue confirmado por ambos jugadores';
  END IF;

  DELETE FROM public.replay_confirmations WHERE game_id=p_game_id;
  DELETE FROM public.replay_games WHERE id=p_game_id;
  RETURN 'Resultado manual pendiente cancelado';
END;
$fn$;
REVOKE ALL ON FUNCTION public.cancel_manual_game(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_manual_game(uuid) TO authenticated;

-- Mientras la entrega no se haya aprobado por ambos ni haya generado créditos,
-- cualquiera de los dos puede retirar la propuesta pendiente y sus aprobaciones.
CREATE OR REPLACE FUNCTION public.cancel_manual_bo3_eggs(p_series_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_status text;
  v_approvals integer;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_member() THEN
    RAISE EXCEPTION 'Cuenta no autorizada';
  END IF;
  IF p_series_id IS NULL THEN RAISE EXCEPTION 'Serie no indicada'; END IF;
  SELECT status INTO v_status FROM public.combat_series
  WHERE id=p_series_id FOR UPDATE;
  IF NOT FOUND OR v_status<>'finished' THEN
    RAISE EXCEPTION 'La serie no está finalizada';
  END IF;
  IF EXISTS(SELECT 1 FROM public.reward_credits
     WHERE type='egg' AND source_key LIKE ('series:'||p_series_id::text||'%')) THEN
    RAISE EXCEPTION 'Los huevos ya fueron concedidos; no se pueden cancelar';
  END IF;
  SELECT count(*) INTO v_approvals FROM public.manual_egg_approvals
  WHERE series_id=p_series_id;
  IF v_approvals=0 THEN
    RAISE EXCEPTION 'No hay ninguna propuesta de huevos pendiente';
  END IF;
  DELETE FROM public.manual_egg_approvals WHERE series_id=p_series_id;
  RETURN 'Entrega de huevos pendiente cancelada';
END;
$fn$;
REVOKE ALL ON FUNCTION public.cancel_manual_bo3_eggs(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_manual_bo3_eggs(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
