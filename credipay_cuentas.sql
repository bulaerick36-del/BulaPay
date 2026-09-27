-- =============================================================================
-- TABLA DE CUENTAS DE RECAUDO CREDIPAY (credipay_cuentas)
-- =============================================================================

CREATE TABLE IF NOT EXISTS credipay_cuentas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  banco TEXT NOT NULL,
  tipo_cuenta TEXT NOT NULL,
  numero_cuenta TEXT NOT NULL,
  titular TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS) y Políticas de Acceso
ALTER TABLE credipay_cuentas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acceso publico a credipay_cuentas" ON credipay_cuentas;
CREATE POLICY "Permitir acceso publico a credipay_cuentas" 
  ON credipay_cuentas FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

GRANT ALL ON TABLE credipay_cuentas TO anon, authenticated;
