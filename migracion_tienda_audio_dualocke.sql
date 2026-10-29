-- Locke Escribe · Ajustes propuestos por el segundo jugador (octubre 2026).
-- Ejecutar UNA VEZ tras aplicar el .patch de frontend, en el SQL Editor de Supabase.
-- Todos los cambios son transaccionales. No borra ni modifica compras antiguas.
-- Requiere la migración previa de reanimación con revival_redemptions instalada.
BEGIN;

DO $$ BEGIN
  IF to_regclass('public.revival_redemptions') IS NULL THEN
    RAISE EXCEPTION 'Falta la migración anterior de reanimación: revival_redemptions no existe';
  END IF;
  IF EXISTS (SELECT 1 FROM public.shop_catalog WHERE id=379 AND name<>'Vida adicional (una por partida)') THEN
    RAISE EXCEPTION 'El ID 379 está ocupado por otro objeto';
  END IF;
  IF EXISTS (SELECT 1 FROM public.shop_catalog WHERE id=380 AND name<>'Cápsula Habilidad') THEN
    RAISE EXCEPTION 'El ID 380 está ocupado por otro objeto';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shop_catalog WHERE id=378 AND name LIKE 'Revivir un Pokémon%') THEN
    RAISE EXCEPTION 'No se encontró el permiso de reanimación existente (ID 378)';
  END IF;
END $$;

-- El antiguo CHECK fijaba fósiles=25; sustituirlo ANTES de actualizar precios.
ALTER TABLE public.shop_catalog DROP CONSTRAINT IF EXISTS locke_tienda_escala_ro20;

UPDATE public.config SET egg_price=14 WHERE id=1;

UPDATE public.shop_catalog
SET price=CASE
  WHEN id=378 THEN 30
  WHEN category='Fósiles (captura adicional)' THEN 20
  WHEN category LIKE 'Bayas%' THEN 1
  WHEN category LIKE 'Megapiedras%' THEN 18
  WHEN name='Huevo aleatorio' THEN 14
  WHEN category LIKE 'Evolución — %' OR id IN (84,85,144) THEN 1
  WHEN category='Competitivo — élite' THEN CASE WHEN id IN (62,63,64,65,67) THEN 5 ELSE 13 END
  WHEN category='Competitivo — alto' THEN 12
  WHEN category='Competitivo — medio' THEN 7
  WHEN category='Específicos de especie' THEN 3
  WHEN category='MT' THEN 6
  WHEN category='Tesoros y reventa' THEN LEAST(price,15)
  ELSE GREATEST(1,LEAST(price,24)) END,
 quantity=CASE
  WHEN category LIKE 'Bayas%' THEN 5
  WHEN id=4 THEN 10
  WHEN id=317 THEN 30
  WHEN id=314 THEN 3
  ELSE quantity END
WHERE id BETWEEN 1 AND 378;
-- Escamas: lote de tres por 1 PF, no tres PF.
UPDATE public.shop_catalog SET price=1 WHERE id=314;
UPDATE public.shop_catalog SET name='Revivir un Pokémon (sin recuperar vida)' WHERE id=378;

INSERT INTO public.shop_catalog(id,name,category,price,quantity,available) VALUES
 (379,'Vida adicional (una por partida)','Recompensas',10,1,true),
 (380,'Cápsula Habilidad','Entrenamiento — otros',3,1,true)
ON CONFLICT(id) DO UPDATE SET
 name=excluded.name,category=excluded.category,price=excluded.price,
 quantity=excluded.quantity,available=excluded.available;

-- Un jugador puede recuperar como máximo dos Pokémon por partida.
-- El RPC de compra ya bloquea el saldo por jugador de forma serializada.
CREATE OR REPLACE FUNCTION public.locke_guard_revival_purchase_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.kind='compra' AND NEW.item_id=378 AND (
   SELECT COUNT(*) FROM public.money_events
   WHERE player_id=NEW.player_id AND kind='compra' AND item_id=378
 )>=2 THEN
   RAISE EXCEPTION 'Solo se permiten dos compras de reanimación por jugador y partida';
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS locke_guard_revival_purchase_v1 ON public.money_events;
CREATE TRIGGER locke_guard_revival_purchase_v1
 BEFORE INSERT ON public.money_events FOR EACH ROW
 EXECUTE FUNCTION public.locke_guard_revival_purchase_v1();
