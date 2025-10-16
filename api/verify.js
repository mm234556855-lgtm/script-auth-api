const { createHmac } = require('crypto');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  try {
    const { code, host, ua } = req.body || {};
    if (!code) return res.status(200).json({ ok: false, message: 'Missing code' });

    // 你的激活码逻辑（略）——保持不变
    // ... 生成 token, expiresAt

    return res.status(200).json({ ok: true, token, expiresAt });
  } catch (e) {
    return res.status(200).json({ ok: false, message: 'Server error' });
  }
};
