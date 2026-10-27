-- Locke Escribe · RO 2.0 y rebalanceo de la tienda
-- Ejecutar una vez en Supabase > SQL Editor, tras instalar app.js.
-- No reinicia ninguna partida ni altera compras anteriores.
-- Los cambios de precio solo afectan compras futuras.
BEGIN;

-- Primero ajustamos la regla editable para que el trigger no restaure 22 PF.
UPDATE public.config SET egg_price=18 WHERE id=1 AND egg_price IS DISTINCT FROM 18;

-- Toda la tienda queda por debajo de los fósiles, salvo revivir un Pokémon.
UPDATE public.shop_catalog
SET price = CASE
  WHEN category='Fósiles (captura adicional)' THEN 25
  WHEN category LIKE 'Bayas%' THEN 1
  WHEN name='Huevo aleatorio' THEN 18
  WHEN category='Megapiedras estándar' THEN 12
  WHEN category='Megapiedras potentes' THEN 18
  WHEN category='Megapiedras excepcionales' THEN 23
  WHEN category='Competitivo — élite' THEN LEAST(price,21)
  WHEN category='Tesoros y reventa' AND price>=25 THEN 20
  ELSE GREATEST(1,LEAST(price,24))
END
WHERE id<>378;

-- Reservamos este ID; si otra versión lo utiliza no sobrescribimos su artículo.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.shop_catalog WHERE id=378 AND name<>'Revivir un Pokémon') THEN
  RAISE EXCEPTION 'El identificador 378 está ocupado por otro artículo';
 END IF;
END $$;

INSERT INTO public.shop_catalog(id,name,category,price,quantity,available)
VALUES(378,'Revivir un Pokémon','Recompensas',40,1,true)
ON CONFLICT(id) DO UPDATE SET
 name=EXCLUDED.name,category=EXCLUDED.category,price=EXCLUDED.price,
 quantity=EXCLUDED.quantity,available=EXCLUDED.available;

-- Impedir que un cambio accidental en Table Editor altere la jerarquía.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='locke_tienda_escala_ro20'
    AND conrelid='public.shop_catalog'::regclass) THEN
    ALTER TABLE public.shop_catalog ADD CONSTRAINT locke_tienda_escala_ro20 CHECK (
      (id=378 AND price>25)
      OR (id<>378 AND category='Fósiles (captura adicional)' AND price=25)
      OR (id<>378 AND category LIKE 'Bayas%' AND price=1)
      OR (id<>378 AND category<>'Fósiles (captura adicional)' AND category NOT LIKE 'Bayas%' AND price BETWEEN 1 AND 24)
    );
  END IF;
END $$;

-- Permisos consumidos: conservar íntegros los movimientos históricos de PF.
-- Al archivar/reiniciar una partida, se eliminan sus eventos de dinero;
-- ON DELETE CASCADE elimina también los consumos correspondientes.
CREATE TABLE IF NOT EXISTS public.revival_redemptions (
  purchase_id uuid PRIMARY KEY REFERENCES public.money_events(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(user_id) ON DELETE CASCADE,
  pokemon_key text NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.revival_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.revival_redemptions FROM PUBLIC, anon, authenticated;

-- El RPC buy_shop_item existente descuenta la compra atómicamente y registra
-- money_events (kind='compra', item_id=378), sin alterar la lógica de cobro.
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
  WHERE old.owner_id=v_owner AND old.present=true
    AND old.box_num IN (30,31) AND NOT old.is_egg
    AND EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_pokemon)
         AS pk(pokemon_key text,box_num integer,is_egg boolean)
      WHERE pk.pokemon_key=old.pokemon_key
        AND pk.box_num < 30 AND NOT coalesce(pk.is_egg,false)
    );
  IF p_deaths < v_last.deaths AND (v_last.deaths-p_deaths)>v_revived THEN
    RAISE EXCEPTION 'No se justifica la reducción de bajas: revisa el cementerio y comprueba que el main no sea antiguo';
  END IF;
  v_needed:=v_revived;
  IF v_needed>0 THEN
    SELECT count(*) INTO v_credits FROM public.money_events m
    WHERE m.player_id=v_owner AND m.item_id=378 AND m.kind='compra'
      AND NOT EXISTS (SELECT 1 FROM public.revival_redemptions rd WHERE rd.purchase_id=m.id);
    IF v_credits < v_needed THEN
      RAISE EXCEPTION 'Necesitas % permiso(s) de resurrección sin usar; tienes %',v_needed,v_credits;
    END IF;
  END IF;
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
    WHERE old.owner_id=v_owner AND old.present=true
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
 VALUES(v_owner,p_trainer_name,p_badges,p_deaths,p_map_code,
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

REVOKE ALL ON FUNCTION public.publish_save_v20(text,timestamptz,text,integer,integer,integer,text,integer,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_save_v20(text,timestamptz,text,integer,integer,integer,text,integer,jsonb,jsonb) TO authenticated;
COMMIT;
