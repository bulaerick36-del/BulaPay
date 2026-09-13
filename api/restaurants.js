// Serverless Function de Vercel (/api/restaurants) - v=10001
// Ejecuta consultas y escrituras del lado del servidor (Node.js) enviando apikey y Authorization explicito

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vxvyiklzyfmfbrgwqgxv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_gXixzFlqN8TgbAwq6BsgWQ_LFfhnU4X';

module.exports = async (req, res) => {
  // Manejo de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, Prefer');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    let targetUrl = `${SUPABASE_URL}/rest/v1/restaurants`;
    const queryString = new URL(req.url, `http://${req.headers.host || 'localhost'}`).search;
    if (queryString) {
      targetUrl += queryString;
    }

    let bodyData = req.body;
    if (typeof bodyData === 'string' && bodyData.trim() !== '') {
      try { bodyData = JSON.parse(bodyData); } catch (e) {}
    }

    const fetchOptions = {
      method: req.method,
      headers: headers
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      headers['Prefer'] = 'return=representation';
      if (bodyData) {
        fetchOptions.body = typeof bodyData === 'object' ? JSON.stringify(bodyData) : bodyData;
      }
    } else if (req.method === 'GET') {
      headers['Prefer'] = 'count=exact';
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
  } catch (err) {
    console.error("Excepción en /api/restaurants:", err);
    res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
};
