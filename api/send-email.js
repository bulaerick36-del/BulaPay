// Vercel Serverless Function (servido en /api/send-email)
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Si req.body viene como string, parsearlo
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
  }

  const { clientData } = body || {};
  if (!clientData || !clientData.email || !clientData.name || !clientData.cedula) {
    res.status(400).json({ error: 'Missing client data (email, name, or cedula)' });
    return;
  }

  const apiKey = process.env.MAILERSEND_API_KEY;
  if (!apiKey) {
    console.error('Missing MAILERSEND_API_KEY env variable');
    res.status(500).json({ error: 'MailerSend API Key is not configured in backend environment' });
    return;
  }

  // Reconstruir la URL de origen de manera dinámica
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['host'] || 'bulapay.co';
  const appUrl = `${protocol}://${host}?view=customer&id=${clientData.cedula}`;

  const emailHtml = "¡Hola, " + clientData.name + "!<br><br>" +
    "Le damos la bienvenida a BulaPay.<br><br>" +
    "Consulte su estado de cartera y realice el seguimiento de sus pagos en su Cartón Digital personalizado haciendo clic en el siguiente enlace:<br><br>" +
    "<a href=\"" + appUrl + "\" style=\"background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;\">Ver mi Cartón Digital</a>";

  console.log('[DEBUG BACKEND] Preparando envío de email a MailerSend.');
  console.log('[DEBUG BACKEND] Configuración:', {
    hasApiKey: !!apiKey,
    toEmail: clientData.email,
    toName: clientData.name,
    appUrl: appUrl
  });

  try {
    console.log('[DEBUG BACKEND] Iniciando fetch a MailerSend API...');
    const response = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: {
          email: "MS_QpWXYt@test-65qngkdzj8jlwr12.mlsender.net",
          name: "BulaPay"
        },
        to: [
          {
            email: clientData.email,
            name: clientData.name
          }
        ],
        subject: "Bienvenido a BulaPay - Tu Cartón Digital",
        html: emailHtml
      })
    });

    console.log('[DEBUG BACKEND] MailerSend status code devuelto:', response.status);

    if (response.ok) {
      console.log('[DEBUG BACKEND] Envío exitoso. Retornando 200.');
      res.status(200).json({ success: true });
    } else {
      const errorText = await response.text();
      console.error('[DEBUG BACKEND ERROR] MailerSend Response Error (Raw):', errorText);
      let errorJson = null;
      try {
        errorJson = JSON.parse(errorText);
        console.error('[DEBUG BACKEND ERROR] MailerSend Response Error (Parsed JSON):', errorJson);
      } catch (e) {}

      res.status(response.status).json({
        error: errorJson || errorText || `MailerSend respondió con código de estado: ${response.status}`,
        mailerSendStatus: response.status,
        rawResponse: errorText
      });
    }
  } catch (err) {
    console.error('[DEBUG BACKEND ERROR] Excepción al enviar por MailerSend:', err);
    res.status(500).json({
      error: `Excepción en backend: ${err.message || err}`,
      stack: err.stack || null,
      details: err.toString()
    });
  }
};