REVOKE ALL ON FUNCTION public.locke_guard_revival_purchase_v1() FROM PUBLIC, anon, authenticated;

-- Compra de vida adicional: una sola vez por jugador en la partida actual.
-- El reinicio oficial archiva y borra los money_events para empezar la siguiente partida.
-- Se mantiene buy_shop_item sin modificaciones: la misma transacción descuenta los PF.
CREATE UNIQUE INDEX IF NOT EXISTS life_bonus_once_per_run_v1
 ON public.money_events(player_id) WHERE kind='compra' AND item_id=379;

ALTER TABLE public.shop_catalog ADD CONSTRAINT locke_tienda_escala_audio_v1 CHECK (
 (id=378 AND price=30)
 OR (id=379 AND price=10)
 OR (id=380 AND price=3)
 OR (category='Fósiles (captura adicional)' AND price=20)
 OR (category LIKE 'Bayas%' AND price=1)
 OR (id NOT IN (378,379,380) AND category<>'Fósiles (captura adicional)'
     AND category NOT LIKE 'Bayas%' AND price BETWEEN 1 AND 24)
);

-- IMPORTANTE: revive un Pokémon pero NO resta una baja.
-- Las bajas pasan a ser acumuladas; un descenso en la ocupación del cementerio
-- no devuelve vidas. Se preservan permisos, importaciones y confirmaciones.
CREATE OR REPLACE FUNCTION public.publish_save_v20(
 p_fingerprint text,
 p_expected_update timestamptz,
 p_trainer_name text,
 p_badges integer,
 p_deaths integer,
 p_map_code integer,
 p_map_label text,
 p_team_count integer,
 p_pokemon jsonb,
 p_routes jsonb
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE
 v_owner uuid:=auth.uid();
 v_last public.shared_progress%ROWTYPE;
 v_now timestamptz:=clock_timestamp();
 v_count integer;
v_needed integer:=0;
v_credits integer:=0;
v_revived integer:=0;
v_used integer:=0;
v_new_deaths integer:=0;
v_recorded_deaths integer:=0;
BEGIN
 IF v_owner IS NULL OR NOT private.is_member() THEN RAISE EXCEPTION 'Cuenta no autorizada'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(v_owner::text));
 SELECT * INTO v_last FROM public.shared_progress WHERE player_id=v_owner FOR UPDATE;
 IF v_last.updated_at IS DISTINCT FROM p_expected_update THEN
   RAISE EXCEPTION 'Tu información ha cambiado en otro dispositivo. Recarga e importa otra vez.';
 END IF;
 IF p_fingerprint !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Huella del guardado no válida'; END IF;
 IF p_badges NOT BETWEEN 0 AND 8 OR p_deaths NOT BETWEEN 0 AND 999
   OR p_team_count NOT BETWEEN 0 AND 6 OR p_map_code IS NULL
   OR length(coalesce(p_trainer_name,'')) NOT BETWEEN 1 AND 80 THEN
   RAISE EXCEPTION 'Datos de progreso no válidos';
 END IF;
 IF v_last.player_id IS NOT NULL AND p_badges < v_last.badges THEN
  RAISE EXCEPTION 'La partida tiene menos medallas que la última importación. Comprueba que no sea un main antiguo.';
END IF;
IF jsonb_typeof(p_pokemon) IS DISTINCT FROM 'array' OR jsonb_array_length(p_pokemon) NOT BETWEEN 1 AND 936
   OR jsonb_typeof(p_routes) IS DISTINCT FROM 'array' OR jsonb_array_length(p_routes)>200 THEN
  RAISE EXCEPTION 'El lote de importación no es válido';
