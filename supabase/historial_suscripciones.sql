-- =============================================================================
-- TABLA DE HISTORIAL DE SUSCRIPCIONES Y LÓGICA DE CICLOS CREDIPAY
-- =============================================================================

-- 1. Asegurar columnas de ciclos en la tabla users
ALTER TABLE users ADD COLUMN IF NOT EXISTS "ciclo_actual" INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "fecha_inicio_ciclo" TIMESTAMPTZ DEFAULT NOW();

-- 2. Tabla de Historial por Ciclos de Suscripción
CREATE TABLE IF NOT EXISTS historial_suscripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL REFERENCES users("username") ON DELETE CASCADE,
  ciclo_numero INTEGER NOT NULL DEFAULT 1,
  anio INTEGER NOT NULL,
  nombre_ciclo TEXT NOT NULL,
  monto NUMERIC DEFAULT 50000,
  estado TEXT DEFAULT 'Pagado',
  fecha_inicio TIMESTAMPTZ,
  fecha_vencimiento TIMESTAMPTZ,
  fecha_pago TIMESTAMPTZ DEFAULT NOW(),
  metodo_pago TEXT DEFAULT 'Manual (Superadmin)',
  registrado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS) y Políticas de Acceso
ALTER TABLE historial_suscripciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a todos en historial_suscripciones" ON historial_suscripciones;
CREATE POLICY "Permitir todo a todos en historial_suscripciones" 
  ON historial_suscripciones FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

GRANT ALL ON TABLE historial_suscripciones TO anon, authenticated;
