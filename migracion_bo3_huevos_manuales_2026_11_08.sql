-- Locke Escribe · Registro manual BO3 y huevos manuales · 08/11/2026
-- Conserva series, créditos, sorteos, compras y datos históricos anteriores.
-- IMPORTANTE: revisar antes en Supabase; la función finalize_series debe ser la de v2.0.
BEGIN;

DO $verify$
DECLARE v_def text;
BEGIN
 IF to_regclass('public.players') IS NULL OR
    to_regclass('public.combat_series') IS NULL OR
    to_regclass('public.replay_games') IS NULL OR
    to_regclass('public.replay_confirmations') IS NULL OR
    to_regclass('public.reward_credits') IS NULL OR
    to_regclass('public.money_events') IS NULL OR
    to_regclass('public.egg_claims') IS NULL OR
    to_regclass('public.private_pokemon') IS NULL OR
    to_regprocedure('public.finalize_series(uuid)') IS NULL OR
    to_regprocedure('public.confirm_replay_v20(uuid)') IS NULL OR
    to_regprocedure('public.draw_weighted_egg()') IS NULL THEN
   RAISE EXCEPTION 'Falta el esquema de BO3, confirmaciones o huevos requerido. No se modifica nada.';
 END IF;
 v_def := lower(pg_get_functiondef('public.finalize_series(uuid)'::regprocedure));
 IF position('replay_confirmations' in v_def)=0 OR
    position('money_events' in v_def)=0 OR
    position('reward_credits' in v_def)=0 OR
    position('update public.combat_series' in v_def)=0 THEN
   RAISE EXCEPTION 'finalize_series ha cambiado. Revisar el SQL desplegado antes de continuar.';
 END IF;
END;
$verify$;

-- Mantener compatible el esquema preexistente y los datos de partidas anteriores.
ALTER TABLE public.replay_games
  ADD COLUMN IF NOT EXISTS ended_by_forfeit boolean NOT NULL DEFAULT false;
-- Desactivar la concesión antigua de huevos y el suplemento de PF por forfeit:
-- ambos se gestionan de otra forma más abajo, evitando pagos dobles.
DROP TRIGGER IF EXISTS locke_bo3_egg_rewards ON public.combat_series;
DROP TRIGGER IF EXISTS locke_bo3_forfeit_pfs ON public.combat_series;
-- Los clientes no pueden crear resultados arbitrarios mediante REST; solo el RPC validado.
DROP POLICY IF EXISTS "games add" ON public.replay_games;