END IF;
-- Cada Pokémon que sale del cementerio requiere UN permiso, incluso si
-- la cifra de bajas no desciende porque otro Pokémon haya muerto entre saves.
IF v_last.player_id IS NOT NULL THEN
  SELECT count(*) INTO v_revived FROM public.private_pokemon old
  WHERE old.owner_id=v_owner
    AND old.box_num IN (30,31) AND NOT old.is_egg
    AND EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_pokemon)
         AS pk(pokemon_key text,box_num integer,is_egg boolean)
      WHERE pk.pokemon_key=old.pokemon_key
        AND pk.box_num < 30 AND NOT coalesce(pk.is_egg,false)
    );
  -- La muerte sigue contando aunque el Pokémon salga del cementerio.
  -- Contamos entradas NUEVAS al cementerio respecto del guardado anterior,
  -- en vez de restar bajas cuando un Pokémon vuelve a estar disponible.
  SELECT count(*) INTO v_new_deaths
  FROM jsonb_to_recordset(p_pokemon) AS pk(pokemon_key text,box_num integer,is_egg boolean)
  WHERE pk.box_num IN (30,31) AND NOT coalesce(pk.is_egg,false)
    AND NOT EXISTS (
      SELECT 1 FROM public.private_pokemon old
      WHERE old.owner_id=v_owner AND old.pokemon_key=pk.pokemon_key
        AND old.box_num IN (30,31) AND NOT old.is_egg
    );
  v_recorded_deaths:=v_last.deaths+v_new_deaths;
  IF v_recorded_deaths>999 THEN RAISE EXCEPTION 'Límite de bajas alcanzado'; END IF;
  v_needed:=v_revived;
  IF v_needed>0 THEN
    SELECT count(*) INTO v_credits FROM public.money_events m
    WHERE m.player_id=v_owner AND m.item_id=378 AND m.kind='compra'
      AND NOT EXISTS (SELECT 1 FROM public.revival_redemptions rd WHERE rd.purchase_id=m.id);
    IF v_credits < v_needed THEN
      RAISE EXCEPTION 'Necesitas % permiso(s) de resurrección sin usar; tienes %',v_needed,v_credits;
    END IF;
  END IF;
ELSE
 v_recorded_deaths:=p_deaths;
END IF;
 -- Detectar duplicados antes de tocar las tablas.
 SELECT COUNT(*) INTO v_count FROM (
   SELECT x->>'pokemon_key' AS key FROM jsonb_array_elements(p_pokemon) x
   GROUP BY x->>'pokemon_key'
 ) unique_keys;
 IF v_count<>jsonb_array_length(p_pokemon) THEN
   RAISE EXCEPTION 'Se repite un identificador de Pokémon en este main';
 END IF;
 -- Si ya se importó este fichero, falla SIN producir efectos parciales.
 INSERT INTO public.save_imports_v20(owner_id,fingerprint)
 VALUES(v_owner,p_fingerprint)
 ON CONFLICT (owner_id,fingerprint) DO NOTHING;
 IF NOT FOUND THEN RAISE EXCEPTION 'Este archivo main ya fue importado'; END IF;
-- Asignar a cada Pokémon revivido una compra disponible, dentro de la
-- misma transacción del guardado. La PK evita reutilizar un permiso.
IF v_needed>0 THEN
  WITH revivals AS (
    SELECT old.pokemon_key,
           row_number() OVER (ORDER BY old.pokemon_key) AS rn
    FROM public.private_pokemon old
    WHERE old.owner_id=v_owner
      AND old.box_num IN (30,31) AND NOT old.is_egg
      AND EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_pokemon)
          AS pk(pokemon_key text,box_num integer,is_egg boolean)
        WHERE pk.pokemon_key=old.pokemon_key
          AND pk.box_num<30 AND NOT coalesce(pk.is_egg,false)
      )
  ), tickets AS (
    SELECT m.id, row_number() OVER (ORDER BY m.created_at,m.id) AS rn
    FROM public.money_events m
    WHERE m.player_id=v_owner AND m.item_id=378 AND m.kind='compra'
      AND NOT EXISTS (SELECT 1 FROM public.revival_redemptions rd WHERE rd.purchase_id=m.id)
  )
  INSERT INTO public.revival_redemptions(purchase_id,player_id,pokemon_key)
  SELECT t.id,v_owner,r.pokemon_key FROM revivals r JOIN tickets t USING(rn);
  GET DIAGNOSTICS v_used=ROW_COUNT;
  IF v_used<>v_needed THEN RAISE EXCEPTION 'No se pudieron consumir los permisos de resurrección'; END IF;
