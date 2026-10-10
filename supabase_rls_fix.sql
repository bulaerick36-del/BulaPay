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
