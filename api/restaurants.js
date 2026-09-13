// Vercel Serverless Function: /api/restaurants (?v=11002)
// Conexión exclusiva a Neon PostgreSQL mediante la librería pg (node-postgres) sin dependencias de Supabase

const { Pool } = require('pg');

const connectionString = process.env.NEON_DATABASE_URL || 
                         process.env.DATABASE_URL || 
                         'postgresql://neondb_owner:npg_79zJpZqT6xfa@ep-falling-pond-ayeyaxml-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
  }
  return pool;
}

// Inicialización automática de la tabla de restaurantes en Neon PostgreSQL
async function initDatabase(client) {
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
  // Configuración de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const p = getPool();
  let client;

  try {
    client = await p.connect();
    // Asegurar que la tabla existe
    await initDatabase(client);

    // 1. GET: Obtener todos los restaurantes
    if (req.method === 'GET') {
      const result = await client.query('SELECT * FROM restaurants ORDER BY created_at DESC');
      return res.status(200).json(result.rows);
    }

    // 2. POST: Insertar o actualizar un restaurante
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string' && body.trim() !== '') {
        try { body = JSON.parse(body); } catch (e) {}
      }

      if (!body) {
        return res.status(400).json({ error: 'El cuerpo de la petición no puede estar vacío' });
      }

      const id = body.id || 'rest_' + Date.now();
      const name = body.name || body.nombre || 'Nuevo Restaurante';
      const category = body.category || body.categoria || 'Restaurante';
      const whatsapp = body.whatsapp || body.phone || body.telefono || '';
      const address = body.address || body.direccion || '';
      const description = body.description || body.descripcion || '';
      const logo_url = body.logo_url || body.logo || '';
      const cover_url = body.cover_url || body.cover || body.banner || '';
      const is_open = body.is_open !== undefined ? body.is_open : true;
      const delivery_fee = body.delivery_fee !== undefined ? body.delivery_fee : 0;
      const min_order = body.min_order !== undefined ? body.min_order : 0;
      const rating = body.rating !== undefined ? body.rating : 5.0;
      const reviews_count = body.reviews_count !== undefined ? body.reviews_count : 0;
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
      return res.status(200).json(result.rows[0]);
    }

    res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('[NEON POSTGRES API ERROR]', error);
    res.status(500).json({ error: error.message || 'Error en la base de datos Neon PostgreSQL' });
  } finally {
    if (client) {
      client.release();
    }
  }
};
