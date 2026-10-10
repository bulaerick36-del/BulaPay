-- Script de Ajuste de Políticas RLS y Función RPC SECURITY DEFINER para Supabase (BulaPay)

-- 1. Políticas RLS Permisivas para usuarios anon y authenticated
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a anonimos en routes" ON routes;
DROP POLICY IF EXISTS "Permitir todo a usuarios en routes" ON routes;
CREATE POLICY "Permitir todo a usuarios en routes" ON routes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo a anonimos en users" ON users;
DROP POLICY IF EXISTS "Permitir todo a usuarios en users" ON users;
CREATE POLICY "Permitir todo a usuarios en users" ON users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo a anonimos en clients" ON clients;
DROP POLICY IF EXISTS "Permitir todo a usuarios en clients" ON clients;
CREATE POLICY "Permitir todo a usuarios en clients" ON clients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo a anonimos en payments" ON payments;
DROP POLICY IF EXISTS "Permitir todo a usuarios en payments" ON payments;
CREATE POLICY "Permitir todo a usuarios en payments" ON payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Otorgar privilegios explícitos de PostgreSQL a los roles anon y authenticated
GRANT ALL ON TABLE routes TO anon, authenticated;
GRANT ALL ON TABLE users TO anon, authenticated;
GRANT ALL ON TABLE clients TO anon, authenticated;
GRANT ALL ON TABLE payments TO anon, authenticated;

