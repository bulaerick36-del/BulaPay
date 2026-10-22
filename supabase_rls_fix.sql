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
    v_clean_agent text;
    v_clean_route text;
BEGIN
    v_date := COALESCE(p_date, to_char(NOW() AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD'));
    v_clean_agent := NULLIF(TRIM(p_agent_id), '');
    v_clean_route := NULLIF(TRIM(p_route_id), '');
    
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total
    FROM (
        SELECT DISTINCT ON (COALESCE(p.id, p."clientCedula" || '_' || COALESCE(p."installmentNumber"::text, '') || '_' || p.amount::text || '_' || v_date)) p.amount
        FROM payments p
        LEFT JOIN cartones c ON c.id::text = p.carton_id::text
        WHERE (
            -- Si se consulta por agente, filtro estricto y obligatorio por el cartón amarrado específicamente a ese agente
            (v_clean_agent IS NOT NULL AND (
                (p.carton_id IS NOT NULL AND c.id IS NOT NULL AND LOWER(COALESCE(c.agent_id, '')) = LOWER(v_clean_agent))
                OR
                ((p.carton_id IS NULL OR c.id IS NULL) AND (
                    LOWER(COALESCE(p.agent_id, '')) = LOWER(v_clean_agent) 
                    OR LOWER(COALESCE(p."agentName", '')) = LOWER(v_clean_agent)
                ))
            ))
            OR
            -- Si solo se consulta por ruta sin agente
            (v_clean_agent IS NULL AND v_clean_route IS NOT NULL AND (
                (p.carton_id IS NOT NULL AND c.id IS NOT NULL AND (c.route_id = v_clean_route))
                OR
                (p."routeId" = v_clean_route OR p.route_id = v_clean_route)
            ))
        )
        AND (
            p.date::text LIKE (v_date || '%')
            OR p.created_at::text LIKE (v_date || '%')
            OR to_char(p.created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') = v_date
        )
        AND COALESCE(p.id, '') NOT LIKE 'pay_init_%'
        AND COALESCE(p.id, '') NOT LIKE 'pend_%'
        AND (
            LOWER(COALESCE(p.payment_type, '')) = 'renovacion'
            OR p."installmentNumber" = 999
            OR COALESCE(p.liquidado, false) = true
            OR UPPER(COALESCE(p.status, '')) NOT IN ('NO PAGO', 'PENDIENTE', 'LIQUIDADO_MORA', 'CANCELADO', 'RECHAZADO')
        )
        AND UPPER(COALESCE(p.status, '')) NOT IN ('NO PAGO', 'PENDIENTE', 'LIQUIDADO_MORA')
        AND p.amount > 0
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
    v_old_carton cartones%ROWTYPE;
    v_target_old_id uuid := NULL;
    v_saldo_liquidar numeric := 0;
    v_new_id uuid;
    v_new_numero bigint;
    v_today_str text;
    v_payment_id text;
    v_agent_name text;
    v_now timestamptz := NOW();
    v_route_final text := NULL;
BEGIN
    v_today_str := to_char(v_now AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD');

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
        WHERE cliente_id = p_cliente_id
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
        v_saldo_liquidar := COALESCE(v_old_carton.outstanding, 0);
    END IF;

    -- Determinar ruta
    v_route_final := COALESCE(p_route_id, v_old_carton.route_id);

    -- Resolver nombre de agente para payments
    SELECT COALESCE(name, username, 'Sistema') INTO v_agent_name 
    FROM users 
    WHERE username = p_agent_id 
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
                liquidado,
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
                true,
                v_agent_name,
                p_agent_id,
                v_route_final,
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
        fecha_cierre = v_now,
        updated_at = v_now,
        liquidation_reason = 'Renovación'
    WHERE cliente_id = p_cliente_id
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



-- ==============================================================================
-- SINCRONIZACIÓN DE SUSCRIPCIONES SUPERVISOR -> AGENTE DE RUTA (POSTGRESQL)
-- ==============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS "fecha_vencimiento" TIMESTAMPTZ;

-- A. Función y Trigger de Actualización en Cadena (Cascade Update)
CREATE OR REPLACE FUNCTION cascade_supervisor_vigencia()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.role IN ('Usuario Supervisor', 'Supervisor', 'Administrador', 'Administrador de Rutas')) 
       AND (NEW.fecha_vencimiento IS DISTINCT FROM OLD.fecha_vencimiento OR NEW.fecha_corte IS DISTINCT FROM OLD.fecha_corte) THEN
        
        UPDATE users
        SET 
            fecha_vencimiento = NEW.fecha_vencimiento,
            fecha_corte = NEW.fecha_corte,
            bloqueado_por_mora = COALESCE(NEW.bloqueado_por_mora, false),
            estado_suscripcion = COALESCE(NEW.estado_suscripcion, 'activa'),
            ciclo_actual = COALESCE(NEW.ciclo_actual, ciclo_actual),
            fecha_inicio_ciclo = COALESCE(NEW.fecha_inicio_ciclo, fecha_inicio_ciclo),
            updated_at = NOW()
        WHERE 
            role IN ('Agente de Ruta', 'agent')
            AND (supervisor_id = NEW.username OR supervisor = NEW.username);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_supervisor_vigencia ON users;
CREATE TRIGGER trg_cascade_supervisor_vigencia
AFTER UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION cascade_supervisor_vigencia();

-- B. Función y Trigger para Heredar por Defecto Vigencia al Crear Agente de Ruta
CREATE OR REPLACE FUNCTION inherit_supervisor_vigencia_on_insert()
RETURNS TRIGGER AS $$
DECLARE
    sup_vencimiento TIMESTAMPTZ;
    sup_corte DATE;
    sup_estado TEXT;
    sup_ciclo INT;
    sup_inicio TIMESTAMPTZ;
    sup_username TEXT;
BEGIN
    IF (NEW.role IN ('Agente de Ruta', 'agent')) AND (NEW.supervisor_id IS NOT NULL OR NEW.supervisor IS NOT NULL) THEN
        sup_username := COALESCE(NEW.supervisor_id, NEW.supervisor);
        
        SELECT fecha_vencimiento, fecha_corte, estado_suscripcion, ciclo_actual, fecha_inicio_ciclo
        INTO sup_vencimiento, sup_corte, sup_estado, sup_ciclo, sup_inicio
        FROM users
        WHERE username = sup_username
        LIMIT 1;

        IF sup_vencimiento IS NOT NULL OR sup_corte IS NOT NULL THEN
            IF NEW.fecha_vencimiento IS NULL THEN
                NEW.fecha_vencimiento := sup_vencimiento;
            END IF;
            IF NEW.fecha_corte IS NULL THEN
                NEW.fecha_corte := sup_corte;
            END IF;
            IF NEW.estado_suscripcion IS NULL OR NEW.estado_suscripcion = 'activa_prueba' THEN
                NEW.estado_suscripcion := COALESCE(sup_estado, 'activa');
            END IF;
            IF NEW.ciclo_actual IS NULL THEN
                NEW.ciclo_actual := COALESCE(sup_ciclo, 1);
            END IF;
            IF NEW.fecha_inicio_ciclo IS NULL THEN
                NEW.fecha_inicio_ciclo := sup_inicio;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inherit_supervisor_vigencia ON users;
CREATE TRIGGER trg_inherit_supervisor_vigencia
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION inherit_supervisor_vigencia_on_insert();
