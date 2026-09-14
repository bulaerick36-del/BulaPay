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

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string' && body.trim() !== '') {
        try { body = JSON.parse(body); } catch (e) {}
      }

      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'El cuerpo de la petición es inválido o está vacío' });
      }

      const id = body.id || 'rest_' + Date.now();
      const name = body.name || body.nombre || 'Nuevo Restaurante';
      const category = body.category || body.categoria || 'Restaurante';
      const whatsapp = body.whatsapp || body.phone || body.telefono || '';
      const address = body.address || body.direccion || '';
      const description = body.description || body.descripcion || '';
      const logo_url = body.logo_url || body.logo || '';
      const cover_url = body.cover_url || body.cover || body.banner || '';
      const is_open = body.is_open !== undefined ? Boolean(body.is_open) : true;
      const delivery_fee = body.delivery_fee !== undefined ? Number(body.delivery_fee) || 0 : 0;
      const min_order = body.min_order !== undefined ? Number(body.min_order) || 0 : 0;
      const rating = body.rating !== undefined ? Number(body.rating) || 5.0 : 5.0;
      const reviews_count = body.reviews_count !== undefined ? Number(body.reviews_count) || 0 : 0;
      const delivery_time = body.delivery_time || '20-30 min';

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
      return res.status(200).json(result.rows[0] || {});
    }

    // Consulta por defecto GET: Obtener todos los restaurantes
    const result = await client.query('SELECT * FROM restaurants ORDER BY created_at DESC');
    return res.status(200).json(result.rows || []);

  } catch (err) {
    console.error('Error en base de datos Neon PostgreSQL (/api/restaurants):', err);
    return res.status(500).json({ 
      error: 'Error de conexión o consulta en Neon PostgreSQL: ' + (err.message || 'Fallo interno'),
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) {
      try { client.release(); } catch (e) {}
    }
  }
};
