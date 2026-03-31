// Vercel Serverless Function — Proxy para Waze Feed (evita CORS)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');

  try {
    const response = await fetch(
      'https://www.waze.com/row-partnerhub-api/partners/11839114302/waze-feeds/d812c9fd-ff24-446f-b7c3-5fee8b7df096?format=1'
    );
    if (!response.ok) return res.status(response.status).json({ error: 'Waze Feed unavailable' });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
