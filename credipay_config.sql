-- =============================================================================
-- TABLA DE CONFIGURACIÓN GLOBAL CREDIPAY (credipay_config)
-- =============================================================================

CREATE TABLE IF NOT EXISTS credipay_config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS) y Políticas de Acceso
ALTER TABLE credipay_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso publico a credipay_config" ON credipay_config;
CREATE POLICY "Permitir acceso publico a credipay_config" 
  ON credipay_config FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

GRANT ALL ON TABLE credipay_config TO anon, authenticated;
