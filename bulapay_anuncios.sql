-- =============================================================================
-- SCRIPT DE BASE DE DATOS UNIFICADA Y SUPABASE STORAGE - BULAPAY ANUNCIOS
-- =============================================================================

-- 1. Crear / actualizar la tabla única de anuncios publicitarios: bulapay_anuncios
CREATE TABLE IF NOT EXISTS bulapay_anuncios (
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
ALTER TABLE bulapay_anuncios ADD COLUMN IF NOT EXISTS hora_inicio TEXT DEFAULT '00:00';
ALTER TABLE bulapay_anuncios ADD COLUMN IF NOT EXISTS hora_fin TEXT DEFAULT '23:59';
ALTER TABLE bulapay_anuncios ADD COLUMN IF NOT EXISTS impresiones BIGINT DEFAULT 0;
ALTER TABLE bulapay_anuncios ADD COLUMN IF NOT EXISTS clics BIGINT DEFAULT 0;

-- Habilitar Row Level Security (RLS) y Políticas de Acceso
ALTER TABLE bulapay_anuncios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a anonimos en bulapay_anuncios" ON bulapay_anuncios;
CREATE POLICY "Permitir todo a anonimos en bulapay_anuncios" 
  ON bulapay_anuncios FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

GRANT ALL ON TABLE bulapay_anuncios TO anon, authenticated;

-- 2. Crear y Configurar Bucket de Supabase Storage para Multimedia ('bulapay-multimedia')
INSERT INTO storage.buckets (id, name, public)
VALUES ('bulapay-multimedia', 'bulapay-multimedia', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas RLS para el Bucket 'bulapay-multimedia' en storage.objects
DROP POLICY IF EXISTS "Acceso publico lectura bulapay-multimedia" ON storage.objects;
CREATE POLICY "Acceso publico lectura bulapay-multimedia" 
  ON storage.objects FOR SELECT 
  TO public 
  USING (bucket_id = 'bulapay-multimedia');

DROP POLICY IF EXISTS "Acceso publico insercion bulapay-multimedia" ON storage.objects;
CREATE POLICY "Acceso publico insercion bulapay-multimedia" 
  ON storage.objects FOR INSERT 
  TO public 
  WITH CHECK (bucket_id = 'bulapay-multimedia');

DROP POLICY IF EXISTS "Acceso publico actualizacion bulapay-multimedia" ON storage.objects;
CREATE POLICY "Acceso publico actualizacion bulapay-multimedia" 
  ON storage.objects FOR UPDATE 
  TO public 
  USING (bucket_id = 'bulapay-multimedia');

DROP POLICY IF EXISTS "Acceso publico eliminacion bulapay-multimedia" ON storage.objects;
CREATE POLICY "Acceso publico eliminacion bulapay-multimedia" 
  ON storage.objects FOR DELETE 
  TO public 
  USING (bucket_id = 'bulapay-multimedia');
