// Vercel Serverless Function: /api/restaurants
// Backend proxy serverless para la tabla restaurants en Supabase utilizando la Secret Key desde variables de entorno

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vxvyiklzyfmfbrgwqgxv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_gXixzFlqN8TgbAwq6BsgWQ_LFfhnU4X';

module.exports = async (req, res) => {
  // Manejo de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, Prefer');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string' && body.trim() !== '') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        // Mantener como string si no se puede parsear
      }
    }

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    };

    let targetUrl = `${SUPABASE_URL}/rest/v1/restaurants`;
    
    // Obtener la query string si existe (ej. ?select=* o ?id=eq.123)
    const queryString = new URL(req.url, `http://${req.headers.host || 'localhost'}`).search;
    if (queryString) {
      targetUrl += queryString;
    }

    const fetchOptions = {
      method: req.method,
      headers: headers
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      headers['Prefer'] = 'return=representation';
      if (body) {
        fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : body;
      }
    }

    const response = await fetch(targetUrl, fetchOptions);
    const responseText = await response.text();

    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch (e) {
      jsonResponse = responseText;
    }

    res.status(response.status).json(jsonResponse);
  } catch (error) {
    console.error('[API RESTAURANTS ERROR]', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
};
