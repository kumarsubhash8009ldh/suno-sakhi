const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

function generateSessionToken() {
  return crypto.randomBytes(24).toString('hex') + '-' + Date.now();
}

function parseIdentifier(input) {
  if (!input) return { type: null, value: '' };
  const str = String(input).trim();
  if (str.includes('@') && str.includes('.')) {
    return { type: 'email', value: str.toLowerCase() };
  }
  const digits = str.replace(/\D/g, '');
  const cleanPhone = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (cleanPhone.length === 10) {
    return { type: 'phone', value: cleanPhone };
  }
  return { type: null, value: '' };
}

// Auto-load environment variables from .env if present
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }
} catch (e) {}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5173;
const DIST_DIR = path.join(__dirname, 'dist');

// In-Memory Real-Time State (Shared across ALL devices)
const db = {
  otpStore: {}, // phone -> { code, expiresAt, createdAt }
  hosts: {}, // hostId -> hostData
  callSessions: {}, // callId -> callData
  callCandidates: {}, // callId -> { caller: [], callee: [] }
  chatMessages: {}, // threadId -> [ messages ]
  users: {}, // phone -> userData
  payouts: [], // [ payoutRecords ]
  rechargeRequests: {}, // reqId -> rechargeRequest
  smsApiKey: process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY || ''
};

const DB_FILE = path.join(__dirname, 'database.json');

const DUMMY_PHONES = new Set([
  '3333365655', '9887858502', '8503664664', '7009447378', '7009600157',
  '7478535684', '7009600158', '8596856526', '8596357266', '9632156845',
  '6565558885', '9232178588', '9887353538', '9878584566', '9887875656',
  '9887785656', '7307473545', '9887885656', '9887755454'
]);

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const saved = JSON.parse(content);
      if (saved && typeof saved === 'object') {
        if (saved.hosts && typeof saved.hosts === 'object') db.hosts = saved.hosts;
        if (saved.users && typeof saved.users === 'object') db.users = saved.users;
        if (Array.isArray(saved.payouts)) db.payouts = saved.payouts;
        if (saved.rechargeRequests && typeof saved.rechargeRequests === 'object') db.rechargeRequests = saved.rechargeRequests;
        if (saved.chatMessages && typeof saved.chatMessages === 'object') db.chatMessages = saved.chatMessages;
        // Preserve host verification status and ensure earnings fields are initialized
        Object.values(db.hosts).forEach((h) => {
          if (h && typeof h === 'object') {
            if (h.isVerified === undefined) h.isVerified = false;
            if (!h.verification) {
              h.verification = { status: h.isVerified ? 'verified' : 'unverified' };
            }
            if (!h.status) h.status = h.isVerified ? 'online' : 'offline';
            if (h.netIncome === undefined) h.netIncome = 0;
            if (h.pendingPayout === undefined) h.pendingPayout = 0;
            if (h.grossRevenue === undefined) h.grossRevenue = 0;
            if (h.totalCalls === undefined) h.totalCalls = 0;
            if (h.totalVoiceMinutes === undefined) h.totalVoiceMinutes = 0;
            if (h.totalVideoMinutes === undefined) h.totalVideoMinutes = 0;
            if (h.totalMessagesReceived === undefined) h.totalMessagesReceived = 0;
            if (h.totalGiftsReceived === undefined) h.totalGiftsReceived = 0;
            if (!Array.isArray(h.incomeHistory)) h.incomeHistory = [];
          }
        });

        // Clean up any dummy/mock callers or callers that belong to hosts
        for (const [phone, u] of Object.entries(db.users)) {
          const isHost = Object.values(db.hosts).some(
            (h) => h && h.phone && String(h.phone).replace(/\D/g, '') === phone
          );
          if (isHost || DUMMY_PHONES.has(phone) || !u || !u.phone) {
            delete db.users[phone];
            console.log(`🧹 [CLEANUP] Removed dummy caller/host ${phone} from db.users`);
          }
        }
        saveDatabase();
        console.log(`📦 Loaded persistent database: ${Object.keys(db.hosts).length} hosts (Direct Active), ${Object.keys(db.users).length} users, ${Object.keys(db.chatMessages).length} chat threads.`);
      }
    }
  } catch (err) {
    console.warn('Could not load database.json:', err);
  }
}

function saveDatabase() {
  try {
    const toSave = {
      hosts: db.hosts,
      users: db.users,
      payouts: db.payouts,
      rechargeRequests: db.rechargeRequests,
      chatMessages: db.chatMessages
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(toSave, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not save database.json:', err);
  }
}

loadDatabase();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.apk': 'application/vnd.android.package-archive',
  '.zip': 'application/zip',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// Helper: send JSON response
function sendJson(res, statusCode, data) {
  const jsonStr = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(jsonStr);
}

// Helper: parse POST body
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
  });
}

// Helper: trigger Real SMS via Fast2SMS if API key is provided
async function sendSmsViaFast2Sms(phone, otpCode) {
  if (!db.smsApiKey) {
    console.log(`[SMS-GATEWAY-NOTICE] No FAST2SMS_API_KEY provided. Logged OTP for +91 ${phone}: ${otpCode}`);
    return { sent: false, reason: 'no-api-key' };
  }

  const https = require('https');

  const postToFast2Sms = (payload) => {
    return new Promise((resolve) => {
      const postData = JSON.stringify(payload);
      const options = {
        hostname: 'www.fast2sms.com',
        path: '/dev/bulkV2',
        method: 'POST',
        headers: {
          authorization: db.smsApiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let respData = '';
        res.on('data', (chunk) => {
          respData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(respData);
            if (parsed && parsed.return === true) {
              resolve({ sent: true, response: parsed });
            } else {
              resolve({ sent: false, response: parsed, message: parsed?.message });
            }
          } catch (e) {
            resolve({ sent: false, error: 'invalid-json', raw: respData });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ sent: false, error: e.message });
      });

      req.write(postData);
      req.end();
    });
  };

  try {
    // 1. Try OTP route
    const otpRes = await postToFast2Sms({
      variables_values: otpCode,
      route: 'otp',
      numbers: phone
    });

    if (otpRes.sent) {
      console.log(`✅ [FAST2SMS SUCCESS] SMS OTP dispatched to +91 ${phone}`);
      return otpRes;
    }

    // 2. Fallback to Quick SMS route
    const quickRes = await postToFast2Sms({
      route: 'q',
      message: `Your SunoSakhi verification code is ${otpCode}`,
      language: 'english',
      flash: 0,
      numbers: phone
    });

    if (quickRes.sent) {
      console.log(`✅ [FAST2SMS QUICK SUCCESS] SMS dispatched to +91 ${phone}`);
      return quickRes;
    }

    console.warn(`⚠️ [FAST2SMS NOTICE] Fast2SMS dispatch notice for +91 ${phone}:`, quickRes.message || otpRes.message);
    return { sent: false, reason: quickRes.message || otpRes.message };
  } catch (err) {
    console.warn('SMS dispatch exception:', err);
    return { sent: false, error: err.message };
  }
}

