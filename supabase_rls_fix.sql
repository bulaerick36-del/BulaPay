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
-- =========================================================================================
-- BulaPay: Cierre de Jornada y Reinicio de Recaudo por Horario de Ruta
-- Define la Jornada Operativa según opening_time configurado en la ruta (ej: 06:00 AM)
-- Al iniciar el nuevo día laboral o al ejecutar Cierre de Caja, el contador reinicia a $0
-- y envía el recaudo acumulado de la jornada previa al historial/cierre.
-- =========================================================================================

-- 1. Campos de control de cierre en la tabla routes
ALTER TABLE routes ADD COLUMN IF NOT EXISTS "fecha_ultimo_cierre" TIMESTAMPTZ;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS "ultimo_recaudo_cierre" NUMERIC DEFAULT 0;

-- 2. Tabla de Historial de Cierres de Jornada / Caja
CREATE TABLE IF NOT EXISTS cierres_jornada (
    "id" TEXT PRIMARY KEY,
    "route_id" TEXT REFERENCES routes("id") ON DELETE SET NULL,
    "agent_id" TEXT REFERENCES users("username") ON DELETE SET NULL,
    "agent_name" TEXT,
    "supervisor_id" TEXT,
    "fecha_jornada" TEXT NOT NULL,
    "hora_apertura" TEXT DEFAULT '06:00',
    "inicio_jornada" TIMESTAMPTZ NOT NULL,
    "fin_jornada" TIMESTAMPTZ NOT NULL,
    "fecha_cierre" TIMESTAMPTZ DEFAULT NOW(),
    "total_recaudado" NUMERIC NOT NULL DEFAULT 0,
    "total_prestado" NUMERIC NOT NULL DEFAULT 0,
    "efectivo_inicial" NUMERIC NOT NULL DEFAULT 0,
    "efectivo_entregar" NUMERIC NOT NULL DEFAULT 0,
    "detalles" JSONB DEFAULT '{}'::jsonb,
    "tipo_cierre" TEXT DEFAULT 'manual', -- 'manual' (cierre de caja) o 'automatico_reinicio'
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Permisos y Políticas RLS para cierres_jornada
GRANT ALL ON TABLE cierres_jornada TO anon, authenticated;
ALTER TABLE cierres_jornada ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a anonimos en cierres_jornada" ON cierres_jornada;
DROP POLICY IF EXISTS "Permitir todo a usuarios en cierres_jornada" ON cierres_jornada;
CREATE POLICY "Permitir todo a usuarios en cierres_jornada" ON cierres_jornada FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. Función RPC get_agent_recaudo_hoy basada en la Jornada Operativa de la Ruta
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
    v_clean_agent text;
    v_clean_route text;
    v_opening_time text := '06:00';
    v_open_time_val time := '06:00:00'::time;
    v_ultimo_cierre timestamptz;
    v_ultimo_cierre_tabla timestamptz;
    v_now_bogota timestamp;
    v_today_date date;
    v_shift_today timestamp;
    v_shift_start_local timestamp;
    v_shift_end_local timestamp;
    v_shift_start timestamptz;
    v_shift_end timestamptz;
    v_effective_start timestamptz;
    v_total numeric := 0;
    v_carton_rollover numeric := 0;
BEGIN
    v_clean_agent := NULLIF(TRIM(p_agent_id), '');
    v_clean_route := NULLIF(TRIM(p_route_id), '');

    -- 1. Obtener la ruta vinculada y su horario configurado de apertura (opening_time)
    IF v_clean_route IS NOT NULL THEN
        SELECT 
            COALESCE(NULLIF(TRIM(opening_time), ''), '06:00'),
            fecha_ultimo_cierre
        INTO v_opening_time, v_ultimo_cierre
        FROM routes
        WHERE id = v_clean_route
        LIMIT 1;
    ELSIF v_clean_agent IS NOT NULL THEN
        SELECT 
            r.id,
            COALESCE(NULLIF(TRIM(r.opening_time), ''), '06:00'),
            r.fecha_ultimo_cierre
        INTO v_clean_route, v_opening_time, v_ultimo_cierre
        FROM routes r
        WHERE LOWER(r."agentUsername") = LOWER(v_clean_agent)
           OR LOWER(COALESCE(r."agentName", '')) = LOWER(v_clean_agent)
           OR r.id IN (SELECT u."routeId" FROM users u WHERE LOWER(u.username) = LOWER(v_clean_agent))
        LIMIT 1;
    END IF;

    -- Validar formato de hora de apertura (HH:MM)
    BEGIN
        v_open_time_val := (v_opening_time || ':00')::time;
    EXCEPTION WHEN OTHERS THEN
        v_opening_time := '06:00';
        v_open_time_val := '06:00:00'::time;
    END;

    -- 2. Calcular la ventana de Jornada Operativa en hora local de Colombia (America/Bogota, UTC-5)
    v_now_bogota := NOW() AT TIME ZONE 'America/Bogota';
    v_today_date := v_now_bogota::date;
    v_shift_today := v_today_date + v_open_time_val;

    IF p_date IS NOT NULL AND p_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
        -- Si se especifica una fecha explícita, la jornada inicia a la hora de apertura de esa fecha
        v_shift_start_local := p_date::date + v_open_time_val;
        v_shift_end_local := v_shift_start_local + INTERVAL '1 day';
    ELSE
        -- Jornada activa actual: si la hora actual es menor que la hora de apertura (ej: 2:00 AM),
        -- pertenece a la jornada operativa iniciada ayer a las 6:00 AM
        IF v_now_bogota >= v_shift_today THEN
            v_shift_start_local := v_shift_today;
            v_shift_end_local := v_shift_today + INTERVAL '1 day';
        ELSE
            v_shift_start_local := v_shift_today - INTERVAL '1 day';
            v_shift_end_local := v_shift_today;
        END IF;
    END IF;

    v_shift_start := v_shift_start_local AT TIME ZONE 'America/Bogota';
    v_shift_end := v_shift_end_local AT TIME ZONE 'America/Bogota';

    -- 3. Verificar si se realizó cierre de caja previo dentro de esta jornada operativa
    -- Buscar el último cierre en la tabla cierres_jornada
    BEGIN
        SELECT MAX(fecha_cierre)
        INTO v_ultimo_cierre_tabla
        FROM cierres_jornada
        WHERE (
            (v_clean_route IS NOT NULL AND route_id = v_clean_route)
            OR (v_clean_agent IS NOT NULL AND LOWER(agent_id) = LOWER(v_clean_agent))
        )
        AND fecha_cierre >= v_shift_start
        AND fecha_cierre <= NOW();
    EXCEPTION WHEN OTHERS THEN
        v_ultimo_cierre_tabla := NULL;
    END;

    IF v_ultimo_cierre_tabla IS NOT NULL AND (v_ultimo_cierre IS NULL OR v_ultimo_cierre_tabla > v_ultimo_cierre) THEN
        v_ultimo_cierre := v_ultimo_cierre_tabla;
    END IF;

    -- Si hubo un cierre previo dentro de esta jornada, el contador de Recaudado Hoy reinicia desde el momento del cierre
    IF v_ultimo_cierre IS NOT NULL AND v_ultimo_cierre >= v_shift_start AND v_ultimo_cierre <= NOW() THEN
        v_effective_start := v_ultimo_cierre;
    ELSE
        v_effective_start := v_shift_start;
    END IF;

    -- 4. Calcular el recaudo acumulado en la jornada operativa (o posterior al último cierre)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total
    FROM (
        SELECT DISTINCT ON (COALESCE(p.id, p."clientCedula" || '_' || COALESCE(p."installmentNumber"::text, '') || '_' || p.amount::text || '_' || to_char(v_shift_start_local, 'YYYY-MM-DD'))) p.amount
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
            (p.created_at IS NOT NULL AND p.created_at >= v_effective_start AND p.created_at < v_shift_end)
            OR
            (p.created_at IS NULL AND p.date = v_shift_start_local::date AND v_effective_start <= v_shift_start)
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

    -- Respaldo: renovaciones directas en cartones si no existen en payments
    BEGIN
        SELECT COALESCE(SUM(COALESCE(c.rollover_amount, c.saldo_anterior, 0)), 0)
        INTO v_carton_rollover
        FROM cartones c
        WHERE (
            (v_clean_agent IS NOT NULL AND LOWER(COALESCE(c.agent_id, '')) = LOWER(v_clean_agent))
            OR (v_clean_agent IS NULL AND v_clean_route IS NOT NULL AND c.route_id = v_clean_route)
        )
        AND (
            (c.created_at IS NOT NULL AND c.created_at >= v_effective_start AND c.created_at < v_shift_end)
            OR (c.created_at IS NULL AND c.fecha_apertura IS NOT NULL AND c.fecha_apertura >= v_effective_start AND c.fecha_apertura < v_shift_end)
        )
        AND COALESCE(c.rollover_amount, c.saldo_anterior, 0) > 0
        AND NOT EXISTS (
            SELECT 1 FROM payments p 
            WHERE (
                p.carton_id = c.id::text 
                OR p."clientCedula" = c.cliente_id
            )
            AND (
                LOWER(COALESCE(p.payment_type, '')) = 'renovacion' 
                OR p."installmentNumber" = 999 
                OR p.id LIKE 'pay_renov_%'
            )
            AND (
                (p.created_at IS NOT NULL AND p.created_at >= v_effective_start AND p.created_at < v_shift_end)
                OR (p.created_at IS NULL AND p.date = v_shift_start_local::date)
            )
        );
    EXCEPTION WHEN OTHERS THEN
        v_carton_rollover := 0;
    END;

    RETURN v_total + v_carton_rollover;
END;
$$;

GRANT EXECUTE ON FUNCTION get_agent_recaudo_hoy(text, text, text) TO anon, authenticated;

-- 4. RPC para Efectuar y Confirmar Cierre de Jornada de Ruta
CREATE OR REPLACE FUNCTION cerrar_jornada_ruta(
    p_route_id text,
    p_agent_id text DEFAULT NULL,
    p_supervisor_id text DEFAULT NULL,
    p_tipo_cierre text DEFAULT 'manual',
    p_detalles jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_route text;
    v_clean_agent text;
    v_agent_name text;
    v_opening_time text := '06:00';
    v_recaudo_actual numeric := 0;
    v_shift_start timestamptz;
    v_shift_end timestamptz;
    v_shift_date_str text;
    v_cierre_id text;
    v_now timestamptz := NOW();
    v_now_bogota timestamp;
    v_open_time_val time;
    v_today_date date;
    v_shift_today timestamp;
    v_shift_start_local timestamp;
    v_shift_end_local timestamp;
    v_result jsonb;
BEGIN
    v_clean_route := NULLIF(TRIM(p_route_id), '');
    v_clean_agent := NULLIF(TRIM(p_agent_id), '');

    IF v_clean_route IS NULL AND v_clean_agent IS NOT NULL THEN
        SELECT r.id, r."agentName", COALESCE(NULLIF(TRIM(r.opening_time), ''), '06:00')
        INTO v_clean_route, v_agent_name, v_opening_time
        FROM routes r
        WHERE LOWER(r."agentUsername") = LOWER(v_clean_agent)
           OR LOWER(COALESCE(r."agentName", '')) = LOWER(v_clean_agent)
           OR r.id IN (SELECT u."routeId" FROM users u WHERE LOWER(u.username) = LOWER(v_clean_agent))
        LIMIT 1;
    ELSIF v_clean_route IS NOT NULL THEN
        SELECT "agentUsername", "agentName", COALESCE(NULLIF(TRIM(opening_time), ''), '06:00')
        INTO v_clean_agent, v_agent_name, v_opening_time
        FROM routes
        WHERE id = v_clean_route
        LIMIT 1;
    END IF;

    IF v_clean_agent IS NULL THEN
        v_clean_agent := p_agent_id;
    END IF;

    -- Calcular jornada operativa actual
    BEGIN
        v_open_time_val := (v_opening_time || ':00')::time;
    EXCEPTION WHEN OTHERS THEN
        v_open_time_val := '06:00:00'::time;
    END;

    v_now_bogota := v_now AT TIME ZONE 'America/Bogota';
    v_today_date := v_now_bogota::date;
    v_shift_today := v_today_date + v_open_time_val;

    IF v_now_bogota >= v_shift_today THEN
        v_shift_start_local := v_shift_today;
        v_shift_end_local := v_shift_today + INTERVAL '1 day';
    ELSE
        v_shift_start_local := v_shift_today - INTERVAL '1 day';
        v_shift_end_local := v_shift_today;
    END IF;

    v_shift_start := v_shift_start_local AT TIME ZONE 'America/Bogota';
    v_shift_end := v_shift_end_local AT TIME ZONE 'America/Bogota';
    v_shift_date_str := to_char(v_shift_start_local, 'YYYY-MM-DD');

    -- Calcular recaudo acumulado de la jornada antes del cierre
    v_recaudo_actual := get_agent_recaudo_hoy(v_clean_agent, v_shift_date_str, v_clean_route);

    -- Generar ID de cierre
    v_cierre_id := 'cierre_' || COALESCE(v_clean_route, 'gral') || '_' || v_shift_date_str || '_' || EXTRACT(EPOCH FROM v_now)::bigint::text;

    -- Registrar cierre en cierres_jornada
    INSERT INTO cierres_jornada (
        id, route_id, agent_id, agent_name, supervisor_id,
        fecha_jornada, hora_apertura, inicio_jornada, fin_jornada,
        fecha_cierre, total_recaudado, total_prestado,
        efectivo_inicial, efectivo_entregar, detalles, tipo_cierre, created_at
    ) VALUES (
        v_cierre_id,
        v_clean_route,
        v_clean_agent,
        COALESCE(v_agent_name, v_clean_agent),
        p_supervisor_id,
        v_shift_date_str,
        v_opening_time,
        v_shift_start,
        v_shift_end,
        v_now,
        v_recaudo_actual,
        COALESCE((p_detalles->>'total_prestado')::numeric, 0),
        COALESCE((p_detalles->>'efectivo_inicial')::numeric, 0),
        COALESCE((p_detalles->>'efectivo_entregar')::numeric, 0),
        p_detalles,
        COALESCE(p_tipo_cierre, 'manual'),
        v_now
    )
    ON CONFLICT (id) DO UPDATE SET
        total_recaudado = EXCLUDED.total_recaudado,
        fecha_cierre = EXCLUDED.fecha_cierre,
        detalles = EXCLUDED.detalles;

    -- Actualizar ruta con fecha de último cierre y reiniciar contador collected
    IF v_clean_route IS NOT NULL THEN
        UPDATE routes
        SET fecha_ultimo_cierre = v_now,
            ultimo_recaudo_cierre = v_recaudo_actual,
            collected = 0
        WHERE id = v_clean_route;
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'cierre_id', v_cierre_id,
        'route_id', v_clean_route,
        'agent_id', v_clean_agent,
        'fecha_jornada', v_shift_date_str,
        'total_recaudado_cerrado', v_recaudo_actual,
        'fecha_cierre', v_now
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION cerrar_jornada_ruta(text, text, text, text, jsonb) TO anon, authenticated;

-- 5. RPC para Auto-Cierre / Archivo de Jornada Previa al Iniciar Nuevo Horario Laboral
CREATE OR REPLACE FUNCTION verificar_cierre_automatico_jornada(
    p_route_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    v_opening_time text;
    v_open_time_val time;
    v_now_bogota timestamp;
    v_shift_today timestamp;
    v_prev_shift_date text;
    v_prev_recaudo numeric;
    v_already_closed boolean;
    v_archived_count integer := 0;
BEGIN
    v_now_bogota := NOW() AT TIME ZONE 'America/Bogota';

    FOR r IN 
        SELECT id, "agentUsername", "agentName", supervisor_id, COALESCE(NULLIF(TRIM(opening_time), ''), '06:00') as op_time
        FROM routes
        WHERE (p_route_id IS NULL OR id = p_route_id)
    LOOP
        v_opening_time := r.op_time;
        BEGIN
            v_open_time_val := (v_opening_time || ':00')::time;
        EXCEPTION WHEN OTHERS THEN
            v_open_time_val := '06:00:00'::time;
        END;

        v_shift_today := v_now_bogota::date + v_open_time_val;

        -- Solo se auto-archiva si ya comenzó el nuevo día laboral (hora actual >= hora apertura)
        IF v_now_bogota >= v_shift_today THEN
            v_prev_shift_date := to_char(v_now_bogota::date - INTERVAL '1 day', 'YYYY-MM-DD');

            -- Verificar si ya existe cierre para esa fecha
            SELECT EXISTS (
                SELECT 1 FROM cierres_jornada 
                WHERE route_id = r.id AND fecha_jornada = v_prev_shift_date
            ) INTO v_already_closed;

            IF NOT v_already_closed THEN
                -- Obtener recaudo de esa jornada previa
                v_prev_recaudo := get_agent_recaudo_hoy(r."agentUsername", v_prev_shift_date, r.id);
                IF v_prev_recaudo > 0 THEN
                    PERFORM cerrar_jornada_ruta(
                        r.id, 
                        r."agentUsername", 
                        r.supervisor_id, 
                        'automatico_reinicio', 
                        jsonb_build_object('motivo', 'Inicio de nuevo horario laboral - Reinicio a $0')
                    );
                    v_archived_count := v_archived_count + 1;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'archived_count', v_archived_count);
END;
$$;

GRANT EXECUTE ON FUNCTION verificar_cierre_automatico_jornada(text) TO anon, authenticated;


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
    v_recaudo_real numeric := 0;
    v_monto_prestado_anterior numeric := 0;
    v_intereses_actuales numeric := 0;
    v_is_old_carton_same_shift boolean := false;
    v_existing_payment_id text := NULL;
    v_new_id uuid;
    v_new_numero bigint;
    v_today_str text;
    v_payment_id text;
    v_agent_name text;
    v_now timestamptz := NOW();
    v_now_bogota timestamp;
    v_today_date date;
    v_shift_today timestamp;
    v_shift_start timestamptz;
    v_shift_end timestamptz;
    v_route_final text := NULL;
BEGIN
    -- Ventana de la Jornada Operativa actual (Regla estricta de las 06:00 AM en Colombia America/Bogota)
    v_now_bogota := v_now AT TIME ZONE 'America/Bogota';
    v_today_date := v_now_bogota::date;
    v_shift_today := v_today_date + '06:00:00'::time;
    IF v_now_bogota >= v_shift_today THEN
        v_shift_start := v_shift_today AT TIME ZONE 'America/Bogota';
        v_shift_end := (v_shift_today + INTERVAL '1 day') AT TIME ZONE 'America/Bogota';
        v_today_str := to_char(v_today_date, 'YYYY-MM-DD');
    ELSE
        v_shift_start := (v_shift_today - INTERVAL '1 day') AT TIME ZONE 'America/Bogota';
        v_shift_end := v_shift_today AT TIME ZONE 'America/Bogota';
        v_today_str := to_char(v_today_date - 1, 'YYYY-MM-DD');
    END IF;

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

    -- Saldo total a liquidar
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

    -- Evaluar si el cartón a renovar fue creado o renovado en esta MISMA jornada operativa
    IF v_old_carton.id IS NOT NULL THEN
        IF (v_old_carton.created_at IS NOT NULL AND v_old_carton.created_at >= v_shift_start AND v_old_carton.created_at < v_shift_end)
           OR (v_old_carton.created_at IS NULL AND v_old_carton.fecha_apertura IS NOT NULL AND v_old_carton.fecha_apertura >= v_shift_start AND v_old_carton.fecha_apertura < v_shift_end) THEN
            v_is_old_carton_same_shift := true;
        END IF;
    END IF;

    -- ========================================================
    -- CÁLCULO ESTRICTO DE RECAUDO REAL:
    -- Evitar acumular sumas fantasmas o duplicar el monto prestado/saldo anterior en el total del día
    -- ========================================================
    IF v_is_old_carton_same_shift THEN
        -- Retanqueo/Renovación sucesiva sobre un cartón originado en la misma jornada:
        -- El capital prestado de este cartón ya fue entregado hoy. Para no duplicar dicho capital
        -- en el "Recaudado Hoy", el recaudo registrado toma ÚNICAMENTE el valor real de los intereses
        -- o la ganancia/saldo neto cancelado en esta transacción.
        v_monto_prestado_anterior := COALESCE(v_old_carton.monto_prestado, 0);
        v_intereses_actuales := GREATEST(0, COALESCE(v_old_carton.total_debt, 0) - v_monto_prestado_anterior);
        
        IF v_saldo_liquidar > v_monto_prestado_anterior THEN
            v_recaudo_real := v_saldo_liquidar - v_monto_prestado_anterior;
        ELSE
            v_recaudo_real := LEAST(v_saldo_liquidar, v_intereses_actuales);
        END IF;
    ELSE
        -- Cartón originado en jornadas anteriores: todo el saldo restante a liquidar es recaudo legítimo
        v_recaudo_real := v_saldo_liquidar;
    END IF;

    -- ========================================================
    -- PASO 1: Registro en payments (con deduplicación estricta)
    -- ========================================================
    -- Verificar si ya existe un registro de liquidación por renovación para este cartón en la jornada actual
    IF v_target_old_id IS NOT NULL THEN
        BEGIN
            SELECT id INTO v_existing_payment_id
            FROM payments
            WHERE carton_id = v_target_old_id
              AND (
                  LOWER(COALESCE(payment_type, '')) = 'renovacion' 
                  OR "installmentNumber" = 999 
                  OR id LIKE 'pay_renov_%'
              )
              AND (
                  (created_at IS NOT NULL AND created_at >= v_shift_start AND created_at < v_shift_end)
                  OR (created_at IS NULL AND date = v_today_str)
              )
            ORDER BY created_at DESC
            LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            v_existing_payment_id := NULL;
        END;
    END IF;

    IF v_existing_payment_id IS NOT NULL THEN
        -- Si ya existe un pago de renovación en la misma jornada para este cartón, se actualiza
        -- evitando filas duplicadas que sumen doble en el recaudo diario
        UPDATE payments
        SET amount = v_recaudo_real,
            date = v_today_str,
            status = 'Pagado',
            payment_type = 'Renovacion',
            liquidado = true,
            "agentName" = v_agent_name,
            agent_id = p_agent_id,
            "routeId" = v_route_final,
            updated_at = v_now
        WHERE id = v_existing_payment_id;
        v_payment_id := v_existing_payment_id;
    ELSIF v_recaudo_real > 0 THEN
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
                v_recaudo_real,
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
                v_recaudo_real,
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
        'saldo_liquidado', v_recaudo_real,
        'saldo_restante_total', v_saldo_liquidar,
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
