-- ==============================================================================
-- CREDIPAI SaaS - TABLA AGENTES DE RUTA (Relación con Rutas y Supervisores)
-- ==============================================================================

-- 1. Creación de la Tabla agentes_ruta
CREATE TABLE IF NOT EXISTS agentes_ruta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relación obligatoria 1: Ruta asignada (Ej: "route_1", "Ruta San Diego")
    ruta_id TEXT REFERENCES routes("id") ON DELETE SET NULL ON UPDATE CASCADE,
    
    -- Relación obligatoria 2: Supervisor a cargo del agente (Ej: "admin", "medellin_sup")
    supervisor_id TEXT NOT NULL REFERENCES users("username") ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Perfil del Agente
    username TEXT UNIQUE REFERENCES users("username") ON DELETE CASCADE ON UPDATE CASCADE,
    nombre TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    documento_identidad TEXT,
    
    -- Estado Operativo y Metas
    estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'en_ruta', 'pausado', 'suspendido')),
    comision_porcentaje NUMERIC(5, 2) DEFAULT 0.00 CHECK (comision_porcentaje >= 0 AND comision_porcentaje <= 100),
    meta_diaria NUMERIC(12, 2) DEFAULT 0.00,
    base_cambio_permitida NUMERIC(12, 2) DEFAULT 0.00, -- Base de efectivo en físico entregada por el supervisor para dar cambio
    
    -- Telemetría y Geolocalización (Tracking en vivo para el Panel del Supervisor)
    last_lat NUMERIC(10, 8),
    last_lng NUMERIC(11, 8),
    last_location_time TIMESTAMPTZ,
    
    -- Auditoría de Registros
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices de Alto Rendimiento para Consultas del Supervisor
CREATE INDEX IF NOT EXISTS idx_agentes_ruta_supervisor ON agentes_ruta(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_agentes_ruta_ruta ON agentes_ruta(ruta_id);
CREATE INDEX IF NOT EXISTS idx_agentes_ruta_estado ON agentes_ruta(estado);

-- 3. Trigger para Actualizar Automáticamente 'updated_at'
CREATE OR REPLACE FUNCTION update_agentes_ruta_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agentes_ruta_updated_at ON agentes_ruta;
CREATE TRIGGER trg_agentes_ruta_updated_at
BEFORE UPDATE ON agentes_ruta
FOR EACH ROW EXECUTE FUNCTION update_agentes_ruta_modtime();

-- 4. Seguridad a Nivel de Fila (RLS) y Permisos en Supabase
ALTER TABLE agentes_ruta ENABLE ROW LEVEL SECURITY;

-- Política 1: Los supervisores gestionan únicamente los agentes bajo su supervisor_id
DROP POLICY IF EXISTS "Supervisores ven y gestionan sus agentes de ruta" ON agentes_ruta;
CREATE POLICY "Supervisores ven y gestionan sus agentes de ruta"
ON agentes_ruta FOR ALL TO authenticated
USING (supervisor_id = auth.uid()::text OR supervisor_id IN (SELECT username FROM users WHERE username = auth.uid()::text))
WITH CHECK (supervisor_id = auth.uid()::text OR supervisor_id IN (SELECT username FROM users WHERE username = auth.uid()::text));

-- Política 2: Permisos generales para el cliente web SPA CrediPai (roles anon y authenticated)
DROP POLICY IF EXISTS "Permitir todo a anonimos y autenticados en agentes_ruta" ON agentes_ruta;
CREATE POLICY "Permitir todo a anonimos y autenticados en agentes_ruta" 
ON agentes_ruta FOR ALL TO anon, authenticated 
USING (true) WITH CHECK (true);

-- Permisos de tabla
GRANT ALL ON TABLE agentes_ruta TO anon, authenticated, service_role;

-- 5. Registro de Datos Semilla para Pruebas
INSERT INTO agentes_ruta (ruta_id, supervisor_id, username, nombre, telefono, email, estado, meta_diaria)
VALUES 
  ('route_1', 'admin', 'agente1', 'Juan Pérez', '+57 311 555 1234', 'juan.perez@credipai.com', 'en_ruta', 250000),
  ('route_2', 'admin', 'agente2', 'María López', '+57 312 555 6789', 'maria.lopez@credipai.com', 'activo', 300000)
ON CONFLICT (username) DO UPDATE 
SET ruta_id = EXCLUDED.ruta_id, supervisor_id = EXCLUDED.supervisor_id, updated_at = NOW();
