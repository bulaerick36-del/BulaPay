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

-- 3. Función RPC get_agent_recaudo_hoy basada en el Ciclo Diario de Recaudo (Regla de las 6:00 AM a 5:59 AM)
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
    v_open_time_val time := '06:00:00'::time;
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

    -- 1. Obtener la ruta vinculada si se consulta por agente
    IF v_clean_route IS NULL AND v_clean_agent IS NOT NULL THEN
        SELECT r.id
        INTO v_clean_route
        FROM routes r
        WHERE LOWER(r."agentUsername") = LOWER(v_clean_agent)
           OR LOWER(COALESCE(r."agentName", '')) = LOWER(v_clean_agent)
           OR r.id IN (SELECT u."routeId" FROM users u WHERE LOWER(u.username) = LOWER(v_clean_agent))
        LIMIT 1;
    END IF;

    -- 2. Regla estricta de las 6:00 AM:
    -- El día operativo comienza estrictamente a las 06:00:00 AM del día actual y termina a las 05:59:59.999 AM del día siguiente (America/Bogota, UTC-5).
    -- Cualquier cobro o renovación realizado en la noche (ej. 7:00 PM u 8:00 PM) pertenece y se suma al día en curso.
    -- El reseteo a $0 ocurre únicamente al cruzar las 6:00 AM de la nueva mañana.
    v_open_time_val := '06:00:00'::time;
    v_now_bogota := NOW() AT TIME ZONE 'America/Bogota';
    v_today_date := v_now_bogota::date;
    v_shift_today := v_today_date + v_open_time_val;

    IF p_date IS NOT NULL AND p_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
        -- Si se especifica una fecha operativa explícita, la jornada va desde las 6:00 AM de esa fecha hasta las 5:59:59 AM del día siguiente
        v_shift_start_local := p_date::date + v_open_time_val;
        v_shift_end_local := v_shift_start_local + INTERVAL '1 day';
    ELSE
        -- Jornada activa actual: si la hora actual en Colombia es antes de las 6:00 AM (ej: 11:00 PM o 2:00 AM),
        -- pertenece a la jornada operativa iniciada a las 6:00 AM del turno en curso
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
    v_effective_start := v_shift_start;

    -- 3. Calcular el recaudo acumulado en la ventana [06:00:00 AM, 06:00:00 AM día siguiente)
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
            (p.created_at IS NULL AND p.date = v_shift_start_local::date)
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
            WHERE p.carton_id = c.id::text 
            AND (LOWER(COALESCE(p.payment_type, '')) = 'renovacion' OR p."installmentNumber" = 999)
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

-- 5. RPC para Auto-Cierre / Archivo de Jornada Previa al Cruzar las 6:00 AM de la Nueva Mañana
CREATE OR REPLACE FUNCTION verificar_cierre_automatico_jornada(
    p_route_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    v_open_time_val time := '06:00:00'::time;
    v_now_bogota timestamp;
    v_shift_today timestamp;
    v_prev_shift_date text;
    v_prev_recaudo numeric;
    v_already_closed boolean;
    v_archived_count integer := 0;
    v_cierre_id text;
BEGIN
    v_now_bogota := NOW() AT TIME ZONE 'America/Bogota';
    v_shift_today := v_now_bogota::date + v_open_time_val;

    FOR r IN 
        SELECT id, "agentUsername", "agentName", supervisor_id
        FROM routes
        WHERE (p_route_id IS NULL OR id = p_route_id)
    LOOP
        -- Solo se auto-archiva la jornada anterior cuando ya se cruzó las 6:00 AM de la nueva mañana
        IF v_now_bogota >= v_shift_today THEN
            v_prev_shift_date := to_char(v_now_bogota::date - INTERVAL '1 day', 'YYYY-MM-DD');

            -- Verificar si ya existe cierre para esa fecha previa
            SELECT EXISTS (
                SELECT 1 FROM cierres_jornada 
                WHERE route_id = r.id AND fecha_jornada = v_prev_shift_date
            ) INTO v_already_closed;

            IF NOT v_already_closed THEN
                -- Obtener recaudo de esa jornada previa (6:00 AM ayer a 5:59 AM hoy)
                v_prev_recaudo := get_agent_recaudo_hoy(r."agentUsername", v_prev_shift_date, r.id);
                IF v_prev_recaudo > 0 THEN
                    v_cierre_id := 'cierre_' || COALESCE(r.id, 'gral') || '_' || v_prev_shift_date || '_auto6am';
                    INSERT INTO cierres_jornada (
                        id, route_id, agent_id, agent_name, supervisor_id,
                        fecha_jornada, hora_apertura, inicio_jornada, fin_jornada,
                        fecha_cierre, total_recaudado, tipo_cierre, detalles, created_at
                    ) VALUES (
                        v_cierre_id,
                        r.id,
                        r."agentUsername",
                        COALESCE(r."agentName", r."agentUsername"),
                        r.supervisor_id,
                        v_prev_shift_date,
                        '06:00',
                        (v_prev_shift_date::date + v_open_time_val) AT TIME ZONE 'America/Bogota',
                        v_shift_today AT TIME ZONE 'America/Bogota',
                        v_shift_today AT TIME ZONE 'America/Bogota',
                        v_prev_recaudo,
                        'automatico_reinicio',
                        jsonb_build_object('motivo', 'Reinicio diario estricto a las 6:00 AM'),
                        NOW()
                    ) ON CONFLICT (id) DO NOTHING;
                    v_archived_count := v_archived_count + 1;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'archived_count', v_archived_count);
END;
$$;

GRANT EXECUTE ON FUNCTION verificar_cierre_automatico_jornada(text) TO anon, authenticated;
