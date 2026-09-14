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
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'Restaurante',
      whatsapp TEXT,
      address TEXT,
      description TEXT,
      logo_url TEXT,
      cover_url TEXT,
      is_open BOOLEAN DEFAULT true,
      delivery_fee NUMERIC DEFAULT 0,
      min_order NUMERIC DEFAULT 0,
      rating NUMERIC DEFAULT 5.0,
      reviews_count INTEGER DEFAULT 0,
      delivery_time TEXT DEFAULT '20-30 min',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await client.query(createTableQuery);
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

      const id = String(body.id || body.restaurant_id || 'rest_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)).trim();
      const name = String(body.name || body.nombre || body.store_name || body.restaurante || 'Nuevo Restaurante').trim();
      const category = String(body.category || body.categoria || 'Restaurante').trim();
      const whatsapp = String(body.whatsapp || body.phone || body.telefono || body.celular || '').trim();
      const address = String(body.address || body.direccion || '').trim();
      const description = String(body.description || body.descripcion || '').trim();
      const logo_url = String(body.logo_url || body.logo || body.logoUrl || body.image || '').trim();
      const cover_url = String(body.cover_url || body.cover || body.coverUrl || body.banner || '').trim();
      
      const rawIsOpen = body.is_open !== undefined ? body.is_open : (body.isOpen !== undefined ? body.isOpen : body.abierto);
      const is_open = rawIsOpen !== undefined ? Boolean(rawIsOpen) : true;

      const rawDeliveryFee = body.delivery_fee !== undefined ? body.delivery_fee : (body.deliveryFee !== undefined ? body.deliveryFee : body.domicilio);
      const delivery_fee = rawDeliveryFee !== undefined ? Number(rawDeliveryFee) || 0 : 0;

      const rawMinOrder = body.min_order !== undefined ? body.min_order : (body.minOrder !== undefined ? body.minOrder : body.pedidoMinimo);
      const min_order = rawMinOrder !== undefined ? Number(rawMinOrder) || 0 : 0;

      const rating = body.rating !== undefined ? Number(body.rating) || 5.0 : 5.0;
      const reviews_count = body.reviews_count !== undefined ? Number(body.reviews_count) || (body.reviewsCount !== undefined ? Number(body.reviewsCount) || 0 : 0) : 0;
      const delivery_time = String(body.delivery_time || body.deliveryTime || body.tiempoEntrega || '20-30 min').trim();

      const insertQuery = `
        INSERT INTO restaurants (
          id, name, category, whatsapp, address, description, logo_url, cover_url, 
          is_open, delivery_fee, min_order, rating, reviews_count, delivery_time
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          whatsapp = EXCLUDED.whatsapp,
          address = EXCLUDED.address,
          description = EXCLUDED.description,
          logo_url = EXCLUDED.logo_url,
          cover_url = EXCLUDED.cover_url,
          is_open = EXCLUDED.is_open,
          delivery_fee = EXCLUDED.delivery_fee,
          min_order = EXCLUDED.min_order,
          rating = EXCLUDED.rating,
          reviews_count = EXCLUDED.reviews_count,
          delivery_time = EXCLUDED.delivery_time
        RETURNING *;
      `;

      const values = [
        id, name, category, whatsapp, address, description, logo_url, cover_url,
        is_open, delivery_fee, min_order, rating, reviews_count, delivery_time
      ];

      const result = await client.query(insertQuery, values);
      const savedRestaurant = result.rows[0] || {};

      return res.status(200).json({
        success: true,
        message: 'Restaurante / vitrina guardado exitosamente',
        data: savedRestaurant,
        ...savedRestaurant
      });
    }

    // Consulta por defecto GET: Obtener todos los restaurantes
    const result = await client.query('SELECT * FROM restaurants ORDER BY created_at DESC');
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
