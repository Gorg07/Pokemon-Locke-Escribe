-- Locke Escribe: nuevos artículos/servicios de entrenamiento (05-11-2026).
-- Ejecutar SOLO después de confirmar que la economía de octubre está instalada.
-- No edita Pokémon, compras anteriores, vidas, partidas ni logs de las ROMs.
BEGIN;

DO $guard$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shop_catalog WHERE id=378 AND price IN (30,35))
     OR NOT EXISTS (SELECT 1 FROM public.shop_catalog WHERE id=379 AND price=10)
     OR NOT EXISTS (SELECT 1 FROM public.shop_catalog WHERE id=380 AND price=3)
  THEN RAISE EXCEPTION 'Falta o difiere la migración de economía anterior (IDs 378-380). No se han aplicado cambios'; END IF;
  IF EXISTS (
     SELECT 1 FROM public.shop_catalog c JOIN (VALUES
   (381,'Baya Grana (PS)'),
   (382,'Baya Algama (Ataque)'),
   (383,'Baya Ispero (Defensa)'),
   (384,'Baya Meluce (Ataque Especial)'),
   (385,'Baya Uvav (Defensa Especial)'),
   (386,'Baya Tamate (Velocidad)'),
   (387,'Más PS (vitamina EV)'),
   (388,'Proteína (vitamina EV)'),
   (389,'Hierro (vitamina EV)'),
   (390,'Calcio (vitamina EV)'),
   (391,'Zinc (vitamina EV)'),
   (392,'Carburante (vitamina EV)'),
   (393,'Menta de naturaleza (a escoger)'),
   (394,'Reinicio completo de EV'),
   (395,'Más PP'),
   (396,'Máx. PP'),
   (397,'Mejorar un IV en +5 (máximo 31)'),
   (398,'Maximizar un IV a 31')
     ) AS exp(id,name) USING(id)
     WHERE c.name<>exp.name
  ) THEN RAISE EXCEPTION 'Existen IDs nuevos ocupados por otros artículos. No se han aplicado cambios'; END IF;
END $guard$;

-- Sustituye únicamente el CHECK de escala creado por la migración económica.
ALTER TABLE public.shop_catalog DROP CONSTRAINT IF EXISTS locke_tienda_escala_audio_v1;
ALTER TABLE public.shop_catalog DROP CONSTRAINT IF EXISTS locke_tienda_escala_audio_v2;
UPDATE public.shop_catalog SET price=2,quantity=1 WHERE id=314 AND name='Escama Corazón';
UPDATE public.shop_catalog SET price=35 WHERE id=378 AND name LIKE 'Revivir un Pokémon%';
INSERT INTO public.shop_catalog(id,name,category,price,quantity,available) VALUES
  (381,'Baya Grana (PS)','Entrenamiento — bayas EV',1,10,true),
  (382,'Baya Algama (Ataque)','Entrenamiento — bayas EV',1,10,true),
  (383,'Baya Ispero (Defensa)','Entrenamiento — bayas EV',1,10,true),
  (384,'Baya Meluce (Ataque Especial)','Entrenamiento — bayas EV',1,10,true),
  (385,'Baya Uvav (Defensa Especial)','Entrenamiento — bayas EV',1,10,true),
  (386,'Baya Tamate (Velocidad)','Entrenamiento — bayas EV',1,10,true),
  (387,'Más PS (vitamina EV)','Entrenamiento — vitaminas EV',2,10,true),
  (388,'Proteína (vitamina EV)','Entrenamiento — vitaminas EV',2,10,true),
  (389,'Hierro (vitamina EV)','Entrenamiento — vitaminas EV',2,10,true),
  (390,'Calcio (vitamina EV)','Entrenamiento — vitaminas EV',2,10,true),
  (391,'Zinc (vitamina EV)','Entrenamiento — vitaminas EV',2,10,true),
  (392,'Carburante (vitamina EV)','Entrenamiento — vitaminas EV',2,10,true),
  (393,'Menta de naturaleza (a escoger)','Entrenamiento — servicios PKHeX',5,1,true),
  (394,'Reinicio completo de EV','Entrenamiento — servicios PKHeX',3,1,true),
  (395,'Más PP','Entrenamiento — otros',2,1,true),
  (396,'Máx. PP','Entrenamiento — otros',5,1,true),
  (397,'Mejorar un IV en +5 (máximo 31)','Entrenamiento — servicios PKHeX',3,1,true),
  (398,'Maximizar un IV a 31','Entrenamiento — servicios PKHeX',7,1,true)
ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,
 price=excluded.price,quantity=excluded.quantity,available=excluded.available;

-- Se preserva el resto de categorías y el máximo ordinario de 24 PF.
ALTER TABLE public.shop_catalog ADD CONSTRAINT locke_tienda_escala_audio_v2 CHECK (
  (id=378 AND price=35)
  OR (id=379 AND price=10)
  OR (id=380 AND price=3)
  OR (category='Fósiles (captura adicional)' AND price=20)
  OR (category LIKE 'Bayas%' AND price=1)
  OR (id NOT IN (378,379,380) AND category<>'Fósiles (captura adicional)'
      AND category NOT LIKE 'Bayas%' AND price BETWEEN 1 AND 24)
);

