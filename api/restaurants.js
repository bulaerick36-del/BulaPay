// Vercel Serverless Function: /api/restaurants (BulaFoodboT / Neon PostgreSQL)
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 
                         process.env.NEON_DATABASE_URL || 
                         process.env.POSTGRES_URL;

let pool;
function getPool() {
  if (!connectionString) {
    throw new Error('Falta la variable de entorno DATABASE_URL o NEON_DATABASE_URL en el panel de Vercel.');
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

async function ensureTableExists(client) {
  const createTableQuery = `
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
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await client.query(createTableQuery);

  // Asegurar que todas las columnas existan si la tabla fue creada previamente sin alguna de ellas
  try {
    await client.query(`
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS name TEXT;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS whatsapp TEXT;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_time TEXT DEFAULT '20-30 min';
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_price NUMERIC DEFAULT 0;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 5.0;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS image TEXT;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Restaurante';
    `);
  } catch (e) {
    console.warn('Aviso agregando columnas a restaurants:', e.message);
  }
}

// Helper para leer y parsear req.body en entornos Node/Vercel Serverless raw HTTP Stream
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
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  let client;
  try {
    const currentPool = getPool();
    client = await currentPool.connect();

    try {
      await ensureTableExists(client);
    } catch (tblErr) {
      console.warn('Aviso al verificar la estructura de la tabla restaurants:', tblErr.message);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await parseRequestBody(req);

      if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
        return res.status(400).json({ 
          success: false,
          error: 'El cuerpo de la petición (body) está vacío o no pudo ser parseado.'
        });
      }

      // Mapeo exclusivo de las columnas reales de la tabla restaurants en Neon (omitiendo campos de login/modal)
      const name = String(body.name || body.nombre || body.company || body.username || 'Nueva Vitrina Digital').trim();
      const whatsapp = String(body.whatsapp || body.phone || body.telefono || body.celular || '').trim();
      const delivery_time = String(body.delivery_time || body.deliveryTime || body.tiempoEntrega || '20-30 min').trim();
      
      const rawDeliveryPrice = body.delivery_price !== undefined ? body.delivery_price : (body.deliveryPrice !== undefined ? body.deliveryPrice : body.delivery_fee);
      const delivery_price = rawDeliveryPrice !== undefined ? Number(rawDeliveryPrice) || 0 : 0;

      const rating = body.rating !== undefined ? Number(body.rating) || 5.0 : 5.0;

      const rawReviewsCount = body.reviews_count !== undefined ? body.reviews_count : body.reviewsCount;
      const reviews_count = rawReviewsCount !== undefined ? Number(rawReviewsCount) || 0 : 0;

      const image = String(body.image || body.logo_url || body.logo || body.logoUrl || body.cover_url || '').trim();
      const category = String(body.category || body.categoria || body.product_category || 'Restaurante').trim();

      const insertQuery = `
        INSERT INTO restaurants (name, whatsapp, delivery_time, delivery_price, rating, reviews_count, image, category)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, whatsapp, delivery_time, delivery_price, rating, reviews_count, image, category, created_at;
      `;

      const values = [name, whatsapp, delivery_time, delivery_price, rating, reviews_count, image, category];

      const result = await client.query(insertQuery, values);
      const savedRestaurant = result.rows[0] || {};

      return res.status(200).json({
        success: true,
        message: '¡Tu Vitrina Digital ha sido creada y guardada en Neon PostgreSQL!',
        data: savedRestaurant,
        ...savedRestaurant
      });
    }

    // Consulta por defecto GET: Obtener todos los restaurantes
    const result = await client.query('SELECT id, name, whatsapp, delivery_time, delivery_price, rating, reviews_count, image, category, created_at FROM restaurants ORDER BY created_at DESC');
    return res.status(200).json(result.rows || []);

  } catch (err) {
    console.error('Error en base de datos Neon PostgreSQL (/api/restaurants):', err);
    return res.status(500).json({ 
      success: false,
      error: 'Error en Neon PostgreSQL (/api/restaurants): ' + (err.message || 'Fallo interno'),
      details: err.stack || null,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) {
      try { client.release(); } catch (e) {}
    }
  }
};
