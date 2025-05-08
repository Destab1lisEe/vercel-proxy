const fetch = require('node-fetch');

const ALLOWED_ORIGIN = 'https://www.ymarinaboats.com';
const MAX_RETRIES = 10;
const RETRY_DELAY = 500;

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Credentials':'true'
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  };
}

async function fetchWithRetry(url, opts, retries = MAX_RETRIES) {
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    return { status: res.status, text };
  } catch (err) {
    if (retries > 0 && err.message.includes('Premature close')) {
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return fetchWithRetry(url, opts, retries - 1);
    }
    throw err;
  }
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    const pre = buildResponse(200, '');
    res.status(pre.statusCode).set(pre.headers).send(pre.body);
    return;
  }
  if (req.method !== 'POST') {
    const bad = buildResponse(405, { error: 'Method Not Allowed' });
    res.status(bad.statusCode).set(bad.headers).send(bad.body);
    return;
  }
  let payload = req.body;
  try {
    const { status, text } = await fetchWithRetry(
      'https://api.inventoryiq.co/sales-agent/message',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
    const ok = buildResponse(status, text);
    res.status(ok.statusCode).set(ok.headers).send(ok.body);
  } catch (err) {
    const errRes = buildResponse(502, { error: 'Proxy error', detail: err.message });
    res.status(errRes.statusCode).set(errRes.headers).send(errRes.body);
  }
};