-- 2. Función RPC de agregación con SECURITY DEFINER (evita errores 401 / RLS)
CREATE OR REPLACE FUNCTION get_agent_recaudo_hoy(
    p_agent_id text DEFAULT NULL, 
    p_date text DEFAULT NULL, 
    p_route_id text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_date text;
    v_total numeric;
BEGIN
    v_date := COALESCE(p_date, to_char(CURRENT_DATE, 'YYYY-MM-DD'));
    
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total
    FROM (
        SELECT DISTINCT ON (COALESCE(id, "clientCedula" || '_' || "installmentNumber"::text || '_' || amount::text || '_' || v_date)) amount
        FROM payments
        WHERE (
            (p_agent_id IS NOT NULL AND (LOWER(agent_id) = LOWER(p_agent_id) OR LOWER("agentName") = LOWER(p_agent_id)))
            OR (p_route_id IS NOT NULL AND "routeId" = p_route_id)
        )
        AND (
            date::text LIKE (v_date || '%')
            OR created_at::text LIKE (v_date || '%')
        )
        AND UPPER(status) NOT IN ('NO PAGO', 'PENDIENTE')
        AND amount > 0
    ) sub;

    RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION get_agent_recaudo_hoy(text, text, text) TO anon, authenticated;

-- 3. Transacción Atómica de Renovación (Retanqueo) en Supabase
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "carton_id" UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "payment_type" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "routeId" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "route_id" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE cartones ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE cartones ADD COLUMN IF NOT EXISTS "fecha_cierre" TIMESTAMPTZ;
ALTER TABLE cartones ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE cartones ADD COLUMN IF NOT EXISTS "liquidation_reason" TEXT;

DROP FUNCTION IF EXISTS renovar_carton(text, text, numeric, numeric, numeric, integer, numeric, numeric, numeric, text, text, text, bigint, text);

CREATE OR REPLACE FUNCTION renovar_carton(
    p_cliente_id text,
    p_old_carton_id text DEFAULT NULL,
    p_saldo_restante numeric DEFAULT 0,
    p_monto_prestado numeric DEFAULT 0,
    p_total_debt numeric DEFAULT 0,
    p_installments_count integer DEFAULT 30,
    p_installment_amount numeric DEFAULT 0,
    p_discount_amount numeric DEFAULT 0,
    p_net_cash numeric DEFAULT 0,
    p_route_id text DEFAULT NULL,
    p_agent_id text DEFAULT NULL,
    p_supervisor_id text DEFAULT NULL,
    p_new_numero_carton bigint DEFAULT NULL,
    p_new_carton_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_carton RECORD;
    v_target_old_id uuid;
    v_saldo_liquidar numeric;
    v_new_id uuid;
    v_new_numero bigint;
    v_today_str text;
    v_payment_id text;
    v_agent_name text;
    v_now timestamptz := NOW();
BEGIN
    v_today_str := to_char(CURRENT_DATE, 'YYYY-MM-DD');

    -- Paso 0: Identificar el cartón viejo a liquidar
    IF p_old_carton_id IS NOT NULL AND p_old_carton_id != '' THEN
        BEGIN
            v_target_old_id := p_old_carton_id::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_target_old_id := NULL;
        END;
    END IF;

    IF v_target_old_id IS NOT NULL THEN
        SELECT * INTO v_old_carton 
        FROM cartones 
        WHERE id = v_target_old_id;
    END IF;

    IF v_old_carton.id IS NULL THEN
        SELECT * INTO v_old_carton 
        FROM cartones 
        WHERE (cliente_id = p_cliente_id OR client_id = p_cliente_id OR cedula = p_cliente_id)
          AND estado IN ('activo', 'activo_por_renovacion', 'liquidado_por_renovacion', 'liquidado_renovacion', 'ACTIVO')
        ORDER BY created_at DESC 
        LIMIT 1;
    END IF;

    IF v_old_carton.id IS NOT NULL THEN
        v_target_old_id := v_old_carton.id;
    END IF;

    -- Saldo a liquidar
    v_saldo_liquidar := COALESCE(p_saldo_restante, 0);
    IF v_saldo_liquidar <= 0 AND v_old_carton.id IS NOT NULL THEN
        v_saldo_liquidar := COALESCE(v_old_carton.outstanding, v_old_carton.saldo_pendiente, 0);
    END IF;

    -- Resolver nombre de agente para payments
    SELECT COALESCE(name, username, 'Sistema') INTO v_agent_name 
    FROM users 
    WHERE username = p_agent_id OR id::text = p_agent_id 
    LIMIT 1;
    IF v_agent_name IS NULL THEN
        v_agent_name := COALESCE(p_agent_id, 'Sistema');
    END IF;

    -- ========================================================
    -- PASO 1: INSERT a la tabla de pagos liquidando el saldo exacto restante del cartón viejo
    -- ========================================================
    IF v_saldo_liquidar > 0 THEN
        v_payment_id := 'pay_renov_' || floor(extract(epoch from v_now))::text || '_' || floor(random() * 1000)::text;
        
        BEGIN
            INSERT INTO payments (
                id,
                "clientCedula",
                carton_id,
                "installmentNumber",
                amount,
                date,
                status,
                payment_type,
                "agentName",
                agent_id,
                "routeId",
                signature,
                supervisor_id,
                created_at,
                updated_at
            ) VALUES (
                v_payment_id,
                p_cliente_id,
                v_target_old_id,
                999,
                v_saldo_liquidar,
                v_today_str,
                'Pagado', -- Cruza directo con get_agent_recaudo_hoy
                'Renovacion',
                v_agent_name,
                p_agent_id,
                COALESCE(p_route_id, v_old_carton.route_id),
                'BulaPay-SIG-' || p_cliente_id || '-RENOV',
                p_supervisor_id,
                v_now,
                v_now
            );
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO payments (
                id,
                "clientCedula",
                "installmentNumber",
                amount,
                date,
                status,
                "agentName",
                agent_id,
                signature,
                supervisor_id,
                created_at
            ) VALUES (
                v_payment_id,
                p_cliente_id,
                999,
                v_saldo_liquidar,
                v_today_str,
                'Pagado',
                v_agent_name,
                p_agent_id,
                'BulaPay-SIG-' || p_cliente_id || '-RENOV',
                p_supervisor_id,
                v_now
            );
        END;
    END IF;

    -- ========================================================
    -- PASO 2: UPDATE al cartón viejo cambiando su estado a RENOVADO
    -- ========================================================
    IF v_target_old_id IS NOT NULL THEN
        UPDATE cartones
        SET 
            estado = 'RENOVADO',
            status = 'RENOVADO',
            outstanding = 0,
            saldo_pendiente = 0,
            fecha_cierre = v_now,
            updated_at = v_now,
            liquidation_reason = 'Renovación'
        WHERE id = v_target_old_id;
    END IF;

    -- Asegurar que cualquier otro cartón activo previo de este cliente también quede cerrado a deuda 0
    UPDATE cartones
    SET 
        estado = 'RENOVADO',
        status = 'RENOVADO',
        outstanding = 0,
        saldo_pendiente = 0,
        fecha_cierre = v_now,
        updated_at = v_now,
        liquidation_reason = 'Renovación'
    WHERE (cliente_id = p_cliente_id OR client_id = p_cliente_id OR cedula = p_cliente_id)
      AND estado IN ('activo', 'activo_por_renovacion', 'liquidado_por_renovacion', 'ACTIVO')
      AND (v_target_old_id IS NULL OR id != v_target_old_id);

    -- ========================================================
    -- PASO 3: INSERT del nuevo cartón refinanciado
    -- ========================================================
    IF p_new_carton_id IS NOT NULL AND p_new_carton_id != '' THEN
        BEGIN
            v_new_id := p_new_carton_id::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_new_id := gen_random_uuid();
        END;
    ELSE
        v_new_id := gen_random_uuid();
    END IF;

    v_new_numero := COALESCE(p_new_numero_carton, floor(extract(epoch from v_now) % 100000000)::bigint);

    INSERT INTO cartones (
        id,
        cliente_id,
        numero_carton,
        fecha_apertura,
        monto_prestado,
        estado,
        status,
        saldo_anterior,
        rollover_amount,
        total_debt,
        outstanding,
        installments_count,
        installment_amount,
        discount_amount,
        net_cash,
        route_id,
        agent_id,
        supervisor_id,
        created_at,
        updated_at
    ) VALUES (
        v_new_id,
        p_cliente_id,
        v_new_numero,
        v_now,
        p_monto_prestado,
        'activo_por_renovacion',
        'activo_por_renovacion',
        v_saldo_liquidar,
        v_saldo_liquidar,
        p_total_debt,
        p_total_debt,
        p_installments_count,
        p_installment_amount,
        p_discount_amount,
        p_net_cash,
        p_route_id,
        p_agent_id,
        p_supervisor_id,
        v_now,
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'old_carton_id', v_target_old_id,
        'saldo_liquidado', v_saldo_liquidar,
        'new_carton_id', v_new_id,
        'new_numero_carton', v_new_numero,
        'payment_id', v_payment_id
    );
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Fallo en la transacción atómica de renovación: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION renovar_carton(text, text, numeric, numeric, numeric, integer, numeric, numeric, numeric, text, text, text, bigint, text) TO anon, authenticated, service_role;

