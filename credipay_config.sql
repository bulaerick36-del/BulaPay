-- =============================================================================
-- TABLA DE CONFIGURACIÓN GLOBAL BULAPAY (bulapay_config)
-- =============================================================================

CREATE TABLE IF NOT EXISTS bulapay_config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS) y Políticas de Acceso
ALTER TABLE bulapay_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso publico a bulapay_config" ON bulapay_config;
CREATE POLICY "Permitir acceso publico a bulapay_config" 
  ON bulapay_config FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

GRANT ALL ON TABLE bulapay_config TO anon, authenticated;
