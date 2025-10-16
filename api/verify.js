// api/verify.js
import crypto from 'node:crypto';
import { kv } from '@vercel/kv';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function nowMs() { return Date.now(); }
function toMs(dateStr) { return new Date(`${dateStr}T23:59:59Z`).getTime(); }

function loadCodes() {
  try {
    if (process.env.ACTIVATION_CODES) return JSON.parse(process.env.ACTIVATION_CODES);
  } catch (_) {}
  // 示例：仅用于本地/测试，上线建议只用环境变量
  return { 'ACT-2025-1234-ABCD': '2025-12-31', 'ACT-2025-5678-EFGH': '2025-12-31' };
}
function signToken(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed' });

  try {
    const { code, host, ua, deviceId } = req.body || {};
    if (!code) return res.status(200).json({ ok: false, message: 'Missing code' });
    if (!deviceId) return res.status(200).json({ ok: false, message: 'Missing deviceId' });

    const codes = loadCodes();
    const expireDate = codes[code];
    if (!expireDate) return res.status(200).json({ ok: false, message: 'Invalid code' });

    const expiresAt = toMs(expireDate);
    if (!Number.isFinite(expiresAt) || expiresAt < nowMs()) {
      return res.status(200).json({ ok: false, message: 'Code expired' });
    }

    // 单设备绑定
    const bindKey = `bind:${code}`;
    const bound = await kv.get(bindKey);
    if (!bound) {
      await kv.set(bindKey, { deviceId, boundAt: Date.now(), expiresAt });
      await kv.expireAt(bindKey, Math.floor(expiresAt / 1000)); // 到期自动解绑
    } else if (bound.deviceId !== deviceId) {
      return res.status(200).json({ ok: false, message: 'Code already bound to another device' });
    }

    const payloadObj = {
      code,
      host: String(host || ''),
      ua: String(ua || ''),
      exp: expiresAt,
      dev: String(deviceId || '')
    };
    const payload = JSON.stringify(payloadObj);
    const secret = process.env.SIGN_SECRET || 'CHANGE_ME_STRONG_SECRET';
    const sig = signToken(payload, secret);
    const token = Buffer.from(payload).toString('base64') + '.' + sig;

    const expiresText = new Date(expiresAt).toLocaleString();
    return res.status(200).json({ ok: true, token, expiresAt, expiresText });
  } catch (e) {
    return res.status(200).json({ ok: false, message: 'Server error' });
  }
}