END IF;

 INSERT INTO public.private_pokemon(
   owner_id,pokemon_key,species,original_species,nickname,box_num,slot_num,is_egg,
   level,met_level,met_location,egg_location,nature,ability,ivs,moves,stats,
   bst,quality,present,last_seen
 )
 SELECT v_owner,pk.pokemon_key,pk.species,pk.original_species,COALESCE(pk.nickname,''),
   pk.box_num,pk.slot_num,COALESCE(pk.is_egg,false),pk.level,pk.met_level,
   pk.met_location,COALESCE(pk.egg_location,0),pk.nature,pk.ability,
   COALESCE(pk.ivs,'[]'::jsonb),COALESCE(pk.moves,'[]'::jsonb),pk.stats,
   pk.bst,pk.quality,true,v_now
 FROM jsonb_to_recordset(p_pokemon) AS pk(
   pokemon_key text,species integer,original_species integer,nickname text,
   box_num integer,slot_num integer,is_egg boolean,level integer,met_level integer,
   met_location integer,egg_location integer,nature integer,ability integer,
   ivs jsonb,moves jsonb,stats jsonb,bst integer,quality numeric
 )
 ON CONFLICT(owner_id,pokemon_key) DO UPDATE SET
   species=EXCLUDED.species,nickname=EXCLUDED.nickname,
   original_species=COALESCE(public.private_pokemon.original_species,EXCLUDED.original_species),
   box_num=EXCLUDED.box_num,slot_num=EXCLUDED.slot_num,is_egg=EXCLUDED.is_egg,
   level=EXCLUDED.level,met_level=EXCLUDED.met_level,met_location=EXCLUDED.met_location,
   egg_location=EXCLUDED.egg_location,nature=EXCLUDED.nature,ability=EXCLUDED.ability,
   ivs=EXCLUDED.ivs,moves=EXCLUDED.moves,stats=EXCLUDED.stats,
   bst=EXCLUDED.bst,quality=EXCLUDED.quality,present=true,last_seen=v_now;
 -- No borrar históricos ni modificar el indicador de huevo ya reclamado.
 UPDATE public.private_pokemon pp SET present=false
 WHERE pp.owner_id=v_owner AND pp.present=true
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_pokemon) x
                  WHERE x->>'pokemon_key'=pp.pokemon_key);

 INSERT INTO public.shared_progress(player_id,trainer_name,badges,deaths,
                                    map_code,map_label,team_count,updated_at)
 VALUES(v_owner,p_trainer_name,p_badges,v_recorded_deaths,p_map_code,
        left(coalesce(p_map_label,''),200),p_team_count,v_now)
 ON CONFLICT(player_id) DO UPDATE SET
    trainer_name=EXCLUDED.trainer_name,badges=EXCLUDED.badges,deaths=EXCLUDED.deaths,
    map_code=EXCLUDED.map_code,map_label=EXCLUDED.map_label,
    team_count=EXCLUDED.team_count,updated_at=EXCLUDED.updated_at;

 -- award_new_badges verifica progreso y es idempotente; mismo BEGIN/COMMIT.
 PERFORM public.award_new_badges(p_badges);

 INSERT INTO public.route_states(owner_id,zone_key,status,nickname,stat_total)
 SELECT DISTINCT v_owner,
   CASE left(trim(e->>'zone_key'),90)
     WHEN 'Pueblo Lavacalda' THEN 'Ciudad Lavacalda'
     WHEN 'Túnel Fervergal' THEN 'Túnel Fervegal'
     ELSE left(trim(e->>'zone_key'),90) END,
   'unknown','',NULL::integer
 FROM jsonb_array_elements(p_routes) e
 WHERE length(trim(coalesce(e->>'zone_key',''))) BETWEEN 2 AND 90
 ON CONFLICT(owner_id,zone_key) DO NOTHING;
 RETURN jsonb_array_length(p_pokemon);
END;
$function$;

-- El sorteo de huevos NO se reemplaza: puede tener una fórmula propia
-- en Supabase y no conocemos su definición desplegada.
-- La vida adicional se refleja en el progreso; queda pendiente comprobar
-- si el sorteo debe contarla también antes de modificar esa función.

REVOKE ALL ON FUNCTION public.publish_save_v20(text,timestamptz,text,integer,integer,integer,text,integer,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_save_v20(text,timestamptz,text,integer,integer,integer,text,integer,jsonb,jsonb) TO authenticated;
COMMIT;