const server = http.createServer(async (req, res) => {
  // Enable CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`🌐 [HTTP ${req.method}] ${pathname}`);

  // -------------------------------------------------------------
  // API ROUTING
  // -------------------------------------------------------------

  // 1. Send OTP
  if (pathname === '/api/otp/send' && req.method === 'POST') {
    const body = await parseBody(req);
    const rawPhone = (body.phone || '').replace(/\D/g, '');
    const phone = rawPhone.length === 12 && rawPhone.startsWith('91') ? rawPhone.slice(2) : rawPhone;

    if (phone.length !== 10) {
      return sendJson(res, 400, { success: false, message: '10-digit mobile number darj karein.' });
    }

    // Generate random 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    db.otpStore[phone] = {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      createdAt: Date.now()
    };

    console.log(`=========================================`);
    console.log(`📱 [SUNOSAKHI REAL OTP] +91 ${phone} ➔ CODE: ${code}`);
    console.log(`=========================================`);

    // Dispatch SMS via gateway if key is available
    let isSmsSent = false;
    try {
      const smsRes = await sendSmsViaFast2Sms(phone, code);
      isSmsSent = Boolean(smsRes && smsRes.sent);
    } catch (err) {
      console.warn('SMS dispatch failed:', err);
    }

    return sendJson(res, 200, {
      success: true,
      message: isSmsSent
        ? `6-digit OTP aapke number +91 ${phone} par bhej diya gaya hai. SMS check karein.`
        : `OTP generate ho gaya hai. On-screen code darj karein.`,
      phone,
      otp: code,
      isRealSms: isSmsSent,
      hasSmsGateway: Boolean(db.smsApiKey)
    });
  }

  // 2. Verify OTP
  if (pathname === '/api/otp/verify' && req.method === 'POST') {
    const body = await parseBody(req);
    const rawPhone = (body.phone || '').replace(/\D/g, '');
    const phone = rawPhone.length === 12 && rawPhone.startsWith('91') ? rawPhone.slice(2) : rawPhone;
    const enteredCode = (body.code || body.otp || '').toString().trim();

    if (!enteredCode) {
      return sendJson(res, 400, { success: false, message: 'Kripya OTP darj karein.' });
    }

    const stored = db.otpStore[phone];
    // Master emergency bypass codes for admin testing
    const isMasterBypass = enteredCode === '123456' || enteredCode === '999999' || enteredCode === '000000';

    if (isMasterBypass || (stored && stored.code === enteredCode && stored.expiresAt > Date.now())) {
      // Clear used OTP
      delete db.otpStore[phone];
      return sendJson(res, 200, { success: true, message: 'OTP successfully verified!' });
    }

    return sendJson(res, 400, { success: false, message: 'Galat OTP darj kiya gaya hai. Kripya dobara check karein.' });
  }

  // Root APK direct download endpoint with full HTTP Range request & resume support
  if (pathname === '/suno-sakhi.apk' || pathname === '/Suno-Sakhi.apk') {
    let apkPath = path.join(__dirname, 'Suno-Sakhi.apk');
    if (!fs.existsSync(apkPath)) {
      apkPath = path.join(__dirname, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    }
    if (fs.existsSync(apkPath)) {
      const stat = fs.statSync(apkPath);
      const totalSize = stat.size;
      const range = req.headers.range;

      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', 'attachment; filename="suno-sakhi.apk"');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(apkPath, { start, end });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Content-Length': chunksize,
        });
        return fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': totalSize,
        });
        return fs.createReadStream(apkPath).pipe(res);
      }
    }
  }

  // 2. Dedicated APK Download & Sharing Landing Page
  if (pathname === '/download' || pathname === '/apk' || pathname === '/share' || pathname === '/download-apk' || pathname === '/get-app') {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'localhost:5173';
    const fullUrl = `${proto}://${host}`;
    const parsedUrl = url.parse(req.url, true);
    const refCode = (parsedUrl.query && parsedUrl.query.ref) ? String(parsedUrl.query.ref).trim().toUpperCase() : '';
    const refQuery = refCode ? `?ref=${encodeURIComponent(refCode)}` : '';
    const apkUrl = `${fullUrl}/suno-sakhi.apk`;
    const shareUrl = `${fullUrl}/download${refQuery}`;
    const webAppUrl = `${fullUrl}/${refQuery}`;
    const shareText = encodeURIComponent(`🌸 Suno Sakhi (सुनो सखी) Official Android App!\n\n🎁 Link se judne par paayein Rs: 50 Free Coins!\n📞 Live 1-on-1 Voice & Video Call\n💬 Direct Chat with verified Sakhis\n🔒 100% Private, Safe & Anonymous\n\n📲 Direct Download Link:\n${apkUrl}\n\n🌐 Web Page Link:\n${shareUrl}`);

    const html = `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Download Suno Sakhi App - Official Android APK (28.8 MB)</title>
  <meta name="description" content="Download official Suno Sakhi Android APK (सुनो सखी). Live 1-on-1 private audio/video calls and chat with verified companions. 100% Safe, Secure & Confidential.">
  <meta property="og:title" content="Download Suno Sakhi Android App 🌸">
  <meta property="og:description" content="Dil Se Baat Sirf SunoSakhi Ke Saath. Live 1-on-1 Voice & Video Call. 100% Safe & Private.">
  <meta property="og:image" content="${fullUrl}/suno-sakhi-logo-square.png">
  <meta property="og:url" content="${shareUrl}">
  <meta name="theme-color" content="#120624">
  <link rel="icon" type="image/png" href="/suno-sakhi-logo-square.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      background: radial-gradient(circle at top center, #270e3d 0%, #120624 50%, #080312 100%);
      color: #fff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 16px 40px;
    }
    .container {
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 999px;
      background: rgba(236, 72, 153, 0.15);
      border: 1px solid rgba(244, 114, 182, 0.4);
      color: #f472b6;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    .app-icon {
      width: 96px;
      height: 96px;
      border-radius: 26px;
      background: linear-gradient(135deg, #ec4899, #8b5cf6);
      padding: 3px;
      box-shadow: 0 16px 40px rgba(236, 72, 153, 0.45);
      margin-bottom: 16px;
      animation: float 3s ease-in-out infinite;
    }
    .app-icon img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 23px;
      display: block;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-6px); }
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 28px;
      font-weight: 800;
      line-height: 1.2;
      background: linear-gradient(135deg, #fff 30%, #fbcfe8 70%, #d8b4fe 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 6px;
    }
    .tagline {
      font-size: 13px;
      color: #f472b6;
      font-weight: 600;
      margin-bottom: 18px;
    }
    .meta-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-bottom: 24px;
    }
    .meta-pill {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 11px;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .btn-download {
      width: 100%;
      padding: 16px 20px;
      border-radius: 20px;
      background: linear-gradient(135deg, #db2777 0%, #ec4899 50%, #9333ea 100%);
      color: #fff;
      font-family: 'Outfit', sans-serif;
      font-size: 17px;
      font-weight: 800;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 12px 30px rgba(219, 39, 119, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.3);
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn-download:hover {
      transform: translateY(-2px);
      box-shadow: 0 16px 36px rgba(219, 39, 119, 0.65);
    }
    .btn-download:active {
      transform: scale(0.98);
    }
    .share-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      width: 100%;
      margin-top: 14px;
    }
    .btn-share {
      padding: 12px 14px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
      border: none;
    }
    .btn-whatsapp {
      background: #25D366;
      color: #0b3819;
    }
    .btn-copy {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .card {
      width: 100%;
      background: rgba(24, 11, 44, 0.75);
      border: 1px solid rgba(244, 114, 182, 0.25);
      border-radius: 24px;
      padding: 20px;
      margin-top: 24px;
      text-align: left;
      backdrop-filter: blur(12px);
    }
    .card-title {
      font-family: 'Outfit', sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: #fbcfe8;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .steps {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .step {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      font-size: 12px;
      color: #cbd5e1;
      line-height: 1.4;
    }
    .step-num {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(236, 72, 153, 0.2);
      border: 1px solid rgba(236, 72, 153, 0.4);
      color: #f472b6;
      font-weight: 800;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .qr-box {
      margin-top: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .qr-img {
      width: 120px;
      height: 120px;
      background: #fff;
      border-radius: 14px;
      padding: 6px;
    }
    .qr-text {
      font-size: 11px;
      color: #94a3b8;
    }
    .btn-web {
      margin-top: 20px;
      color: #cbd5e1;
      text-decoration: none;
      font-size: 12px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .toast {
      position: fixed;
      bottom: 24px;
      background: #10b981;
      color: #fff;
      font-weight: 700;
      font-size: 13px;
      padding: 10px 20px;
      border-radius: 999px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s ease;
      pointer-events: none;
      z-index: 1000;
    }
    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">🌸 Official Android Release</div>
    
    <div class="app-icon">
      <img src="/suno-sakhi-logo-square.png" alt="Suno Sakhi Logo" onerror="this.src='/suno-sakhi-logo-icon.png'">
    </div>

    <h1>Suno Sakhi</h1>
    <div class="tagline">दिल से बात सिर्फ सुनो सखी के साथ ❤️</div>

    <div class="meta-pills">
      <div class="meta-pill">📱 v1.0.0 (Latest)</div>
      <div class="meta-pill">🎁 Rs: 50 Free Coins</div>
      <div class="meta-pill">⚡ Size: 28.8 MB</div>
      <div class="meta-pill">🛡️ 100% Safe & Verified</div>
      <div class="meta-pill">🔒 End-to-End Private</div>
    </div>

    ${refCode ? `<div style="margin: 0 0 18px; padding: 10px 16px; background: rgba(234, 179, 8, 0.15); border: 1px solid rgba(234, 179, 8, 0.45); border-radius: 16px; font-size: 13px; color: #fef08a; font-weight: 700; width: 100%;">🎁 Referral <strong>${refCode}</strong> Applied! Download & Register par Rs: 50 Bonus Coins!</div>` : ''}

    <!-- Direct Download Button -->
    <a href="${apkUrl}" download="Suno-Sakhi.apk" class="btn-download" id="downloadBtn">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>
      <span>Download Suno-Sakhi.apk</span>
    </a>

    <!-- Share Buttons -->
    <div class="share-grid">
      <a href="https://api.whatsapp.com/send?text=${shareText}" target="_blank" class="btn-share btn-whatsapp">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.861.174.086.275.072.376-.043.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824z"/></svg>
        <span>WhatsApp Share</span>
      </a>
      <button type="button" class="btn-share btn-copy" onclick="copyShareLink()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
        <span id="copyBtnText">Copy Link</span>
      </button>
    </div>

    <!-- Installation Steps Card -->
    <div class="card">
      <div class="card-title">
        <span>📲 How to Install (आसान 3 स्टेप्स):</span>
      </div>
      <div class="steps">
        <div class="step">
          <div class="step-num">1</div>
          <div><strong>Download APK:</strong> Upar diye gaye <em>Download Suno-Sakhi.apk</em> button par click karein.</div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div><strong>Open Notification:</strong> Download complete hone par "Open" / "खोले" par tap karein.</div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div><strong>Allow & Install:</strong> Agar security prompt aaye toh <em>Settings -> Allow Unknown Sources</em> ko ON karke Install dabayein.</div>
        </div>
      </div>

      <div class="qr-box">
        <img class="qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(apkUrl)}" alt="Scan QR to Download">
        <div class="qr-text">Dusre mobile se QR Code scan karke bhi download karein</div>
      </div>
    </div>

    <a href="${webAppUrl}" class="btn-web">
      <span>🌐 Browser me Web version chalayein</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </a>
  </div>

  <div id="toast" class="toast">✅ Link Copied to Clipboard!</div>

  <script>
    function copyShareLink() {
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
        const toast = document.getElementById('toast');
        toast.classList.add('show');
        const copyText = document.getElementById('copyBtnText');
        copyText.textContent = 'Copied! ✅';
        setTimeout(() => {
          toast.classList.remove('show');
          copyText.textContent = 'Copy Link';
        }, 2500);
      }).catch(() => {
        alert('Download link: ' + url);
      });
    }

    // Auto-trigger download if url has ?auto=1 or #download
    if (window.location.search.includes('auto=1') || window.location.hash === '#download') {
      const dlBtn = document.getElementById('downloadBtn');
      if (dlBtn) dlBtn.click();
    }
  </script>
</body>
</html>`;

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    return res.end(html);
  }

  // 3. Get Real Hosts List (Strictly deduplicated, zero dummy accounts)
  if (pathname === '/api/hosts' && req.method === 'GET') {
    const list = Object.values(db.hosts).filter((h) => {
      if (!h) return false;
      const cleanPhone = h.phone ? String(h.phone).replace(/\D/g, '') : '';
      const cleanEmail = h.email ? String(h.email).trim().toLowerCase() : '';
      if (cleanPhone.length < 10 && !cleanEmail) return false;
      if (!h.name || h.name.trim() === '' || h.name === 'Sakhi Host') return false;
      // Do NOT include callers
      if (h.name.toLowerCase().startsWith('caller') || h.role === 'caller') return false;
      // MUST BE FEMALE
      if (h.gender && h.gender !== 'female') return false;
      // MUST BE VERIFIED & APPROVED BY ADMIN
      if (!h.isVerified || h.verification?.status !== 'verified') return false;
      if (
        h.id.startsWith('host_priya') ||
        h.id.startsWith('host_ananya') ||
        h.id.startsWith('real_sakhi_') ||
        h.id === 'aarohi-1' ||
        h.name === 'Priya Sharma' ||
        h.name === 'Ananya Verma'
      ) {
        return false;
      }
      return true;
    });

    // DEDUPLICATION: Ensure exactly ONE host per phone / email / id
    const uniqueMap = new Map();
    for (const h of list) {
      const p = h.phone ? String(h.phone).replace(/\D/g, '') : '';
      const em = h.email ? String(h.email).trim().toLowerCase() : '';
      const key = p ? `p_${p}` : em ? `e_${em}` : `id_${h.id}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, h);
      }
    }
    const deduplicated = Array.from(uniqueMap.values());
    return sendJson(res, 200, { success: true, hosts: deduplicated });
  }

  // 3b. Profile Name Uniqueness Check Endpoint
  if (pathname === '/api/profile/check-name' && (req.method === 'GET' || req.method === 'POST')) {
    let name = '';
    let excludeId = '';
    let excludePhone = '';
    if (req.method === 'POST') {
      const body = await parseBody(req);
      name = String(body.name || '').trim();
      excludeId = String(body.excludeId || '').trim();
      excludePhone = String(body.excludePhone || '').replace(/\D/g, '');
    } else {
      name = String(parsedUrl.query.name || '').trim();
      excludeId = String(parsedUrl.query.excludeId || '').trim();
      excludePhone = String(parsedUrl.query.excludePhone || '').replace(/\D/g, '');
    }

    if (!name) {
      return sendJson(res, 200, { success: true, isUnique: true });
    }

    const nameLower = name.toLowerCase();
    const isCallerNameTaken = Object.values(db.users).some(
      (u) => u && u.name && u.name.trim().toLowerCase() === nameLower &&
             (!excludeId || u.id !== excludeId) &&
             (!excludePhone || u.phone !== excludePhone)
    );
    const isHostNameTaken = Object.values(db.hosts).some(
      (h) => h && h.name && h.name.trim().toLowerCase() === nameLower &&
             (!excludeId || h.id !== excludeId) &&
             (!excludePhone || h.phone !== excludePhone)
    );

    if (isCallerNameTaken || isHostNameTaken) {
      return sendJson(res, 200, {
        success: true,
        isUnique: false,
        message: '⚠️ Yeh Profile Name pehle se kisi aur ka hai! Kripya doosra unique naam chunein.'
      });
    }

    return sendJson(res, 200, { success: true, isUnique: true });
  }

  // 4. Register or Update Host (Supports Phone or Email)
  if (pathname === '/api/hosts/register' && req.method === 'POST') {
    const body = await parseBody(req);
    const parsedId = parseIdentifier(body.phone || body.email || body.identifier);
    const cleanPhone = parsedId.type === 'phone' ? parsedId.value : (body.phone ? String(body.phone).replace(/\D/g, '') : '');
    const cleanEmail = parsedId.type === 'email' ? parsedId.value : (body.email ? String(body.email).trim().toLowerCase() : '');
    const cleanName = String(body.name || '').trim();

    if ((cleanPhone.length < 10 && !cleanEmail) || !cleanName || cleanName === 'Sakhi Host') {
      return sendJson(res, 400, {
        success: false,
        message: 'Valid 10-digit mobile number or Email ID and verified name required to register as host.'
      });
    }

    // Reject caller accounts from host registration
    if (cleanName.toLowerCase().startsWith('caller') || body.role === 'caller') {
      return sendJson(res, 400, {
        success: false,
        message: '⚠️ Callers cannot be registered as Hosts.'
      });
    }

    // Female Only Host Policy
    if (body.gender && body.gender !== 'female') {
      return sendJson(res, 400, {
        success: false,
        message: '🌸 Female Only Policy: SunoSakhi par sirf Mahila (Female) host hi register ho sakti hain.'
      });
    }

    const hostId = cleanPhone ? `host_${cleanPhone}` : `host_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;

    // Enforce unique profile name across all hosts and callers
    const nameLower = cleanName.toLowerCase();
    const isHostNameTaken = Object.values(db.hosts).some(
      (h) => h && h.name && h.name.trim().toLowerCase() === nameLower && h.id !== hostId && (cleanPhone ? h.phone !== cleanPhone : true)
    );
    const isCallerNameTaken = Object.values(db.users).some(
      (u) => u && u.name && u.name.trim().toLowerCase() === nameLower && (cleanPhone ? u.phone !== cleanPhone : true)
    );
    if (isHostNameTaken || isCallerNameTaken) {
      return sendJson(res, 400, {
        success: false,
        message: '⚠️ Yeh Profile Name pehle se kisi aur ka hai! Kripya doosra unique naam chunein.'
      });
    }

    // Purge any existing duplicates with same phone or email to enforce 1 single record
    for (const [k, existing] of Object.entries(db.hosts)) {
      if (!existing) continue;
      const exPhone = existing.phone ? String(existing.phone).replace(/\D/g, '') : '';
      const exEmail = existing.email ? String(existing.email).trim().toLowerCase() : '';
      if ((cleanPhone && exPhone === cleanPhone) || (cleanEmail && exEmail === cleanEmail) || existing.id === body.id) {
        delete db.hosts[k];
      }
    }

    const panNum = String(body.panNumber || body.verification?.panNumber || '').toUpperCase().trim();
    const panDoc = body.panDocUrl || body.verification?.panDocUrl || '';
    const secondaryType = body.secondaryIdType || body.verification?.secondaryIdType || body.residentIdType || 'aadhaar';
    const secondaryNum = String(body.secondaryIdNumber || body.verification?.secondaryIdNumber || body.residentIdNumber || '').trim();
    const secondaryDoc = body.secondaryDocUrl || body.verification?.secondaryDocUrl || '';
    const selfiePhoto = body.selfieUrl || body.verification?.selfieUrl || body.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80';
    const sessionToken = generateSessionToken();

    const hasKycSubmitted = Boolean(panNum && secondaryNum);
    const initialStatus = hasKycSubmitted ? 'pending' : (body.verification?.status || 'unverified');

    const newHost = {
      id: hostId,
      name: cleanName,
      gender: 'female',
      age: Number(body.age) || 22,
      city: body.city || 'India',
      avatar: selfiePhoto,
      videoPoster: body.videoPoster || selfiePhoto,
      status: 'offline', // Requires Admin approval
      rating: Number(body.rating) || 5.0,
      totalCalls: Number(body.totalCalls) || 0,
      languages: Array.isArray(body.languages) && body.languages.length > 0 ? body.languages : ['Hindi'],
      bio: body.bio || 'Namaste! SunoSakhi par dil se baat karein!',
      interests: Array.isArray(body.interests) && body.interests.length > 0 ? body.interests : ['Friendly Chat'],
      voiceRatePerMin: 5,
      videoRatePerMin: 10,
      tagline: '🌸 Female Companion',
      phone: cleanPhone || '',
      email: cleanEmail || '',
      password: String(body.password || 'sakhi123'),
      isVerified: false, // Requires Admin approval
      activeSessionToken: sessionToken,
      lastLoginAt: Date.now(),
      verification: {
        panNumber: panNum,
        panDocUrl: panDoc,
        secondaryIdType: secondaryType,
        secondaryIdNumber: secondaryNum,
        secondaryDocUrl: secondaryDoc,
        selfieUrl: selfiePhoto,
        gender: 'female',
        status: initialStatus,
        submittedAt: hasKycSubmitted ? Date.now() : undefined,
        residentIdType: secondaryType,
        residentIdNumber: secondaryNum,
        residentDocUrl: secondaryDoc,
        idType: secondaryType,
        idNumber: secondaryNum
      },
      netIncome: Number(body.netIncome) || 0,
      pendingPayout: Number(body.pendingPayout) || 0,
      grossRevenue: Number(body.grossRevenue) || 0,
      totalVoiceMinutes: Number(body.totalVoiceMinutes) || 0,
      totalVideoMinutes: Number(body.totalVideoMinutes) || 0,
      totalMessagesReceived: Number(body.totalMessagesReceived) || 0,
      totalGiftsReceived: Number(body.totalGiftsReceived) || 0,
      incomeHistory: Array.isArray(body.incomeHistory) ? body.incomeHistory : []
    };

    db.hosts[hostId] = newHost;
    saveDatabase();
    console.log(`🌸 [HOST REGISTERED - PENDING ADMIN APPROVAL] ${newHost.name} (${newHost.phone || newHost.email}) ID: ${hostId}`);
    return sendJson(res, 200, { success: true, host: newHost, sessionToken });
  }

  // 4a. Host KYC Verification Submission Endpoint
  if (pathname === '/api/hosts/verification' && req.method === 'POST') {
    const body = await parseBody(req);
    const hostId = body.hostId || body.id;
    const cleanPhone = String(body.phone || hostId || '').replace(/\D/g, '');

    const foundId = Object.keys(db.hosts).find(
      (k) => k === hostId || (cleanPhone && cleanPhone.length >= 10 && (k.includes(cleanPhone) || db.hosts[k].phone === cleanPhone))
    );

    if (!foundId || !db.hosts[foundId]) {
      return sendJson(res, 404, { success: false, message: 'Host profile nahi mili.' });
    }

    const host = db.hosts[foundId];
    const panNum = String(body.panNumber || '').toUpperCase().trim();
    const panDocUrl = body.panDocUrl || '';
    const secondaryType = body.secondaryIdType || 'aadhaar';
    const secondaryNum = String(body.secondaryIdNumber || '').trim();
    const secondaryDocUrl = body.secondaryDocUrl || '';
    const selfieUrl = body.selfieUrl || host.avatar || '';

    if (!panNum || !secondaryNum || !selfieUrl) {
      return sendJson(res, 400, {
        success: false,
        message: 'Kripya PAN card, Secondary ID (Aadhaar/Voter/Licence) aur Live Photo teeno provide karein.'
      });
    }

    host.isVerified = false;
    host.status = 'offline';
    host.verification = {
      panNumber: panNum,
      panDocUrl,
      secondaryIdType: secondaryType,
      secondaryIdNumber: secondaryNum,
      secondaryDocUrl,
      selfieUrl,
      gender: 'female',
      status: 'pending',
      submittedAt: Date.now(),
      residentIdType: secondaryType,
      residentIdNumber: secondaryNum,
      residentDocUrl,
      idType: secondaryType,
      idNumber: secondaryNum
    };

    saveDatabase();
    console.log(`📋 [HOST KYC SUBMITTED FOR ADMIN APPROVAL] ${host.name} (${foundId})`);
    return sendJson(res, 200, {
      success: true,
      message: '✅ Aapke KYC documents jama ho gaye hain! Super Admin ise review karke approve karega.',
      host
    });
  }

  // 4b. Host Login (Phone/Email + Password OR OTP)
  if (pathname === '/api/hosts/login' && req.method === 'POST') {
    const body = await parseBody(req);
    const parsedId = parseIdentifier(body.phone || body.email || body.identifier);
    const cleanPhone = parsedId.type === 'phone' ? parsedId.value : (body.phone ? String(body.phone).replace(/\D/g, '') : '');
    const cleanEmail = parsedId.type === 'email' ? parsedId.value : (body.email ? String(body.email).trim().toLowerCase() : '');

    if (cleanPhone.length < 10 && !cleanEmail) {
      return sendJson(res, 400, { success: false, message: 'Valid 10-digit mobile number or Email required.' });
    }

    const host = Object.values(db.hosts).find((h) => {
      if (!h) return false;
      if (cleanPhone && h.phone && String(h.phone).replace(/\D/g, '') === cleanPhone) return true;
      if (cleanEmail && h.email && h.email.toLowerCase() === cleanEmail) return true;
      return false;
    });

    if (!host) {
      return sendJson(res, 404, {
        success: false,
        message: `⚠️ Account (${cleanPhone || cleanEmail}) Host ke roop me registered nahi hai! Kripya 'Host Bano' par jakar register karein.`
      });
    }

    // If password login
    if (body.password) {
      if (host.password && host.password !== body.password) {
        return sendJson(res, 401, {
          success: false,
          message: 'Galat password! Kripya sahi password dalein ya Forgot Password karein.'
        });
      }
      if (!host.password) {
        host.password = body.password;
      }
    }

    // Generate fresh session token (enforces single device login)
    const sessionToken = generateSessionToken();
    host.activeSessionToken = sessionToken;
    host.lastLoginAt = Date.now();
    host.status = 'online';
    saveDatabase();
    console.log(`🌸 [HOST LOGGED IN] ${host.name} (${host.phone || host.email}) token=${sessionToken.slice(0, 10)}...`);
    return sendJson(res, 200, { success: true, host, sessionToken });
  }

  // 4c. Host Recover Password
  if (pathname === '/api/hosts/recover' && req.method === 'POST') {
    const body = await parseBody(req);
    const cleanPhone = String(body.phone || '').replace(/\D/g, '');
    const host = Object.values(db.hosts).find(
      (h) => h && h.phone && String(h.phone).replace(/\D/g, '') === cleanPhone
    );
    if (!host) {
      return sendJson(res, 404, { success: false, message: 'Yeh mobile number registered nahi hai.' });
    }
    if (body.newPassword) {
      host.password = String(body.newPassword);
      saveDatabase();
      console.log(`🔑 [HOST PASSWORD RESET] ${host.name} (+91 ${cleanPhone})`);
      return sendJson(res, 200, { success: true, message: 'Password update ho gaya hai!' });
    }
    return sendJson(res, 200, { success: true, password: host.password || 'sakhi123' });
  }

  // 5. Update Host Status (online/busy/offline)
  if (pathname === '/api/hosts/status' && req.method === 'POST') {
    const body = await parseBody(req);
    const { hostId, status } = body;
    let host = db.hosts[hostId];
    if (!host && hostId) {
      const cleanDigits = String(hostId).replace(/\D/g, '');
      if (cleanDigits.length >= 10) {
        host = Object.values(db.hosts).find(
          (h) => h && h.phone && String(h.phone).replace(/\D/g, '') === cleanDigits.slice(-10)
        );
      }
    }
    if (host) {
      host.status = status;
      saveDatabase();
      console.log(`🟢 [HOST STATUS CHANGED] ${host.name} (+91 ${host.phone}) status=${status}`);
      return sendJson(res, 200, { success: true, host });
    }
    return sendJson(res, 404, { success: false, message: 'Host not found' });
  }

  // 5a. Record Host Commission & Real-time Earnings (Voice Call, Video Call, Chat, Gifts)
  if (pathname === '/api/hosts/income' && req.method === 'POST') {
    const body = await parseBody(req);
    const hostId = (body.hostId || '').trim();
    const hostPhone = String(body.hostPhone || '').replace(/\D/g, '');
    const inc = body.incomeRecord || {};
    const gross = Number(inc.grossAmount || body.grossAmount) || 0;
    const earned = Number(inc.hostEarned || body.hostEarned) || parseFloat(((gross * 0.6).toFixed(2)));

    let host = db.hosts[hostId];
    if (!host && hostPhone) {
      host = Object.values(db.hosts).find(
        (h) => h && h.phone && String(h.phone).replace(/\D/g, '') === hostPhone
      );
    }
    if (!host && hostId) {
      const cleanDigits = hostId.replace(/\D/g, '');
      if (cleanDigits.length >= 10) {
        host = Object.values(db.hosts).find(
          (h) => h && h.phone && String(h.phone).replace(/\D/g, '') === cleanDigits.slice(-10)
        );
      }
    }

    if (!host) {
      return sendJson(res, 404, { success: false, message: 'Host not found' });
    }

    // Live update earnings
    host.grossRevenue = parseFloat(((host.grossRevenue || 0) + gross).toFixed(2));
    host.netIncome = parseFloat(((host.netIncome || 0) + earned).toFixed(2));
    host.pendingPayout = parseFloat(((host.pendingPayout || 0) + earned).toFixed(2));

    const callType = body.callType || inc.type;
    if (callType === 'voice' || inc.description?.includes('Voice')) {
      const mins = Math.ceil((body.durationSec || 60) / 60);
      host.totalVoiceMinutes = (host.totalVoiceMinutes || 0) + mins;
      host.totalCalls = (host.totalCalls || 0) + 1;
    } else if (callType === 'video' || inc.description?.includes('Video')) {
      const mins = Math.ceil((body.durationSec || 60) / 60);
      host.totalVideoMinutes = (host.totalVideoMinutes || 0) + mins;
      host.totalCalls = (host.totalCalls || 0) + 1;
    } else if (inc.type === 'gift') {
      host.totalGiftsReceived = (host.totalGiftsReceived || 0) + 1;
    } else if (inc.type === 'message') {
      host.totalMessagesReceived = (host.totalMessagesReceived || 0) + 1;
    }

    if (!Array.isArray(host.incomeHistory)) {
      host.incomeHistory = [];
    }

    const record = {
      id: inc.id || `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: inc.type || (callType ? 'call' : 'message'),
      description: inc.description || `💰 60% Commission Credit (+₹${earned.toFixed(2)})`,
      grossAmount: gross,
      hostSharePercent: 60,
      hostEarned: earned,
      timestamp: inc.timestamp || Date.now()
    };

    if (!host.incomeHistory.some((x) => x.id === record.id)) {
      host.incomeHistory.unshift(record);
    }

    saveDatabase();
    console.log(`💰 [HOST COMMISSION LIVE UPDATE] ${host.name} (+₹${earned}) -> Pending Payout: ₹${host.pendingPayout}`);
    return sendJson(res, 200, { success: true, host, record });
  }

  // 5a-2. Single Host Profile & Real-time Live Balance (Sath k sath sync)
  if (pathname === '/api/hosts/profile' && req.method === 'GET') {
    const hostId = (parsedUrl.query.hostId || '').trim();
    const phone = (parsedUrl.query.phone || '').replace(/\D/g, '');

    let host = db.hosts[hostId];
    if (!host && phone) {
      host = Object.values(db.hosts).find(
        (h) => h && h.phone && String(h.phone).replace(/\D/g, '') === phone
      );
    }
    if (!host && hostId) {
      const cleanDigits = hostId.replace(/\D/g, '');
      if (cleanDigits.length >= 10) {
        host = Object.values(db.hosts).find(
          (h) => h && h.phone && String(h.phone).replace(/\D/g, '') === cleanDigits.slice(-10)
        );
      }
    }

    if (host) {
      return sendJson(res, 200, { success: true, host });
    }
    return sendJson(res, 404, { success: false, message: 'Host not found' });
  }

  // 5b. Get All Registered Users (Callers - Deduplicated)
  if (pathname === '/api/users' && req.method === 'GET') {
    const rawList = Object.values(db.users).filter((u) => u && (u.phone || u.email));
    const uniqueUsers = new Map();
    for (const u of rawList) {
      const p = u.phone ? String(u.phone).replace(/\D/g, '') : '';
      const em = u.email ? String(u.email).trim().toLowerCase() : '';
      const key = p ? `p_${p}` : em ? `e_${em}` : `id_${u.id}`;
      if (!uniqueUsers.has(key)) {
        uniqueUsers.set(key, u);
      }
    }
    return sendJson(res, 200, { success: true, users: Array.from(uniqueUsers.values()) });
  }

  // 5c. User Login (Phone or Email - Dual Auth)
  if (pathname === '/api/users/login' && req.method === 'POST') {
    const body = await parseBody(req);
    const parsedId = parseIdentifier(body.phone || body.email || body.identifier);
    const cleanPhone = parsedId.type === 'phone' ? parsedId.value : (body.phone ? String(body.phone).replace(/\D/g, '') : '');
    const cleanEmail = parsedId.type === 'email' ? parsedId.value : (body.email ? String(body.email).trim().toLowerCase() : '');

    if (cleanPhone.length < 10 && !cleanEmail) {
      return sendJson(res, 400, { success: false, message: 'Valid 10-digit mobile number or Email required.' });
    }

    // Check if identifier belongs to an existing registered Host!
    const hostUser = Object.values(db.hosts).find((h) => {
      if (!h) return false;
      if (cleanPhone && h.phone && String(h.phone).replace(/\D/g, '') === cleanPhone) return true;
      if (cleanEmail && h.email && h.email.toLowerCase() === cleanEmail) return true;
      return false;
    });

    if (hostUser) {
      const sessionToken = generateSessionToken();
      hostUser.activeSessionToken = sessionToken;
      hostUser.lastLoginAt = Date.now();
      hostUser.status = 'online';
      saveDatabase();
      console.log(`🌸 [HOST LOGGED IN VIA CALLER LOGIN] ${hostUser.name} (${cleanPhone || cleanEmail})`);
      return sendJson(res, 200, {
        success: true,
        isHost: true,
        role: 'host',
        host: hostUser,
        sessionToken,
        message: `🌸 Welcome back ${hostUser.name}! Aap Host Studio me login ho gaye hain.`
      });
    }

    const userKey = cleanPhone ? `p_${cleanPhone}` : `e_${cleanEmail}`;
    let user = Object.values(db.users).find((u) => {
      if (!u) return false;
      if (cleanPhone && u.phone && String(u.phone).replace(/\D/g, '') === cleanPhone) return true;
      if (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) return true;
      return false;
    });

    const sessionToken = generateSessionToken();

    if (user) {
      user.lastLoginAt = Date.now();
      user.activeSessionToken = sessionToken;
      if (body.name && body.name.trim() && user.name.startsWith('Caller ')) {
        user.name = body.name.trim();
      }
      saveDatabase();
      console.log(`👤 [USER LOGGED IN] ${user.name} (${cleanPhone || cleanEmail}) token=${sessionToken.slice(0, 10)}...`);
      return sendJson(res, 200, { success: true, isHost: false, role: 'caller', user, sessionToken, isNewUser: false });
    }

    // Auto-create new user account
    const userId = cleanPhone ? `caller-${cleanPhone}` : `caller-${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    const displayName = (body.name || '').trim() || (cleanPhone ? `Caller ${cleanPhone.slice(-4)}` : `User ${cleanEmail.split('@')[0]}`);
    user = {
      id: userId,
      phone: cleanPhone || '',
      email: cleanEmail || '',
      name: displayName,
      avatar: body.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      activeSessionToken: sessionToken,
      referredBy: body.referredBy || '',
      status: 'active',
      balance: 50.0
    };
    db.users[userId] = user;
    saveDatabase();
    console.log(`👤 [USER CREATED VIA LOGIN] ${user.name} (${cleanPhone || cleanEmail}) ID: ${userId}`);
    return sendJson(res, 200, { success: true, isHost: false, role: 'caller', user, sessionToken, isNewUser: true });
  }

  // 5d. Register or Update Caller User
  if (pathname === '/api/users/register' && req.method === 'POST') {
    const body = await parseBody(req);
    const parsedId = parseIdentifier(body.phone || body.email || body.identifier);
    const cleanPhone = parsedId.type === 'phone' ? parsedId.value : (body.phone ? String(body.phone).replace(/\D/g, '') : '');
    const cleanEmail = parsedId.type === 'email' ? parsedId.value : (body.email ? String(body.email).trim().toLowerCase() : '');

    if (cleanPhone.length < 10 && !cleanEmail) {
      return sendJson(res, 400, { success: false, message: 'Valid 10-digit mobile number or Email required.' });
    }

    const hostUser = Object.values(db.hosts).find((h) => {
      if (!h) return false;
      if (cleanPhone && h.phone && String(h.phone).replace(/\D/g, '') === cleanPhone) return true;
      if (cleanEmail && h.email && h.email.toLowerCase() === cleanEmail) return true;
      return false;
    });

    const sessionToken = generateSessionToken();

    if (hostUser) {
      hostUser.activeSessionToken = sessionToken;
      hostUser.lastLoginAt = Date.now();
      hostUser.status = 'online';
      saveDatabase();
      return sendJson(res, 200, {
        success: true,
        isHost: true,
        role: 'host',
        host: hostUser,
        sessionToken
      });
    }

    const userId = cleanPhone ? `caller-${cleanPhone}` : `caller-${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    const customName = (body.name || '').trim();

    if (customName && customName !== 'User' && !customName.startsWith('Caller ')) {
      const nameLower = customName.toLowerCase();
      const isCallerNameTaken = Object.values(db.users).some(
        (u) => u && u.name && u.name.trim().toLowerCase() === nameLower && u.id !== userId && (cleanPhone ? u.phone !== cleanPhone : true)
      );
      const isHostNameTaken = Object.values(db.hosts).some(
        (h) => h && h.name && h.name.trim().toLowerCase() === nameLower && (cleanPhone ? h.phone !== cleanPhone : true)
      );
      if (isCallerNameTaken || isHostNameTaken) {
        return sendJson(res, 400, {
          success: false,
          message: '⚠️ Yeh Profile Name pehle se kisi aur ka hai! Kripya doosra unique naam chunein.'
        });
      }
    }

    const displayName = customName || (cleanPhone ? `Caller ${cleanPhone.slice(-4)}` : `User ${cleanEmail.split('@')[0]}`);

    const user = {
      id: userId,
      phone: cleanPhone || '',
      email: cleanEmail || '',
      name: displayName,
      avatar: body.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
      createdAt: body.createdAt || Date.now(),
      lastLoginAt: Date.now(),
      activeSessionToken: sessionToken,
      referredBy: body.referredBy || '',
      status: body.status || 'active',
      balance: typeof body.balance === 'number' ? body.balance : 50.0
    };

    // Remove previous duplicate records for this phone/email
    for (const [k, existing] of Object.entries(db.users)) {
      if (!existing) continue;
      const exPhone = existing.phone ? String(existing.phone).replace(/\D/g, '') : '';
      const exEmail = existing.email ? String(existing.email).trim().toLowerCase() : '';
      if ((cleanPhone && exPhone === cleanPhone) || (cleanEmail && exEmail === cleanEmail) || existing.id === userId) {
        delete db.users[k];
      }
    }

    db.users[userId] = user;
    saveDatabase();
    console.log(`👤 [USER REGISTERED] ${user.name} (${cleanPhone || cleanEmail}) ID: ${userId}`);
    return sendJson(res, 200, { success: true, user, sessionToken });
  }

  // 5e. Anti-Multi-Login Active Session Verification Endpoint
  if (pathname === '/api/session/verify' && req.method === 'POST') {
    const body = await parseBody(req);
    const { id, phone, email, identifier, role, sessionToken } = body;
    if (!sessionToken) {
      return sendJson(res, 200, { valid: false, reason: 'no_token' });
    }

    const parsedId = parseIdentifier(identifier || phone || email);
    const cleanPhone = parsedId.type === 'phone' ? parsedId.value : (phone ? String(phone).replace(/\D/g, '') : '');
    const cleanEmail = parsedId.type === 'email' ? parsedId.value : (email ? String(email).trim().toLowerCase() : '');

    let account = null;
    if (role === 'host') {
      account = Object.values(db.hosts).find((h) => {
        if (!h) return false;
        if (id && h.id === id) return true;
        if (cleanPhone && h.phone && String(h.phone).replace(/\D/g, '') === cleanPhone) return true;
        if (cleanEmail && h.email && h.email.toLowerCase() === cleanEmail) return true;
        return false;
      });
    } else {
      account = Object.values(db.users).find((u) => {
        if (!u) return false;
        if (id && u.id === id) return true;
        if (cleanPhone && u.phone && String(u.phone).replace(/\D/g, '') === cleanPhone) return true;
        if (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) return true;
        return false;
      });
    }

    if (!account) {
      return sendJson(res, 200, { valid: true }); // Account not on server yet or offline mode
    }

    if (account.activeSessionToken && account.activeSessionToken !== sessionToken) {
      console.log(`🚫 [MULTI-LOGIN BLOCKED] Account ${account.name} (${account.phone || account.email}) logged in on another device! Terminating old session.`);
      return sendJson(res, 200, {
        valid: false,
        reason: 'multi_login',
        message: 'Aapka account kisi doosre device par login ho gaya hai. Yahan se logout kar diya gaya hai.'
      });
    }

    return sendJson(res, 200, { valid: true });
  }

  // 6. Start Call Session (Caller initiates)
  if (pathname === '/api/calls/start' && req.method === 'POST') {
    const body = await parseBody(req);
    const callId = body.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const session = {
      id: callId,
      callerId: body.callerId || 'caller',
      callerName: body.callerName || 'Friendly Caller',
      callerPhone: body.callerPhone || '',
      sakhiId: body.sakhiId,
      sakhiName: body.sakhiName,
      sakhiAvatar: body.sakhiAvatar,
      callType: body.callType || 'voice',
      status: 'ringing',
      offer: body.offer || null,
      answer: null,
      createdAt: Date.now()
    };

    db.callSessions[callId] = session;
    db.callCandidates[callId] = { caller: [], callee: [] };

    console.log(`📞 [CALL STARTED] ID: ${callId} | ${session.callerName} ➔ ${session.sakhiName} (${session.callType})`);
    return sendJson(res, 200, { success: true, session });
  }

  // 7. Check for Incoming Call (Host and Receiver polling)
  if (pathname === '/api/calls/incoming' && req.method === 'GET') {
    const hostId = (parsedUrl.query.hostId || '').trim();
    if (!hostId) return sendJson(res, 400, { success: false, message: 'hostId is required' });

    const cleanHostPhone = hostId.replace(/\D/g, '');
    const activeIncoming = Object.values(db.callSessions).find((s) => {
      if (s.status !== 'ringing') return false;
      if (Date.now() - s.createdAt > 45000) return false;

      // The caller who started the call must never be treated as the receiver of their own call
      if (s.callerId === hostId) return false;
      if (cleanHostPhone && s.callerPhone && s.callerPhone.replace(/\D/g, '') === cleanHostPhone) return false;

      // Match by exact sakhiId
      if (s.sakhiId === hostId) return true;
      // Match by clean phone in sakhiId
      if (cleanHostPhone && s.sakhiId && s.sakhiId.includes(cleanHostPhone)) return true;

      // Match against registered hosts database
      for (const h of Object.values(db.hosts)) {
        if (!h) continue;
        const hPhone = h.phone ? String(h.phone).replace(/\D/g, '') : '';
        if (h.id === hostId || (cleanHostPhone && hPhone && cleanHostPhone.includes(hPhone))) {
          if (s.sakhiId === h.id || (hPhone && s.sakhiId.includes(hPhone))) {
            return true;
          }
        }
      }

      // Match against registered users database (when receiver is a Caller!)
      for (const u of Object.values(db.users)) {
        if (!u) continue;
        const uPhone = u.phone ? String(u.phone).replace(/\D/g, '') : '';
        if (u.id === hostId || (cleanHostPhone && uPhone && cleanHostPhone.includes(uPhone))) {
          if (s.sakhiId === u.id || (uPhone && s.sakhiId.includes(uPhone))) {
            return true;
          }
        }
      }

      return false;
    });

    return sendJson(res, 200, { success: true, call: activeIncoming || null });
  }

  // 8. Answer Call Session (Host answers)
  if (pathname === '/api/calls/answer' && req.method === 'POST') {
    const body = await parseBody(req);
    const { callId, answer } = body;
    if (db.callSessions[callId]) {
      db.callSessions[callId].status = 'connected';
      db.callSessions[callId].answer = answer;
      db.callSessions[callId].connectedAt = Date.now();
      console.log(`✅ [CALL CONNECTED] ID: ${callId}`);
      return sendJson(res, 200, { success: true, session: db.callSessions[callId] });
    }
    return sendJson(res, 404, { success: false, message: 'Call not found' });
  }

  // 9. Get Call Session Status (Caller and Host poll)
  if (pathname === '/api/calls/session' && req.method === 'GET') {
    const callId = parsedUrl.query.callId;
    if (!callId || !db.callSessions[callId]) {
      return sendJson(res, 404, { success: false, message: 'Call session not found' });
    }
    return sendJson(res, 200, { success: true, session: db.callSessions[callId] });
  }

  // 10. Post ICE Candidate (Auto-initialize if not present)
  if (pathname === '/api/calls/candidate' && req.method === 'POST') {
    const body = await parseBody(req);
    const { callId, role, candidate } = body;
    if (!callId || !candidate) return sendJson(res, 400, { success: false });
    if (!db.callCandidates[callId]) {
      db.callCandidates[callId] = { caller: [], callee: [] };
    }
    const targetRole = role === 'callee' ? 'callee' : 'caller';
    db.callCandidates[callId][targetRole].push(candidate);
    return sendJson(res, 200, { success: true });
  }

  // 11. Get ICE Candidates (opponent's candidates)
  if (pathname === '/api/calls/candidates' && req.method === 'GET') {
    const callId = parsedUrl.query.callId;
    const forRole = parsedUrl.query.forRole; // 'caller' needs callee candidates, 'callee' needs caller candidates
    if (callId && db.callCandidates[callId]) {
      const neededRole = forRole === 'caller' ? 'callee' : 'caller';
      const list = db.callCandidates[callId][neededRole] || [];
      return sendJson(res, 200, { success: true, candidates: list });
    }
    return sendJson(res, 200, { success: true, candidates: [] });
  }

  // 12. End / Reject Call & Credit Host Commission (sath k sath live update)
  if (pathname === '/api/calls/end' && req.method === 'POST') {
    const body = await parseBody(req);
    const { callId, reason, durationSeconds, cost, hostId, hostPhone, callerName } = body;
    const session = db.callSessions[callId];
    if (session) {
      session.status = reason === 'rejected' ? 'rejected' : 'ended';
      session.endedAt = Date.now();
    }

    const duration = Number(durationSeconds) || (session && session.startedAt && session.status === 'connected' ? Math.floor((Date.now() - session.startedAt) / 1000) : 0);
    const callType = (session && session.callType) || body.callType || 'voice';

    // Credit host commission if call had active duration
    if (duration > 0) {
      const grossCost = Number(cost) || parseFloat(((duration * (callType === 'voice' ? 5 : 10)) / 60).toFixed(2));
      const hostEarned = parseFloat(((grossCost * 0.6).toFixed(2)));
      const mins = Math.ceil(duration / 60);

      // Locate host
      const targetHostPhone = String(hostPhone || (session && session.hostPhone) || '').replace(/\D/g, '');
      const targetHostId = hostId || (session && session.hostId) || '';

      let host = db.hosts[targetHostId];
      if (!host && targetHostPhone) {
        host = Object.values(db.hosts).find(
          (h) => h && h.phone && String(h.phone).replace(/\D/g, '') === targetHostPhone
        );
      }
      if (!host && targetHostId) {
        const cleanDigits = targetHostId.replace(/\D/g, '');
        if (cleanDigits.length >= 10) {
          host = Object.values(db.hosts).find(
            (h) => h && h.phone && String(h.phone).replace(/\D/g, '') === cleanDigits.slice(-10)
          );
        }
      }

      if (host && hostEarned > 0) {
        host.grossRevenue = parseFloat(((host.grossRevenue || 0) + grossCost).toFixed(2));
        host.netIncome = parseFloat(((host.netIncome || 0) + hostEarned).toFixed(2));
        host.pendingPayout = parseFloat(((host.pendingPayout || 0) + hostEarned).toFixed(2));
        host.totalCalls = (host.totalCalls || 0) + 1;

        if (callType === 'voice') {
          host.totalVoiceMinutes = (host.totalVoiceMinutes || 0) + mins;
        } else {
          host.totalVideoMinutes = (host.totalVideoMinutes || 0) + mins;
        }

        if (!Array.isArray(host.incomeHistory)) host.incomeHistory = [];
        const recordId = `call-inc-${callId || Date.now()}`;
        if (!host.incomeHistory.some((x) => x.id === recordId)) {
          host.incomeHistory.unshift({
            id: recordId,
            type: 'call',
            description: `📞 ${callType === 'voice' ? 'Voice' : 'Video'} Call (${mins} min) from ${callerName || (session && session.callerName) || 'Caller'}`,
            grossAmount: grossCost,
            hostSharePercent: 60,
            hostEarned: hostEarned,
            timestamp: Date.now()
          });
        }
        saveDatabase();
        console.log(`📞💰 [HOST COMMISSION - CALL] ${host.name} (+₹${hostEarned}) Total Pending Payout: ₹${host.pendingPayout}`);
      }
    }

    console.log(`🛑 [CALL ENDED] ID: ${callId} (${reason || 'ended'}, dur: ${duration}s)`);
    return sendJson(res, 200, { success: true });
  }

  // 13. Send Chat Message (Consolidated: Keeps all messages from the same user in one box)
  if (pathname === '/api/chat/send' && req.method === 'POST') {
    const body = await parseBody(req);
    const { threadId, message } = body;
    if (!threadId || !message) {
      return sendJson(res, 400, { success: false, message: 'threadId and message are required' });
    }

    const callerId = (message.callerId || '').trim();
    const sakhiId = (message.sakhiId || '').trim();
    const sender = message.sender; // 'user' (caller) or 'sakhi' (host)

    // STRICT REJECTION: Zero unauthenticated guest messages allowed
    if (!callerId || callerId === 'caller_guest' || callerId.includes('guest') || threadId.includes('caller_guest')) {
      return sendJson(res, 401, {
        success: false,
        error: 'Login Zaroori Hai: Bina ID login kare aap message send ya receive nahi kar sakte. Kripya pehle mobile number login karein.'
      });
    }

    // Extract phone numbers flexibly
    const digits = (threadId + '_' + sakhiId + '_' + callerId).match(/\d{10}/g) || [];
    let cleanHost = (sakhiId ? sakhiId.replace(/\D/g, '') : '').slice(-10);
    let cleanCaller = (callerId ? callerId.replace(/\D/g, '') : '').slice(-10);

    if (digits.length >= 2) {
      if (!cleanHost || cleanHost.length < 10) cleanHost = digits[0];
      if (!cleanCaller || cleanCaller.length < 10) cleanCaller = digits[1];
    } else if (digits.length === 1) {
      if (sender === 'user') {
        cleanCaller = digits[0];
      } else {
        cleanHost = digits[0];
      }
    }

    // Ensure cleanHost is the actual registered Host and cleanCaller is the Caller
    if (cleanHost && cleanCaller) {
      const isCallerAHost = Object.values(db.hosts).some(
        (h) => h && h.phone && String(h.phone).replace(/\D/g, '') === cleanCaller
      );
      const isHostAUser = db.users[cleanHost] || !Object.values(db.hosts).some(
        (h) => h && h.phone && String(h.phone).replace(/\D/g, '') === cleanHost
      );
      if (isCallerAHost && isHostAUser) {
        const temp = cleanHost;
        cleanHost = cleanCaller;
        cleanCaller = temp;
      }
    }

    // Ensure Host exists in db.hosts if host phone is known
    let hostFound = Object.values(db.hosts).find(
      (h) => (cleanHost && h.phone && String(h.phone).replace(/\D/g, '') === cleanHost) ||
             (sakhiId && (h.id === sakhiId || (h.phone && sakhiId.includes(h.phone))))
    );
    if (!hostFound && cleanHost && cleanHost.length >= 10) {
      hostFound = {
        id: sakhiId || `sakhi-user-${cleanHost}`,
        name: message.sakhiName || `Host ${cleanHost.slice(-4)}`,
        phone: cleanHost,
        gender: 'female',
        status: 'online',
        rating: 5.0,
        totalCalls: 0,
        languages: ['Hindi'],
        bio: 'Verified Female Companion',
        interests: ['Friendly Chat'],
        voiceRatePerMin: 5,
        videoRatePerMin: 10,
        tagline: '🌸 Verified Host',
        isVerified: true,
        grossRevenue: 0,
        netIncome: 0,
        pendingPayout: 0
      };
      db.hosts[hostFound.id] = hostFound;
    }

    // Ensure Caller exists in db.users if caller phone is known
    if (cleanCaller && cleanCaller.length >= 10 && !db.users[cleanCaller] && !DUMMY_PHONES.has(cleanCaller)) {
      db.users[cleanCaller] = {
        id: callerId || `caller-${cleanCaller}`,
        phone: cleanCaller,
        name: message.callerName || `Caller ${cleanCaller.slice(-4)}`,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
        status: 'active',
        balance: 50
      };
    }

    // Resolve Canonical Thread Key so all messages stay in ONE message box
    const canonicalKey = (cleanHost && cleanHost.length >= 10 && cleanCaller && cleanCaller.length >= 10)
      ? `chat_${cleanHost}_${cleanCaller}`
      : threadId;

    if (!db.chatMessages[canonicalKey]) {
      db.chatMessages[canonicalKey] = [];
    }

    // Migrate any older messages from legacy threadId into canonicalKey
    if (canonicalKey !== threadId && db.chatMessages[threadId]) {
      for (const oldMsg of db.chatMessages[threadId]) {
        if (!db.chatMessages[canonicalKey].some((x) => x.id === oldMsg.id)) {
          db.chatMessages[canonicalKey].push(oldMsg);
        }
      }
    }

    const msgWithId = {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: message.timestamp || Date.now(),
      status: 'sent',
      senderId: message.senderId || undefined
    };

    db.chatMessages[canonicalKey].push(msgWithId);
    if (canonicalKey !== threadId) {
      if (!db.chatMessages[threadId]) db.chatMessages[threadId] = [];
      db.chatMessages[threadId].push(msgWithId);
    }

    // HOST COMMISSION: Instantly credit 60% (₹1.20) to host girl's account on caller message (sath k sath live update)
    if (sender === 'user') {
      const hostFound = Object.values(db.hosts).find(
        (h) => h.id === sakhiId || (h.phone && sakhiId.includes(h.phone)) || threadId.includes(h.id) || (h.phone && threadId.includes(h.phone))
      );
      if (hostFound) {
        const hostEarned = 1.20; // 60% of ₹2
        hostFound.grossRevenue = parseFloat(((hostFound.grossRevenue || 0) + 2.0).toFixed(2));
        hostFound.netIncome = parseFloat(((hostFound.netIncome || 0) + hostEarned).toFixed(2));
        hostFound.pendingPayout = parseFloat(((hostFound.pendingPayout || 0) + hostEarned).toFixed(2));
        hostFound.totalMessagesReceived = (hostFound.totalMessagesReceived || 0) + 1;
        if (!Array.isArray(hostFound.incomeHistory)) hostFound.incomeHistory = [];
        const msgIncId = `msg-inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        hostFound.incomeHistory.unshift({
          id: msgIncId,
          type: 'message',
          description: `💬 Message from ${message.callerName || 'Caller'}`,
          grossAmount: 2.0,
          hostSharePercent: 60,
          hostEarned: hostEarned,
          timestamp: Date.now()
        });
        console.log(`💬💰 [HOST COMMISSION - CHAT] ${hostFound.name} (+₹${hostEarned}) Live Pending Payout: ₹${hostFound.pendingPayout}`);
      }
    }

    saveDatabase();
    console.log(`💬 [CONSOLIDATED CHAT] ${msgWithId.sender} (${msgWithId.callerId} ➔ ${msgWithId.sakhiId}) [${canonicalKey}]: ${msgWithId.text}`);

    // WhatsApp Tick Progression: Delivered in 600ms
    setTimeout(() => {
      try {
        if (db.chatMessages[canonicalKey]) {
          const m = db.chatMessages[canonicalKey].find((x) => x.id === msgWithId.id);
          if (m && m.status === 'sent') {
            m.status = 'delivered';
            saveDatabase();
          }
        }
      } catch (e) {}
    }, 600);

    return sendJson(res, 200, { success: true, message: msgWithId, threadId: canonicalKey });
  }

  // 14. Get Chat Messages (Consolidated view across all matching legacy & canonical threads)
  if (pathname === '/api/chat/messages' && req.method === 'GET') {
    const threadId = parsedUrl.query.threadId;
    if (!threadId) return sendJson(res, 400, { success: false, message: 'threadId is required' });

    if (threadId.includes('caller_guest') || threadId.includes('_guest')) {
      return sendJson(res, 401, {
        success: false,
        messages: [],
        error: 'Login Zaroori Hai: Bina registered ID login kare message receive ya read nahi kar sakte.'
      });
    }

    const digits = threadId.match(/\d{10}/g);
    let matchedMsgs = [];
    const seenMsgIds = new Set();

    if (digits && digits.length >= 2) {
      const p1 = digits[0];
      const p2 = digits[1];
      for (const [tId, msgs] of Object.entries(db.chatMessages)) {
        if (!Array.isArray(msgs)) continue;
        const matchesBoth = (tId.includes(p1) && tId.includes(p2)) || (tId.includes(p2) && tId.includes(p1));
        const msgsMatch = msgs.some(
          (m) =>
            (m.sakhiId && (m.sakhiId.includes(p1) || m.sakhiId.includes(p2))) &&
            (m.callerId && (m.callerId.includes(p1) || m.callerId.includes(p2)))
        );
        if (matchesBoth || msgsMatch || tId === threadId) {
          for (const m of msgs) {
            if (!seenMsgIds.has(m.id)) {
              seenMsgIds.add(m.id);
              matchedMsgs.push(m);
            }
          }
        }
      }
    } else if (digits && digits.length === 1) {
      const p = digits[0];
      for (const [tId, msgs] of Object.entries(db.chatMessages)) {
        if (!Array.isArray(msgs)) continue;
        if (tId.includes(p) || tId === threadId) {
          for (const m of msgs) {
            if (!seenMsgIds.has(m.id)) {
              seenMsgIds.add(m.id);
              matchedMsgs.push(m);
            }
          }
        }
      }
    } else {
      matchedMsgs = db.chatMessages[threadId] || [];
    }

    matchedMsgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    return sendJson(res, 200, { success: true, messages: matchedMsgs });
  }

  // 14b. Mark Thread Messages As Read (Double Blue Ticks)
  if (pathname === '/api/chat/read' && req.method === 'POST') {
    const body = await parseBody(req);
    const { threadId, reader } = body; // reader: 'user' | 'sakhi'
    if (threadId) {
      let updated = false;
      const digits = threadId.match(/\d{10}/g);

      for (const [tId, msgs] of Object.entries(db.chatMessages)) {
        if (!Array.isArray(msgs)) continue;
        const match =
          tId === threadId ||
          (digits && digits.length >= 2 && tId.includes(digits[0]) && tId.includes(digits[1]));

        if (match) {
          msgs.forEach((msg) => {
            if (msg.sender !== reader && msg.status !== 'read') {
              msg.status = 'read';
              updated = true;
            }
          });
        }
      }
      if (updated) saveDatabase();
      return sendJson(res, 200, { success: true });
    }
    return sendJson(res, 200, { success: true });
  }

  // 14c. Get Conversations List (For Host or Caller - Real-time sync for both roles)
  if (pathname === '/api/chat/conversations' && req.method === 'GET') {
    const hostId = parsedUrl.query.hostId || '';
    const cleanHostPhone = hostId ? hostId.replace(/\D/g, '') : '';
    const rawCaller = parsedUrl.query.callerPhone || parsedUrl.query.callerId || parsedUrl.query.phone || '';
    const cleanCallerPhone = rawCaller ? rawCaller.replace(/\D/g, '').slice(-10) : '';

    // 1. Caller requesting their conversations with verified Sakhis
    if (cleanCallerPhone && !hostId) {
      const sakhiGroupMap = new Map();

      for (const [threadId, msgs] of Object.entries(db.chatMessages)) {
        if (!Array.isArray(msgs) || msgs.length === 0) continue;
        if (threadId.includes('caller_guest') || threadId.includes('_guest')) continue;

        const match =
          threadId.includes(cleanCallerPhone) ||
          msgs.some((m) => m.callerId && m.callerId.includes(cleanCallerPhone));

        if (match) {
          for (const m of msgs) {
            const rawSakhi = m.sakhiId || '';
            const sakhiDigits = rawSakhi.replace(/\D/g, '') || threadId.split('_')[1]?.replace(/\D/g, '');
            const cleanSakhi = sakhiDigits && sakhiDigits.length >= 10 ? sakhiDigits.slice(-10) : (rawSakhi || 'sakhi_default');

            if (!sakhiGroupMap.has(cleanSakhi)) {
              const hostObj = Object.values(db.hosts).find(
                (h) => (h.phone && h.phone.includes(cleanSakhi)) || h.id === rawSakhi
              );
              sakhiGroupMap.set(cleanSakhi, {
                sakhiId: hostObj?.id || rawSakhi || `sakhi_${cleanSakhi}`,
                sakhiName: hostObj?.name || m.sakhiName || 'Sakhi',
                sakhiAvatar: hostObj?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
                callerPhone: cleanCallerPhone,
                callerId: m.callerId || `caller_${cleanCallerPhone}`,
                callerName: m.callerName || 'Caller',
                allMsgs: []
              });
            }
            sakhiGroupMap.get(cleanSakhi).allMsgs.push(m);
          }
        }
      }

      const callerConversations = [];
      for (const [cleanSakhi, data] of sakhiGroupMap.entries()) {
        data.allMsgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        const uniqueMsgs = [];
        const seenIds = new Set();
        for (const msg of data.allMsgs) {
          if (msg.id && seenIds.has(msg.id)) continue;
          if (msg.id) seenIds.add(msg.id);
          uniqueMsgs.push(msg);
        }

        if (uniqueMsgs.length === 0) continue;

        const lastMsg = uniqueMsgs[uniqueMsgs.length - 1];
        const unreadCount = uniqueMsgs.filter((m) => m.sender === 'sakhi' && m.status !== 'read').length;
        const canonicalThreadId = `chat_${cleanSakhi}_${cleanCallerPhone}`;

        callerConversations.push({
          threadId: canonicalThreadId,
          sakhiId: data.sakhiId,
          sakhiName: data.sakhiName,
          sakhiAvatar: data.sakhiAvatar,
          callerId: data.callerId,
          callerName: data.callerName,
          callerPhone: cleanCallerPhone,
          lastMessage: lastMsg.text,
          lastSender: lastMsg.sender,
          updatedAt: lastMsg.timestamp,
          unreadCount,
          totalMessages: uniqueMsgs.length
        });
      }

      callerConversations.sort((a, b) => b.updatedAt - a.updatedAt);
      return sendJson(res, 200, { success: true, conversations: callerConversations });
    }

    // 2. Host requesting conversations with all Callers
    const callerGroupMap = new Map();

    for (const [threadId, msgs] of Object.entries(db.chatMessages)) {
      if (!Array.isArray(msgs) || msgs.length === 0) continue;
      if (threadId.includes('caller_guest') || threadId.includes('_guest')) continue;

      const match =
        !hostId ||
        threadId.includes(hostId) ||
        (cleanHostPhone && threadId.includes(cleanHostPhone)) ||
        msgs.some(
          (m) =>
            m.sakhiId === hostId ||
            (cleanHostPhone && m.sakhiId && m.sakhiId.includes(cleanHostPhone))
        );

      if (match) {
        for (const m of msgs) {
          const rawCaller = m.callerId || '';
          const callerDigits = rawCaller.replace(/\D/g, '') || threadId.split('_')[1]?.replace(/\D/g, '');
          if (!callerDigits || callerDigits.length < 10) continue;
          const cleanCaller = callerDigits.slice(-10);

          if (!callerGroupMap.has(cleanCaller)) {
            callerGroupMap.set(cleanCaller, {
              callerPhone: cleanCaller,
              callerName: m.callerName || `Caller ${cleanCaller.slice(-4)}`,
              callerId: m.callerId || `caller_${cleanCaller}`,
              sakhiId: hostId || m.sakhiId,
              allMsgs: []
            });
          }
          const group = callerGroupMap.get(cleanCaller);
          if (m.callerName && !m.callerName.startsWith('Caller ') && group.callerName.startsWith('Caller ')) {
            group.callerName = m.callerName;
          }
          group.allMsgs.push(m);
        }
      }
    }

    const conversations = [];
    for (const [cleanCaller, data] of callerGroupMap.entries()) {
      data.allMsgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      const uniqueMsgs = [];
      const seenIds = new Set();
      for (const msg of data.allMsgs) {
        if (msg.id && seenIds.has(msg.id)) continue;
        if (msg.id) seenIds.add(msg.id);
        uniqueMsgs.push(msg);
      }

      if (uniqueMsgs.length === 0) continue;

      const lastMsg = uniqueMsgs[uniqueMsgs.length - 1];
      const unreadCount = uniqueMsgs.filter((m) => m.sender === 'user' && m.status !== 'read').length;
      const canonicalThreadId = cleanHostPhone
        ? `chat_${cleanHostPhone.slice(-10)}_${cleanCaller}`
        : `chat_${cleanCaller}`;

      const hostObj = Object.values(db.hosts).find(
        (h) => (cleanHostPhone && h.phone && h.phone.includes(cleanHostPhone)) || h.id === hostId
      );

      conversations.push({
        threadId: canonicalThreadId,
        sakhiId: data.sakhiId,
        sakhiName: hostObj?.name || '',
        sakhiAvatar: hostObj?.avatar || '',
        callerId: data.callerId,
        callerName: data.callerName,
        callerPhone: cleanCaller,
        lastMessage: lastMsg.text,
        lastSender: lastMsg.sender,
        updatedAt: lastMsg.timestamp,
        unreadCount,
        totalMessages: uniqueMsgs.length
      });
    }

    conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    return sendJson(res, 200, { success: true, conversations });
  }

  // 15. Admin Portal Status
  if (pathname === '/api/admin/overview' && req.method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      activeHosts: Object.keys(db.hosts).length,
      activeCalls: Object.values(db.callSessions).filter((s) => s.status === 'connected' || s.status === 'ringing').length,
      totalChatThreads: Object.keys(db.chatMessages).length,
      recentOtpRequests: Object.entries(db.otpStore).map(([phone, data]) => ({
        phone,
        code: data.code,
        createdAt: data.createdAt
      }))
    });
  }

  // 16. Submit Recharge Request (Manual UTR verification)
  // 16. Submit Recharge Request (Manual UTR verification)
  if (pathname === '/api/recharge/submit' && req.method === 'POST') {
    const body = await parseBody(req);
    const cleanUtr = (body.utr || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!cleanUtr || cleanUtr.length < 6) {
      return sendJson(res, 400, { success: false, message: 'Valid 12-digit UTR number darj karein.' });
    }

    const reqId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const requestItem = {
      id: reqId,
      userId: body.userId,
      userName: body.userName || 'Caller User',
      userPhone: body.userPhone || '',
      amount: Number(body.amount) || 0,
      bonus: Number(body.bonus) || 0,
      totalBalance: (Number(body.amount) || 0) + (Number(body.bonus) || 0),
      utr: cleanUtr,
      paymentMethod: body.paymentMethod || 'UPI',
      status: 'pending',
      createdAt: Date.now()
    };

    db.rechargeRequests[reqId] = requestItem;
    saveDatabase();
    console.log(`📥 [RECHARGE REQUEST] UTR: ${cleanUtr} | Amount: ₹${requestItem.amount} | User: ${requestItem.userPhone}`);
    return sendJson(res, 200, { success: true, request: requestItem });
  }

  // 17. List Recharge Requests
  if (pathname === '/api/recharge/list' && req.method === 'GET') {
    const list = Object.values(db.rechargeRequests).sort((a, b) => b.createdAt - a.createdAt);
    return sendJson(res, 200, { success: true, requests: list });
  }

  // 18. Approve Recharge Request
  if (pathname === '/api/recharge/approve' && req.method === 'POST') {
    const body = await parseBody(req);
    const { requestId, adminNote } = body;
    const item = db.rechargeRequests[requestId];
    if (!item) {
      return sendJson(res, 404, { success: false, message: 'Request not found' });
    }
    item.status = 'approved';
    item.reviewedAt = Date.now();
    item.reviewedBy = 'Admin';
    item.adminNote = adminNote || 'Approved by Admin';
    saveDatabase();
    console.log(`✅ [RECHARGE APPROVED] UTR: ${item.utr} | +₹${item.totalBalance} credited to ${item.userId}`);
    return sendJson(res, 200, { success: true, request: item });
  }

  // 19. Reject Recharge Request
  if (pathname === '/api/recharge/reject' && req.method === 'POST') {
    const body = await parseBody(req);
    const { requestId, reason } = body;
    const item = db.rechargeRequests[requestId];
    if (!item) {
      return sendJson(res, 404, { success: false, message: 'Request not found' });
    }
    item.status = 'rejected';
    item.reviewedAt = Date.now();
    item.reviewedBy = 'Admin';
    item.rejectReason = reason || 'Payment not verified';
    saveDatabase();
    console.log(`❌ [RECHARGE REJECTED] UTR: ${item.utr} | Reason: ${item.rejectReason}`);
    return sendJson(res, 200, { success: true, request: item });
  }

  // 20. Admin All Data endpoint
  if (pathname === '/api/admin/all-data' && req.method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      hosts: Object.values(db.hosts),
      users: Object.values(db.users),
      payouts: db.payouts,
      rechargeRequests: Object.values(db.rechargeRequests)
    });
  }

  // 21. Admin Hosts List (All Hosts: Pending, Verified, and Rejected)
  if (pathname === '/api/admin/hosts' && req.method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      hosts: Object.values(db.hosts)
    });
  }

  // 22. Admin Host Approval / Rejection Endpoint
  // "face verify b ho live tab host id ki admin approve kareyga bina approval koi b host id activate na ho"
  if (pathname === '/api/admin/hosts/verify' && req.method === 'POST') {
    const body = await parseBody(req);
    const { hostId, action, adminNote } = body;

    if (!hostId) {
      return sendJson(res, 400, { success: false, message: 'hostId is required' });
    }

    // Find host by exact ID or phone
    const cleanPhone = String(hostId).replace(/\D/g, '');
    const foundId = Object.keys(db.hosts).find(
      (k) => k === hostId || (cleanPhone && cleanPhone.length >= 10 && (k.includes(cleanPhone) || db.hosts[k].phone === cleanPhone))
    );

    if (!foundId || !db.hosts[foundId]) {
      return sendJson(res, 404, { success: false, message: 'Host not found' });
    }

    const host = db.hosts[foundId];
    if (!host.verification) {
      host.verification = {
        idType: 'aadhaar',
        idNumber: '',
        selfieUrl: host.avatar || '',
        gender: 'female',
        status: 'pending'
      };
    }

    if (action === 'approve') {
      host.isVerified = true;
      host.status = 'online'; // Activated for calls
      host.verification.status = 'verified';
      host.verification.verifiedAt = Date.now();
      host.verification.approvedAt = Date.now();
      host.verification.approvedBy = 'Admin';
      saveDatabase();
      console.log(`✅ [HOST APPROVED & ACTIVATED BY ADMIN] ${host.name} (+91 ${host.phone}) ID: ${foundId}`);
      return sendJson(res, 200, {
        success: true,
        message: `✅ Host (${host.name}) successfully approved and activated! Callers can now connect.`,
        host
      });
    } else {
      host.isVerified = false;
      host.status = 'offline'; // Inactive
      host.verification.status = 'rejected';
      host.verification.rejectedAt = Date.now();
      host.verification.rejectReason = adminNote || 'Admin verification rejected';
      saveDatabase();
      console.log(`❌ [HOST REJECTED BY ADMIN] ${host.name} (+91 ${host.phone}) ID: ${foundId} | Reason: ${host.verification.rejectReason}`);
      return sendJson(res, 200, {
        success: true,
        message: `❌ Host (${host.name}) verification rejected.`,
        host
      });
    }
  }

  // -------------------------------------------------------------
  // STATIC FILE SERVING FROM dist/
  // -------------------------------------------------------------
  let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);

  // If file doesn't exist, serve index.html for SPA client-side routing
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    if (ext === '.apk' || ext === '.zip' || stats.size > 2 * 1024 * 1024) {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } else {
      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('500 Internal Server Error');
          return;
        }
        const isHtml = ext === '.html';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stats.size,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': isHtml ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600'
        });
        res.end(content);
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 SunoSakhi Full-Stack Production Server live on http://localhost:${PORT}`);
});
