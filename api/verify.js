// api/verify.js
import crypto from 'node:crypto';
import { kv } from '@vercel/kv';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function nowMs() { 
  return Date.now(); 
}

function toMs(dateStr) { 
  console.log('[API] 解析过期时间:', dateStr);
  
  // 支持多种格式：
  // 1. "2025-10-18" (只有日期，设置为当天23:59:59本地时间)
  // 2. "2025-10-18 16:00" (日期+时间，本地时间)
  // 3. "2025-10-18 16:00:00" (日期+时间+秒，本地时间)
  
  if (dateStr.includes(' ')) {
    // 包含时间，直接解析为本地时间
    const dateObj = new Date(dateStr);
    const result = dateObj.getTime();
    console.log('[API] 时间解析结果:', dateStr, '->', result, '对应时间:', dateObj.toLocaleString());
    return result;
  } else {
    // 只有日期，设置为当天23:59:59本地时间（不使用UTC）
    const dateObj = new Date(`${dateStr}T23:59:59`);
    const result = dateObj.getTime();
    console.log('[API] 日期解析结果:', dateStr, '->', result, '对应时间:', dateObj.toLocaleString());
    return result;
  }
}

function loadCodes() {
  try {
    if (process.env.ACTIVATION_CODES) return JSON.parse(process.env.ACTIVATION_CODES);
  } catch (_) {}
  // 示例：支持精确到分钟的时间格式
  return { 
    'ACT-2025-1234-ABCD': '2025-12-31 23:59', 
    'ACT-2025-5678-EFGH': '2025-12-31 16:00',
    'ACT-2025-5214-HADI': '2025-10-18 16:02' // 添加您的激活码
  };
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
    console.log('[API] 收到请求:', { code, host, ua, deviceId });
    
    if (!code) return res.status(200).json({ ok: false, message: 'Missing code' });
    if (!deviceId) return res.status(200).json({ ok: false, message: 'Missing deviceId' });

    const codes = loadCodes();
    const expireDate = codes[code];
    console.log('[API] 查找激活码:', code, '找到过期日期:', expireDate);
    
    if (!expireDate) return res.status(200).json({ ok: false, message: 'Invalid code' });

    const expiresAt = toMs(expireDate);
    const now = nowMs();
    console.log('[API] 时间比较:', { expiresAt, now, isExpired: expiresAt < now });
    
    if (!Number.isFinite(expiresAt) || expiresAt < now) {
      return res.status(200).json({ ok: false, message: 'Code expired' });
    }

    // 单设备绑定
    const bindKey = `bind:${code}`;
    const bound = await kv.get(bindKey);
    if (!bound) {
      await kv.set(bindKey, { deviceId, boundAt: Date.now(), expiresAt });
      await kv.expireAt(bindKey, Math.floor(expiresAt / 1000)); // 到期自动解绑
      console.log('[API] 设备绑定成功:', deviceId);
    } else if (bound.deviceId !== deviceId) {
      console.log('[API] 设备绑定冲突:', bound.deviceId, 'vs', deviceId);
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
    console.log('[API] 返回成功响应:', { expiresAt, expiresText });
    
    return res.status(200).json({ 
      ok: true, 
      token, 
      expiresAt, 
      expiresText 
    });
  } catch (e) {
    console.error('[API] 服务器错误:', e);
    return res.status(200).json({ ok: false, message: 'Server error' });
  }
}
