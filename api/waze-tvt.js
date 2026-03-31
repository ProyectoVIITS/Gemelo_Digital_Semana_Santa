// Vercel Serverless Function — Proxy para Waze Traffic View (evita CORS)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');

  try {
    const response = await fetch(
      'https://www.waze.com/row-partnerhub-api/feeds-tvt/?id=1761151881648'
    );
    if (!response.ok) return res.status(response.status).json({ error: 'Waze TVT unavailable' });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
