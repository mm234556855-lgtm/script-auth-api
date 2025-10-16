// api/unbind.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed' });

  try {
    const { code, adminSecret } = req.body || {};
    if (!code || !adminSecret) return res.status(200).json({ ok: false, message: 'Missing params' });

    if (adminSecret !== (process.env.UNBIND_ADMIN_SECRET || 'CHANGE_ME_ADMIN_SECRET')) {
      return res.status(200).json({ ok: false, message: 'Forbidden' });
    }

    const bindKey = `bind:${code}`;
    await kv.del(bindKey);
    return res.status(200).json({ ok: true, message: 'Unbound' });
  } catch (e) {
    return res.status(200).json({ ok: false, message: 'Server error' });
  }
}
