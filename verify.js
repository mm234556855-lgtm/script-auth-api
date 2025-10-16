// api/verify.js
const { createHmac } = require('crypto');

function nowMs() { return Date.now(); }
function toMs(dateStr) { return new Date(`${dateStr}T23:59:59Z`).getTime(); }
function loadCodes() {
  try { if (process.env.ACTIVATION_CODES) return JSON.parse(process.env.ACTIVATION_CODES); } catch (_) {}
  return { "ACT-2025-1234-ABCD": "2025-12-31", "ACT-2025-5678-EFGH": "2025-12-31" };
}
function signToken(payload, secret) { return createHmac('sha256', secret).update(payload).digest('hex'); }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed' });
  try {
    const { code, host, ua } = req.body || {};
    if (!code) return res.status(200).json({ ok: false, message: 'Missing code' });
    const codes = loadCodes(); const expireDate = codes[code];
    if (!expireDate) return res.status(200).json({ ok: false, message: 'Invalid code' });
    const expiresAt = toMs(expireDate);
    if (!Number.isFinite(expiresAt) || expiresAt < nowMs()) return res.status(200).json({ ok: false, message: 'Code expired' });
    const payloadObj = { code, host: String(host || ''), ua: String(ua || ''), exp: expiresAt };
    const payload = JSON.stringify(payloadObj);
    const secret = process.env.SIGN_SECRET || 'CHANGE_ME_STRONG_SECRET';
    const sig = signToken(payload, secret);
    const token = Buffer.from(payload).toString('base64') + '.' + sig;
    return res.status(200).json({ ok: true, token, expiresAt });
  } catch (e) { return res.status(200).json({ ok: false, message: 'Server error' }); }
};
