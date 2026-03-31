// Vercel Serverless Function — Proxy para Waze Traffic View (evita CORS)
const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');

  const url = 'https://www.waze.com/row-partnerhub-api/feeds-tvt/?id=1761151881648';

  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': 'VIITS-NEXUS/1.0 (MinTransporte Colombia)',
        'Accept': 'application/json',
        'Referer': 'https://www.waze.com/',
      },
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          res.status(200).json(json);
        } catch (e) {
          res.status(500).json({ error: 'Invalid JSON from Waze', raw: data.substring(0, 200) });
        }
        resolve();
      });
    }).on('error', (e) => {
      res.status(500).json({ error: e.message });
      resolve();
    });
  });
};
