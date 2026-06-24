-- Script Maestro para Supabase (BulaPay PostgreSQL Schema)

-- Habilitar RLS (Row Level Security) y políticas de acceso para la clave anon
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS routes;

-- 1. Tabla de Rutas
CREATE TABLE routes (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "agentUsername" TEXT,
  "agentName" TEXT,
  "capital" NUMERIC NOT NULL DEFAULT 0,
  "collected" NUMERIC NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'En Ruta',
  "date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "supervisor_id" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "opening_time" TEXT DEFAULT '06:00',
  "closing_time" TEXT DEFAULT '18:00',
  "has_extension" BOOLEAN DEFAULT false
);

-- 2. Tabla de Usuarios
CREATE TABLE users (
  "username" TEXT PRIMARY KEY,
  "password" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "company" TEXT,
  "city" TEXT,
  "zone" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "supervisor" TEXT REFERENCES users("username") ON DELETE SET NULL,
  "routeId" TEXT REFERENCES routes("id") ON DELETE SET NULL,
  "documentType" TEXT,
  "documentNumber" TEXT,
  "estado_suscripcion" TEXT DEFAULT 'activa_prueba',
  "id_metodo_pago" TEXT,
  "supervisor_id" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "last_lat" NUMERIC,
  "last_lng" NUMERIC,
  "last_location_time" TIMESTAMPTZ
);

-- 3. Tabla de Clientes
CREATE TABLE clients (
  "cedula" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "city" TEXT NOT NULL,
  "zone" TEXT NOT NULL,
  "risk" TEXT NOT NULL DEFAULT 'Verde',
  "totalDebt" NUMERIC NOT NULL DEFAULT 0,
  "outstanding" NUMERIC NOT NULL DEFAULT 0,
  "installmentsCount" INTEGER NOT NULL DEFAULT 1,
  "installmentAmount" NUMERIC NOT NULL DEFAULT 0,
  "routeId" TEXT REFERENCES routes("id") ON DELETE SET NULL,
  "supervisor_id" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Pagos
CREATE TABLE payments (
  "id" TEXT PRIMARY KEY,
  "clientCedula" TEXT REFERENCES clients("cedula") ON DELETE CASCADE,
  "installmentNumber" INTEGER NOT NULL,
  "amount" NUMERIC NOT NULL,
  "date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "agentName" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "supervisor_id" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS en todas las tablas
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Crear políticas para permitir todo a usuarios anonimos (para simplificar la SPA de demostración)
CREATE POLICY "Permitir todo a anonimos en routes" ON routes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anonimos en users" ON users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anonimos en clients" ON clients FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anonimos en payments" ON payments FOR ALL TO anon USING (true) WITH CHECK (true);

-- Otorgar privilegios explícitos a los roles anon y authenticated (debido a que se deshabilitó la exposición automática de tablas)
GRANT ALL ON TABLE routes TO anon, authenticated;
GRANT ALL ON TABLE users TO anon, authenticated;
GRANT ALL ON TABLE clients TO anon, authenticated;
GRANT ALL ON TABLE payments TO anon, authenticated;

INSERT INTO users ("username", "password", "name", "role", "company", "city", "zone", "phone", "email") VALUES
('admin', '123', 'Carlos Mendoza', 'Usuario Supervisor', 'Logística Mendoza S.A.', 'Bogotá', 'Chapinero / Norte', '+57 315 123 4567', 'contacto@logisticamendoza.co'),
('tienda', '123', 'Almacén La Esquina', 'Comercio Independiente', 'Almacén La Esquina', 'Bogotá', 'Centro / Santa Fe', '+57 318 987 6543', 'laesquina@gmail.com'),
('medellin_sup', '123', 'Inés Restrepo', 'Usuario Supervisor', 'Inversiones Antioquia', 'Medellín', 'El Poblado / Laureles', '+57 310 444 5566', 'contacto@inversionesantioquia.com'),
('cali_sup', '123', 'Felipe Caicedo', 'Usuario Supervisor', 'CrediCali S.A.S.', 'Cali', 'Oriente / Versalles', '+57 312 888 9900', 'felipe.caicedo@credicali.com');

-- 2. Rutas Semilla
INSERT INTO routes ("id", "name", "agentUsername", "agentName", "capital", "collected", "status", "date") VALUES
('route_1', 'Ruta Centro - Norte', 'agente1', 'Juan Pérez', 500000, 180000, 'En Ruta', '2026-06-18'),
('route_2', 'Ruta Zona Sur', 'agente2', 'María López', 300000, 150000, 'Completado', '2026-06-18');

-- 3. Agentes de Ruta Semilla (que dependen de las rutas)
INSERT INTO users ("username", "password", "name", "role", "company", "city", "zone", "phone", "email", "supervisor", "routeId") VALUES
('agente1', '123', 'Juan Pérez', 'Agente de Ruta', NULL, NULL, NULL, NULL, NULL, 'admin', 'route_1'),
('agente2', '123', 'María López', 'Agente de Ruta', NULL, NULL, NULL, NULL, NULL, 'admin', 'route_2');

-- 4. Clientes Semilla
INSERT INTO clients ("cedula", "name", "phone", "email", "city", "zone", "risk", "totalDebt", "outstanding", "installmentsCount", "installmentAmount", "routeId") VALUES
('12345', 'Roberto Gómez', '3115551234', 'roberto.gomez@gmail.com', 'Bogotá', 'Centro', 'Verde', 500000, 150000, 5, 100000, 'route_1'),
('67890', 'Ana María Silva', '3125556789', 'ana.silva@outlook.com', 'Bogotá', 'Norte', 'Amarillo', 400000, 240000, 5, 80000, 'route_1'),
('11223', 'Pedro Pablo Restrepo', '3105559988', 'pedro.restrepo@yahoo.com', 'Medellín', 'Sur', 'Rojo', 600000, 450000, 6, 100000, 'route_2');

-- 5. Pagos Semilla
INSERT INTO payments ("id", "clientCedula", "installmentNumber", "amount", "date", "agentName", "status", "signature") VALUES
('pay_1', '12345', 1, 100000, '2026-06-01', 'Juan Pérez', 'Pagado', 'BulaPay-SIG-12345-01'),
('pay_2', '12345', 2, 100000, '2026-06-08', 'Juan Pérez', 'Pagado', 'BulaPay-SIG-12345-02'),
('pay_3', '12345', 3, 150000, '2026-06-15', 'Juan Pérez', 'Pagado', 'BulaPay-SIG-12345-03'),
('pay_4', '67890', 1, 80000, '2026-06-02', 'Juan Pérez', 'Pagado', 'BulaPay-SIG-67890-01'),
('pay_5', '67890', 2, 80000, '2026-06-12', 'Juan Pérez', 'Pagado', 'BulaPay-SIG-67890-02'),
('pay_6', '11223', 1, 100000, '2026-05-20', 'María López', 'Pagado', 'BulaPay-SIG-11223-01'),
('pay_7', '11223', 2, 50000, '2026-05-30', 'María López', 'Abonado', 'BulaPay-SIG-11223-02');

-- Migraciones seguras para bases de datos existentes:
ALTER TABLE routes ADD COLUMN IF NOT EXISTS "opening_time" TEXT DEFAULT '06:00';
ALTER TABLE routes ADD COLUMN IF NOT EXISTS "closing_time" TEXT DEFAULT '18:00';
ALTER TABLE routes ADD COLUMN IF NOT EXISTS "has_extension" BOOLEAN DEFAULT false;