-- Las decisiones de PKHeX se guardan de manera PRIVADA por propietario.
-- En un reinicio oficial se conserva el recibo aunque se archive/elimine
-- el movimiento económico: la FK libera purchase_id, sin borrar el servicio.
CREATE TABLE IF NOT EXISTS public.shop_service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid UNIQUE REFERENCES public.money_events(id) ON DELETE SET NULL,
  player_id uuid NOT NULL REFERENCES public.players(user_id),
  item_id integer NOT NULL CHECK(item_id IN (393,394,397,398)),
  pokemon_key text NOT NULL,
  selection text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_service_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_service_orders_owner_select ON public.shop_service_orders;
CREATE POLICY shop_service_orders_owner_select ON public.shop_service_orders
  FOR SELECT TO authenticated USING (player_id=auth.uid() AND private.is_member());
REVOKE ALL ON public.shop_service_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shop_service_orders TO authenticated;

-- Se mantiene buy_shop_item para los artículos normales. Los servicios
-- cobran y registran su elección en UNA SOLA transacción con ese mismo RPC.
CREATE OR REPLACE FUNCTION public.buy_shop_service_v1(
  p_item_id integer,p_pokemon_key text,p_selection text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_owner uuid:=auth.uid();
  v_mon public.private_pokemon%ROWTYPE;
  v_purchase uuid;
  v_iv_index integer;
BEGIN
  IF v_owner IS NULL OR NOT private.is_member() THEN
    RAISE EXCEPTION 'Cuenta no autorizada';
  END IF;
  IF p_item_id NOT IN (393,394,397,398) THEN
    RAISE EXCEPTION 'Este artículo no es un servicio configurable';
  END IF;
  SELECT * INTO v_mon FROM public.private_pokemon
  WHERE owner_id=v_owner AND pokemon_key=p_pokemon_key AND present=true
    AND NOT is_egg AND box_num NOT IN (30,31) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pokémon no encontrado o no elegible'; END IF;

  IF p_item_id=393 AND (p_selection IS NULL OR p_selection<>ALL(ARRAY['Fuerte','Huraña','Audaz','Firme','Pícara','Osada','Dócil','Plácida','Agitada','Floja','Miedosa','Activa','Seria','Alegre','Ingenua','Modesta','Afable','Mansa','Tímida','Alocada','Serena','Amable','Grosera','Cauta','Rara']::text[])) THEN
    RAISE EXCEPTION 'Naturaleza no válida';
  ELSIF p_item_id=394 AND p_selection IS NOT NULL AND p_selection<>'' THEN
    RAISE EXCEPTION 'El reinicio de EV no lleva selección adicional';
  ELSIF p_item_id IN (397,398) THEN
    v_iv_index:=array_position(ARRAY['PS','Ataque','Defensa','Ataque Especial','Defensa Especial','Velocidad']::text[],p_selection);
    IF v_iv_index IS NULL THEN RAISE EXCEPTION 'Estadística del IV no válida'; END IF;
    IF jsonb_typeof(v_mon.ivs)<>'array' OR jsonb_array_length(v_mon.ivs)<6 THEN
      RAISE EXCEPTION 'Vuelve a importar main para conocer los IV del Pokémon';
    END IF;
    IF (v_mon.ivs->>(v_iv_index-1))::integer>=31 THEN
      RAISE EXCEPTION 'Ese IV ya está maximizado a 31';
    END IF;
  END IF;

  -- Llama al RPC existente: conserva bloqueo, validación de saldo y asiento económico.
  v_purchase:=public.buy_shop_item(p_item_id);
  INSERT INTO public.shop_service_orders(purchase_id,player_id,item_id,pokemon_key,selection)
  VALUES(v_purchase,v_owner,p_item_id,p_pokemon_key,NULLIF(p_selection,''));
  RETURN v_purchase;
END; $fn$;
REVOKE ALL ON FUNCTION public.buy_shop_service_v1(integer,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buy_shop_service_v1(integer,text,text) TO authenticated;

-- Evita compras de servicios sin destinatario por llamadas directas al RPC antiguo.
-- La validación diferida se ejecuta al final de la transacción, tras guardar el pedido.
CREATE OR REPLACE FUNCTION public.locke_require_shop_service_order_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NEW.kind='compra' AND NEW.item_id IN (393,394,397,398)
    AND NOT EXISTS (
       SELECT 1 FROM public.shop_service_orders WHERE purchase_id=NEW.id
    ) THEN
    RAISE EXCEPTION 'Compra de servicio sin destinatario: usa buy_shop_service_v1';
 END IF;
 RETURN NULL;
END; $fn$;
DROP TRIGGER IF EXISTS locke_require_shop_service_order_v1 ON public.money_events;
CREATE CONSTRAINT TRIGGER locke_require_shop_service_order_v1
AFTER INSERT ON public.money_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION public.locke_require_shop_service_order_v1();
REVOKE ALL ON FUNCTION public.locke_require_shop_service_order_v1() FROM PUBLIC, anon, authenticated;
COMMIT;
