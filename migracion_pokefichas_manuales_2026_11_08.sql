-- Locke Escribe: ajustes manuales de Pokéfichas (08/11/2026).
-- Cada usuario puede acreditar solo a su propia cuenta. Registro público para ambos.
-- No modifica compras ni recompensas previas. No concede recompensas de BO3.
BEGIN;

DO $check$
BEGIN
  IF to_regclass('public.money_events') IS NULL OR
     to_regclass('public.players') IS NULL OR
     to_regprocedure('private.is_member()') IS NULL THEN
    RAISE EXCEPTION 'Faltan las tablas de economía o la función de autorización de Locke Escribe';
  END IF;
END;
$check$;

CREATE OR REPLACE FUNCTION public.add_manual_pf_v1(
  p_amount integer, p_reason text, p_request_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_owner uuid := auth.uid();
  v_reason text := btrim(regexp_replace(coalesce(p_reason,''), '[[:cntrl:]]+', ' ', 'g'));
  v_key text;
  v_kind text;
  v_event public.money_events%rowtype;
  v_id uuid;
BEGIN
  IF v_owner IS NULL OR NOT private.is_member() THEN
    RAISE EXCEPTION 'Cuenta no autorizada';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Identificador de operación obligatorio';
  END IF;
  IF p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'La cantidad debe estar entre 1 y 100 PF';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 3 AND 100 THEN
    RAISE EXCEPTION 'Escribe un motivo de 3 a 100 caracteres';
  END IF;

  v_key := 'manual:' || p_request_id::text;
  v_kind := 'Ajuste manual: ' || v_reason;
  -- Mismo bloqueo que las compras: operaciones ordenadas por jugador.
  PERFORM pg_advisory_xact_lock(hashtext(v_owner::text));
  SELECT * INTO v_event FROM public.money_events
  WHERE player_id=v_owner AND source_key=v_key;
  IF FOUND THEN
    IF v_event.amount<>p_amount OR v_event.kind<>v_kind THEN
      RAISE EXCEPTION 'El identificador ya corresponde a otro ajuste';
    END IF;
    RETURN v_event.id; -- Repetir una petición de red no concede más fichas.
  END IF;

  INSERT INTO public.money_events(player_id,amount,kind,source_key)
  VALUES(v_owner,p_amount,v_kind,v_key)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.add_manual_pf_v1(integer,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_manual_pf_v1(integer,text,uuid) TO authenticated;
COMMIT;
