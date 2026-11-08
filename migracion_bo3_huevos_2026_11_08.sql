-- Locke Escribe · Recompensas BO3 (08/11/2026)
-- Regla: 2 huevos para el ganador y 4 para el perdedor.
-- Conserva Pokéfichas por KO y una captura extraordinaria por jugador.
-- No modifica las series finalizadas antes de esta migración.
-- Se apoya en finalize_series() de v2.0: ya concede 1 huevo al ganador
-- con source_key = 'series:<uuid>' y ON CONFLICT DO NOTHING.
-- La primera inserción aquí reutiliza esa clave y evita duplicarlo.

BEGIN;

DO $verify$
DECLARE v_def text;
BEGIN
  IF to_regclass('public.reward_credits') IS NULL
     OR to_regclass('public.replay_games') IS NULL
     OR to_regclass('public.combat_series') IS NULL
     OR to_regclass('public.players') IS NULL THEN
    RAISE EXCEPTION 'Faltan tablas necesarias. No se aplica la migración BO3.';
  END IF;
  IF to_regprocedure('public.finalize_series(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Falta finalize_series(uuid). No se aplica la migración BO3.';
  END IF;
  v_def := pg_get_functiondef('public.finalize_series(uuid)'::regprocedure);
  IF position('(v_winner,''egg'',''series:''||p_series_id)'
       in regexp_replace(lower(v_def), '[[:space:]]+', '', 'g')) = 0
     OR position('reward_credits' in lower(v_def)) = 0
     OR position('on conflict do nothing' in lower(v_def)) = 0 THEN
    RAISE EXCEPTION 'finalize_series difiere de la versión esperada. Revisar antes de aplicar.';
  END IF;
END;
$verify$;

CREATE OR REPLACE FUNCTION private.grant_bo3_egg_rewards()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_winner uuid;
  v_loser uuid;
BEGIN
  -- finalize_series() valida antes los replays, el BO3 y las dos confirmaciones.
  SELECT g.winner_id INTO v_winner
  FROM public.replay_games AS g
  WHERE g.series_id = NEW.id
  GROUP BY g.winner_id
  HAVING count(*) >= 2;

  SELECT p.user_id INTO v_loser
  FROM public.players AS p
  WHERE p.slot IN (1,2) AND p.user_id <> v_winner;

  IF v_winner IS NULL OR v_loser IS NULL THEN
    RAISE EXCEPTION 'Serie BO3 sin ganador o rival válidos';
  END IF;

  -- Dos huevos al ganador. El primero comparte la clave con el premio antiguo:
  -- la inserción posterior de finalize_series() se ignora por la restricción UNIQUE.
  INSERT INTO public.reward_credits (player_id,type,source_key) VALUES
    (v_winner,'egg','series:' || NEW.id::text),
    (v_winner,'egg','series:' || NEW.id::text || ':bo3:egg:2')
  ON CONFLICT (player_id,type,source_key) DO NOTHING;

  -- Cuatro huevos al perdedor: dos comunes y dos de compensación.
  INSERT INTO public.reward_credits (player_id,type,source_key)
  SELECT v_loser,'egg','series:' || NEW.id::text || ':bo3:egg:loser:' || i::text
  FROM generate_series(1,4) AS i
  ON CONFLICT (player_id,type,source_key) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.grant_bo3_egg_rewards() FROM PUBLIC;
DROP TRIGGER IF EXISTS locke_bo3_egg_rewards ON public.combat_series;
CREATE TRIGGER locke_bo3_egg_rewards
AFTER UPDATE OF status ON public.combat_series
FOR EACH ROW
WHEN (OLD.status = 'open' AND NEW.status = 'finished')
EXECUTE FUNCTION private.grant_bo3_egg_rewards();

COMMIT;
