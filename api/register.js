// Vercel Serverless Function: /api/register (BulaFood / Neon PostgreSQL)
// Lógica de Registro Doble (Usuarios y Restaurantes/Vitrinas) en Transacción SQL Segura

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL || 
                         process.env.NEON_DATABASE_URL || 
                         process.env.POSTGRES_URL;

let pool;
function getPool() {
  if (!connectionString) {
    throw new Error('Falta la variable de entorno DATABASE_URL o NEON_DATABASE_URL en la configuración de Vercel/Neon.');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

// Asegurar que las tablas usuarios y restaurants existan con su relación de llave foránea
async function ensureTables(client) {
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
  } catch (e) {
    // Si no se tienen permisos de superusuario para extensiones, gen_random_uuid() está disponible por defecto en PG 13+
  }

  // 1. Tabla usuarios para autenticación
  await client.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre TEXT NOT NULL,
      correo TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'dueño',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Tabla restaurants (vitrinas) con columna relacional dueño_id
  await client.query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      whatsapp TEXT,
      delivery_time TEXT DEFAULT '20-30 min',
      delivery_price NUMERIC DEFAULT 0,
      rating NUMERIC DEFAULT 5.0,
      reviews_count INTEGER DEFAULT 0,
      image TEXT,
      category TEXT DEFAULT 'Restaurante',
      dueño_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Asegurar que la columna relacional dueño_id / dueno_id exista si restaurants fue creada previamente
  try {
    await client.query(`
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS dueño_id UUID REFERENCES usuarios(id) ON DELETE CASCADE;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS dueno_id UUID REFERENCES usuarios(id) ON DELETE CASCADE;
    `);
  } catch (e) {
    console.warn('Aviso agregando columna relacional dueño_id a restaurants:', e.message);
  }
}

// Helper para parsear req.body en serverless HTTP stream
async function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.trim() !== '') {
    try { return JSON.parse(req.body); } catch (e) {}
  }
  try {
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const rawData = Buffer.concat(buffers).toString('utf-8');
    if (rawData && rawData.trim() !== '') {
      return JSON.parse(rawData);
    }
  } catch (e) {
    console.warn('Advertencia al leer stream del body:', e.message);
  }
  return req.body || {};
}

module.exports = async (req, res) => {
  // Configuración de cabeceras CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método no permitido. Utiliza POST para enviar la información de registro.'
    });
  }

  let client;
  try {
    const body = await parseRequestBody(req);

    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El cuerpo de la petición (body) está vacío o no pudo ser procesado.'
      });
    }

    // 1. Capturar datos del usuario / dueño
    const nombre = String(body.nombre || body.nombre_dueno || body.owner_name || body.name || body.username || '').trim();
    const correo = String(body.correo || body.email || body.correo_electronico || '').trim().toLowerCase();
    const rawPassword = String(body.password || body.contrasena || body.password_hash || '').trim();
    const rol = String(body.rol || body.role || 'dueño').trim();

    if (!nombre || !correo || !rawPassword) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos obligatorios del dueño: nombre, correo y contraseña son requeridos.'
      });
    }

    // Capturar datos del restaurante (vitrina)
    const restaurantName = String(body.restaurant_name || body.nombre_restaurante || body.name || body.company || body.nombre_vitrina || nombre).trim();
    const whatsapp = String(body.whatsapp || body.phone || body.telefono || body.celular || '').trim();
    const delivery_time = String(body.delivery_time || body.deliveryTime || body.tiempoEntrega || '20-30 min').trim();

    const rawDeliveryPrice = body.delivery_price !== undefined ? body.delivery_price : (body.deliveryPrice !== undefined ? body.deliveryPrice : body.delivery_fee);
    const delivery_price = rawDeliveryPrice !== undefined ? Number(rawDeliveryPrice) || 0 : 0;

    const rating = body.rating !== undefined ? Number(body.rating) || 5.0 : 5.0;

    const rawReviewsCount = body.reviews_count !== undefined ? body.reviews_count : body.reviewsCount;
    const reviews_count = rawReviewsCount !== undefined ? Number(rawReviewsCount) || 0 : 0;

    const image = String(body.image || body.logo_url || body.logo || body.logoUrl || body.cover_url || '').trim();
    const category = String(body.category || body.categoria || body.product_category || 'Restaurante').trim();

    // Hasheo de seguridad: Encriptar contraseña con bcrypt antes de enviarla a PostgreSQL
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(rawPassword, saltRounds);

    const currentPool = getPool();
    client = await currentPool.connect();

    // Verificar y asegurar la estructura de la base de datos
    await ensureTables(client);

    // Verificar si el correo ya está registrado en usuarios
    const existingUserCheck = await client.query('SELECT id FROM usuarios WHERE correo = $1', [correo]);
    if (existingUserCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'El correo electrónico ingresado ya se encuentra registrado.'
      });
    }

    // ==============================================================================
    // TRANSACCIÓN SEGURA (BEGIN / COMMIT / ROLLBACK)
    // ==============================================================================
    await client.query('BEGIN');

    try {
      // Step 2 & 3: Insertar Usuario en 'usuarios' y retornar el UUID autogenerado (RETURNING id)
      const userInsertQuery = `
        INSERT INTO usuarios (nombre, correo, password_hash, rol)
        VALUES ($1, $2, $3, $4)
        RETURNING id, nombre, correo, rol, created_at;
      `;
      const userResult = await client.query(userInsertQuery, [nombre, correo, password_hash, rol]);
      const nuevoUsuario = userResult.rows[0];
      const duenoId = nuevoUsuario.id; // UUID generado por PostgreSQL

      // Step 4: Insertar Restaurante (Vitrina) guardando ese UUID en la columna relacional 'dueño_id'
      const restaurantInsertQuery = `
        INSERT INTO restaurants (name, whatsapp, delivery_time, delivery_price, rating, reviews_count, image, category, dueño_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, name, whatsapp, delivery_time, delivery_price, rating, reviews_count, image, category, dueño_id, created_at;
      `;
      const restaurantValues = [
        restaurantName,
        whatsapp,
        delivery_time,
        delivery_price,
        rating,
        reviews_count,
        image,
        category,
        duenoId
      ];
      const restaurantResult = await client.query(restaurantInsertQuery, restaurantValues);
      const nuevoRestaurante = restaurantResult.rows[0];

      // Confirmar la transacción completa
      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        message: '¡Registro doble exitoso! Cuenta de dueño y Vitrina Digital enlazadas en Neon PostgreSQL.',
        data: {
          usuario: {
            id: nuevoUsuario.id,
            nombre: nuevoUsuario.nombre,
            correo: nuevoUsuario.correo,
            rol: nuevoUsuario.rol,
            created_at: nuevoUsuario.created_at
          },
          restaurante: nuevoRestaurante
        }
      });

    } catch (txError) {
      // En caso de fallo en la creación del restaurante o usuario, hacer ROLLBACK seguro
      await client.query('ROLLBACK');
      console.error('❌ Error en transacción SQL de registro. Se realizó ROLLBACK:', txError);
      return res.status(500).json({
        success: false,
        error: 'Error durante la transacción SQL de registro. La operación fue revertida (rollback).',
        details: txError.message
      });
    }

  } catch (err) {
    console.error('❌ Error general en /api/register:', err);
    return res.status(500).json({
      success: false,
      error: 'Error en el servidor (/api/register): ' + (err.message || 'Fallo interno'),
      details: err.stack || null,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) {
      try { client.release(); } catch (e) {}
    }
  }
};
