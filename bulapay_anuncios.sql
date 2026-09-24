-- =============================================================================
-- SCRIPT DE BASE DE DATOS UNIFICADA Y SUPABASE STORAGE - CREDIPAY ANUNCIOS
-- =============================================================================

-- 1. Crear / actualizar la tabla única de anuncios publicitarios: credipay_anuncios
CREATE TABLE IF NOT EXISTS credipay_anuncios (
  id TEXT PRIMARY KEY,
  categoria TEXT NOT NULL DEFAULT 'Comercial',
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  hora_inicio TEXT DEFAULT '00:00',
  hora_fin TEXT DEFAULT '23:59',
  detonante_general BOOLEAN DEFAULT false,
  detonante_cliente BOOLEAN DEFAULT false,
  descripcion TEXT NOT NULL,
  multimedia_url TEXT,
  impresiones BIGINT DEFAULT 0,
  clics BIGINT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar presencia de columnas requeridas si la tabla ya existía previamente
ALTER TABLE credipay_anuncios ADD COLUMN IF NOT EXISTS hora_inicio TEXT DEFAULT '00:00';
ALTER TABLE credipay_anuncios ADD COLUMN IF NOT EXISTS hora_fin TEXT DEFAULT '23:59';
ALTER TABLE credipay_anuncios ADD COLUMN IF NOT EXISTS impresiones BIGINT DEFAULT 0;
ALTER TABLE credipay_anuncios ADD COLUMN IF NOT EXISTS clics BIGINT DEFAULT 0;

-- Habilitar Row Level Security (RLS) y Políticas de Acceso
ALTER TABLE credipay_anuncios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a anonimos en credipay_anuncios" ON credipay_anuncios;
CREATE POLICY "Permitir todo a anonimos en credipay_anuncios" 
  ON credipay_anuncios FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

GRANT ALL ON TABLE credipay_anuncios TO anon, authenticated;

-- 2. Crear y Configurar Bucket de Supabase Storage para Multimedia ('credipay-multimedia')
INSERT INTO storage.buckets (id, name, public)
VALUES ('credipay-multimedia', 'credipay-multimedia', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas RLS para el Bucket 'credipay-multimedia' en storage.objects
DROP POLICY IF EXISTS "Acceso publico lectura credipay-multimedia" ON storage.objects;
CREATE POLICY "Acceso publico lectura credipay-multimedia" 
  ON storage.objects FOR SELECT 
  TO public 
  USING (bucket_id = 'credipay-multimedia');

DROP POLICY IF EXISTS "Acceso publico insercion credipay-multimedia" ON storage.objects;
CREATE POLICY "Acceso publico insercion credipay-multimedia" 
  ON storage.objects FOR INSERT 
  TO public 
  WITH CHECK (bucket_id = 'credipay-multimedia');

DROP POLICY IF EXISTS "Acceso publico actualizacion credipay-multimedia" ON storage.objects;
CREATE POLICY "Acceso publico actualizacion credipay-multimedia" 
  ON storage.objects FOR UPDATE 
  TO public 
  USING (bucket_id = 'credipay-multimedia');

DROP POLICY IF EXISTS "Acceso publico eliminacion credipay-multimedia" ON storage.objects;
CREATE POLICY "Acceso publico eliminacion credipay-multimedia" 
  ON storage.objects FOR DELETE 
  TO public 
  USING (bucket_id = 'credipay-multimedia');