-- Requiere 2 jugadores distintos para aprobar cada entrega manual de huevos.
CREATE TABLE IF NOT EXISTS public.manual_egg_approvals (
  series_id uuid NOT NULL REFERENCES public.combat_series(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(user_id),
  approved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(series_id,player_id)
);
ALTER TABLE public.manual_egg_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read manual egg approvals" ON public.manual_egg_approvals;
CREATE POLICY "read manual egg approvals" ON public.manual_egg_approvals
 FOR SELECT TO authenticated USING (private.is_member());
REVOKE ALL ON public.manual_egg_approvals FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.manual_egg_approvals TO authenticated;

-- Registro manual sin pedir, descargar ni guardar replay alguno.
-- Se utiliza replay_games para conservar integridad de la BD e historial previo:
-- las filas nuevas solo contienen resultado/KO y un identificador interno.
CREATE OR REPLACE FUNCTION public.register_manual_game(
 p_series_id uuid,p_game_no integer,p_winner_slot integer,
 p_kos_1 integer,p_kos_2 integer,p_forfeit boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_id uuid;
 v_status text;
 v_count integer;
 v_winner uuid;
 v_name text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_member() THEN RAISE EXCEPTION 'Cuenta no autorizada'; END IF;
 IF p_series_id IS NULL OR p_game_no IS NULL OR p_game_no NOT BETWEEN 1 AND 3 OR
    p_winner_slot IS NULL OR p_winner_slot NOT IN (1,2) OR
    p_kos_1 IS NULL OR p_kos_1 NOT BETWEEN 0 AND 6 OR
    p_kos_2 IS NULL OR p_kos_2 NOT BETWEEN 0 AND 6 OR
    p_forfeit IS NULL THEN
   RAISE EXCEPTION 'Resultado manual inválido';
 END IF;
 SELECT status INTO v_status FROM public.combat_series WHERE id=p_series_id FOR UPDATE;
 IF NOT FOUND OR v_status<>'open' THEN RAISE EXCEPTION 'Serie inexistente o ya finalizada'; END IF;
 SELECT count(*) INTO v_count FROM public.replay_games WHERE series_id=p_series_id;
 IF p_game_no<>v_count+1 THEN RAISE EXCEPTION 'Registra las partidas BO3 en orden y sin repetir'; END IF;
 IF EXISTS (SELECT 1 FROM public.replay_games WHERE series_id=p_series_id
    GROUP BY winner_id HAVING count(*)>=2) THEN
   RAISE EXCEPTION 'La serie ya tiene un ganador; no se admiten más combates';
 END IF;
 SELECT user_id,display_name INTO v_winner,v_name
 FROM public.players WHERE slot=p_winner_slot;
 IF v_winner IS NULL OR (SELECT count(*) FROM public.players WHERE slot IN (1,2))<>2 THEN
   RAISE EXCEPTION 'Los dos jugadores deben estar configurados';
 END IF;
 INSERT INTO public.replay_games(series_id,game_no,replay_id,replay_url,
   winner_id,winner_name,kos_1,kos_2,ended_by_forfeit,reveals)
 VALUES(p_series_id,p_game_no,'manual-' || gen_random_uuid()::text,'',
   v_winner,v_name,p_kos_1,p_kos_2,p_forfeit,'[]'::jsonb)
 RETURNING id INTO v_id;
 RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.register_manual_game(uuid,integer,integer,integer,integer,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_manual_game(uuid,integer,integer,integer,integer,boolean)
 TO authenticated;

-- Cierre BO3: se conserva la validación de DOS confirmaciones por combate.
-- Solo cambia cómo se calculan las PF del forfeit y se elimina el huevo automático.
CREATE OR REPLACE FUNCTION public.finalize_series(p_series_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_status text;
 v_p1 uuid;v_p2 uuid;
 v_win1 integer;v_win2 integer;v_count integer;
 v_seq integer[];
 v_rate integer;
 v_pf1 integer;v_pf2 integer;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_member() THEN RAISE EXCEPTION 'Cuenta no autorizada'; END IF;
 SELECT status INTO v_status FROM public.combat_series WHERE id=p_series_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Serie no encontrada'; END IF;
 IF v_status='finished' THEN RETURN 'Ya finalizada'; END IF;
 SELECT user_id INTO v_p1 FROM public.players WHERE slot=1;
 SELECT user_id INTO v_p2 FROM public.players WHERE slot=2;
 IF v_p1 IS NULL OR v_p2 IS NULL THEN RAISE EXCEPTION 'Se necesitan dos jugadores'; END IF;
 IF EXISTS(SELECT 1 FROM public.replay_games g WHERE g.series_id=p_series_id
   AND (g.winner_id NOT IN(v_p1,v_p2) OR
     (SELECT count(*) FROM public.replay_confirmations c WHERE c.game_id=g.id
       AND c.player_id IN(v_p1,v_p2))<>2)) THEN
   RAISE EXCEPTION 'Ambos deben confirmar todos los resultados';
 END IF;
 SELECT count(*) FILTER (WHERE winner_id=v_p1),
        count(*) FILTER (WHERE winner_id=v_p2), count(*),
        array_agg(game_no::integer ORDER BY game_no)
 INTO v_win1,v_win2,v_count,v_seq FROM public.replay_games
 WHERE series_id=p_series_id;
 IF v_count NOT IN (2,3) OR
    v_seq<>(CASE WHEN v_count=2 THEN ARRAY[1,2] ELSE ARRAY[1,2,3] END) OR
    NOT ((v_win1=2 AND v_win2=v_count-2) OR (v_win2=2 AND v_win1=v_count-2)) THEN
   RAISE EXCEPTION 'Resultados BO3 incompletos o inconsistentes';
 END IF;
 IF v_count=3 AND EXISTS(SELECT 1 FROM public.replay_games
   WHERE series_id=p_series_id AND game_no<=2
   GROUP BY winner_id HAVING count(*)=2) THEN
   RAISE EXCEPTION 'No puede existir tercer combate después de un 2-0';
 END IF;
 SELECT ko_pf INTO STRICT v_rate FROM public.config WHERE id=1;
 SELECT least(18,coalesce(sum(CASE WHEN ended_by_forfeit AND winner_id=v_p1
      THEN 6 ELSE kos_1*v_rate END),0)),
        least(18,coalesce(sum(CASE WHEN ended_by_forfeit AND winner_id=v_p2
      THEN 6 ELSE kos_2*v_rate END),0))
 INTO v_pf1,v_pf2 FROM public.replay_games WHERE series_id=p_series_id;
 UPDATE public.combat_series SET status='finished',finished_at=now()
 WHERE id=p_series_id;
 IF v_pf1>0 THEN
   INSERT INTO public.money_events(player_id,amount,kind,source_key)
   VALUES(v_p1,v_pf1,'BO3 manual','series:'||p_series_id::text||':kos:1')
   ON CONFLICT(player_id,source_key) DO NOTHING;
 END IF;
 IF v_pf2>0 THEN
   INSERT INTO public.money_events(player_id,amount,kind,source_key)
   VALUES(v_p2,v_pf2,'BO3 manual','series:'||p_series_id::text||':kos:2')
   ON CONFLICT(player_id,source_key) DO NOTHING;
 END IF;
 -- La captura extraordinaria permanece automática, como en la regla anterior.
 INSERT INTO public.reward_credits(player_id,type,source_key) VALUES
 (v_p1,'capture','series:'||p_series_id::text),
 (v_p2,'capture','series:'||p_series_id::text)
 ON CONFLICT(player_id,type,source_key) DO NOTHING;
 -- Los huevos NO se conceden aquí: requieren aprobación manual de los dos.
 RETURN 'Serie completada; huevos pendientes de aprobación manual';
END;
$fn$;
REVOKE ALL ON FUNCTION public.finalize_series(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finalize_series(uuid) TO authenticated;

-- Doble aprobación manual de los créditos: ganador 2, perdedor 4.
-- No se duplican premios de series anteriores, aunque sus créditos ya estén usados.
CREATE OR REPLACE FUNCTION public.approve_manual_bo3_eggs(p_series_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_actor uuid:=auth.uid();
 v_status text;
 v_winner uuid;v_loser uuid;
 v_approvals integer;
BEGIN
 IF v_actor IS NULL OR NOT private.is_member() THEN RAISE EXCEPTION 'Cuenta no autorizada'; END IF;
 IF p_series_id IS NULL THEN RAISE EXCEPTION 'Serie no indicada'; END IF;
 SELECT status INTO v_status FROM public.combat_series WHERE id=p_series_id FOR UPDATE;
 IF NOT FOUND OR v_status<>'finished' THEN RAISE EXCEPTION 'La serie todavía no está finalizada'; END IF;
 IF EXISTS(SELECT 1 FROM public.reward_credits
   WHERE type='egg' AND source_key LIKE ('series:'||p_series_id::text||'%')) THEN
   RAISE EXCEPTION 'Los huevos de esta serie ya fueron concedidos';
 END IF;
 SELECT winner_id INTO v_winner FROM public.replay_games WHERE series_id=p_series_id
 GROUP BY winner_id HAVING count(*)=2;
 IF v_winner IS NULL THEN RAISE EXCEPTION 'No hay un ganador BO3 válido'; END IF;
 SELECT user_id INTO v_loser FROM public.players WHERE slot IN (1,2) AND user_id<>v_winner;
 IF v_loser IS NULL OR v_actor NOT IN (v_winner,v_loser) THEN
   RAISE EXCEPTION 'Jugador no autorizado';
 END IF;
 INSERT INTO public.manual_egg_approvals(series_id,player_id)
 VALUES(p_series_id,v_actor) ON CONFLICT(series_id,player_id) DO NOTHING;
 SELECT count(*) INTO v_approvals FROM public.manual_egg_approvals
 WHERE series_id=p_series_id AND player_id IN(v_winner,v_loser);
 IF v_approvals=2 THEN
   INSERT INTO public.reward_credits(player_id,type,source_key)
   SELECT v_winner,'egg','series:'||p_series_id::text||':manual:w:'||i::text
   FROM generate_series(1,2) AS i
   UNION ALL
   SELECT v_loser,'egg','series:'||p_series_id::text||':manual:l:'||i::text
   FROM generate_series(1,4) AS i
   ON CONFLICT(player_id,type,source_key) DO NOTHING;
   RETURN '2 huevos para el ganador y 4 para el perdedor concedidos';
 END IF;
 RETURN 'Aprobación registrada. Falta la del otro jugador';
END;
$fn$;
REVOKE ALL ON FUNCTION public.approve_manual_bo3_eggs(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.approve_manual_bo3_eggs(uuid) TO authenticated;

-- Elección manual del huevo por su ubicación; jamás se revela la identidad de otro usuario.
CREATE OR REPLACE FUNCTION public.claim_manual_egg(p_box_num integer,p_slot_num integer)
RETURNS TABLE(box_num integer,slot_num integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_owner uuid:=auth.uid();
 v_credit uuid;
 v_key text;
 v_limit integer;
BEGIN
 IF v_owner IS NULL OR NOT private.is_member() THEN RAISE EXCEPTION 'Cuenta no autorizada'; END IF;
 IF p_box_num IS NULL OR p_box_num NOT BETWEEN 1 AND 29 OR
    p_slot_num IS NULL OR p_slot_num NOT BETWEEN 1 AND 30 THEN
   RAISE EXCEPTION 'Caja o posición fuera del intervalo permitido';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext(v_owner::text));
 SELECT id INTO v_credit FROM public.reward_credits
 WHERE player_id=v_owner AND type='egg' AND used_at IS NULL
 ORDER BY created_at,id LIMIT 1 FOR UPDATE;
 IF v_credit IS NULL THEN RAISE EXCEPTION 'No quedan créditos de huevo'; END IF;
 SELECT cap_bst INTO STRICT v_limit FROM public.config WHERE id=1;
 SELECT pokemon_key INTO v_key FROM public.private_pokemon
 WHERE owner_id=v_owner AND is_egg=true AND present=true AND claimed=false
   AND box_num=p_box_num AND slot_num=p_slot_num
   AND (bst<=v_limit OR species=289)
 FOR UPDATE LIMIT 1;
 IF v_key IS NULL THEN RAISE EXCEPTION 'No existe un huevo elegible en esa posición de tus cajas'; END IF;
 UPDATE public.private_pokemon SET claimed=true
 WHERE owner_id=v_owner AND pokemon_key=v_key;
 UPDATE public.reward_credits SET used_at=now() WHERE id=v_credit;
 INSERT INTO public.egg_claims(player_id,box_num,slot_num)
 VALUES(v_owner,p_box_num,p_slot_num);
 box_num:=p_box_num;slot_num:=p_slot_num;
 RETURN NEXT;
END;
$fn$;
REVOKE ALL ON FUNCTION public.claim_manual_egg(integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_manual_egg(integer,integer) TO authenticated;

-- Desactivar sorteos automáticos incluso en pestañas antiguas.
REVOKE EXECUTE ON FUNCTION public.draw_weighted_egg() FROM PUBLIC,anon,authenticated;
-- Refrescar la caché de funciones RPC de PostgREST.
NOTIFY pgrst, 'reload schema';
COMMIT;
