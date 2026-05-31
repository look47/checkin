const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const richieste = require('./richieste');
const logger = require('./logger');
const validator = require('./validator');

const ROOT = __dirname;
const PORT_HTTP = process.env.PORT || 8080;
const PORT_HTTPS = 8443;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'checkin2024';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const sessions = new Map();

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  
  const requests = rateLimitMap.get(ip).filter(timestamp => timestamp > windowStart);
  requests.push(now);
  rateLimitMap.set(ip, requests);
  
  return requests.length <= RATE_LIMIT_MAX_REQUESTS;
}

const COMUNI = {
  'comune-a': {
    id: 'comune-a',
    nome: 'Comune di Milano',
    password: 'milano2024'
  },
  'comune-b': {
    id: 'comune-b',
    nome: 'Comune di Roma',
    password: 'roma2024'
  }
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('Payload troppo grande'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function getToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function isAuthorized(req) {
  const token = getToken(req);
  if (!token || !sessions.has(token)) return false;
  const session = sessions.get(token);
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function getSession(req) {
  const token = getToken(req);
  if (!token || !sessions.has(token)) return null;
  const session = sessions.get(token);
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function validateCheckinPayload(body) {
  const errors = validator.validateCheckinPayload(body);
  return errors.length > 0 ? errors.join('; ') : null;
}

function normalizeCheckin(body) {
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  return {
    esito: body.esito,
    motivo: body.motivo || '',
    codiceFiscale: String(body.codiceFiscale || 'NON_INSERITO').toUpperCase(),
    indirizzo: String(body.indirizzo || ''),
    via: body.via || '',
    civico: body.civico || '',
    cap: body.cap || '',
    comune: body.comune || '',
    provincia: (body.provincia || '').toUpperCase(),
    latitudine: num(body.latitudine),
    longitudine: num(body.longitudine),
    latitudineResidenza: num(body.latitudineResidenza),
    longitudineResidenza: num(body.longitudineResidenza),
    distanzaMetri: num(body.distanzaMetri) !== null ? Math.round(num(body.distanzaMetri)) : null,
    precisioneGps: num(body.precisioneGps) !== null ? Math.round(num(body.precisioneGps)) : null,
    fotoSelfie: body.fotoSelfie || null,
    timestamp: body.timestamp,
    reteTipo: body.reteTipo || '',
    reteEffectiveType: body.reteEffectiveType || '',
    ipClient: body.ipClient || '',
    doppioControllo: body.doppioControllo || '',
    richiestaToken: body.richiestaToken || null,
  };
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  let ip = req.socket.remoteAddress || '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

async function geocodeIndirizzo(indirizzo) {
  const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' +
    encodeURIComponent(indirizzo) + '&limit=1&countrycodes=it';
  const res = await fetch(url, { headers: { 'Accept-Language': 'it', 'User-Agent': 'CheckInApp/1.0' } });
  const data = await res.json();
  if (!data.length) throw new Error('Impossibile geolocalizzare l\'indirizzo');
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name };
}

function buildBaseUrl(req) {
  const host = req.headers.host || '192.168.1.3:8443';
  const proto = req.socket.encrypted ? 'https' : 'http';
  return proto + '://' + host;
}

function buildMessaggioNotifica(richiesta, baseUrl) {
  const scadenza = new Date(richiesta.scadeAt).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const link = baseUrl + '/?r=' + richiesta.token;
  return (
    'Check-In obbligatorio: entro 15 minuti (entro le ' + scadenza + ') ' +
    'conferma la tua presenza alla residenza registrata:\n' +
    richiesta.indirizzo + '\n\n' +
    'Accedi qui per completare il check-in:\n' + link
  );
}

async function handleApi(req, res, urlPath) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end();
    return true;
  }

  if (urlPath === '/health' && req.method === 'GET') {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    };
    json(res, 200, healthCheck);
    return true;
  }

  if (urlPath === '/api/admin/login' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const comuneId = body.comuneId;
      const password = body.password;
      const ip = getClientIp(req);

      if (!comuneId || !COMUNI[comuneId]) {
        logger.warn('Login fallito - comune non valido', { ip, comuneId });
        json(res, 400, { error: 'Comune non valido' });
        return true;
      }

      if (COMUNI[comuneId].password !== password) {
        logger.warn('Login fallito - password non valida', { ip, comuneId });
        json(res, 401, { error: 'Password non valida' });
        return true;
      }

      const token = createSession();
      sessions.set(token, {
        expiresAt: Date.now() + SESSION_TTL_MS,
        comuneId: comuneId,
        comuneNome: COMUNI[comuneId].nome
      });
      logger.info('Login effettuato con successo', { ip, comuneId, comuneNome: COMUNI[comuneId].nome });
      json(res, 200, {
        token,
        expiresIn: SESSION_TTL_MS / 1000,
        comune: {
          id: COMUNI[comuneId].id,
          nome: COMUNI[comuneId].nome
        }
      });
    } catch (e) {
      logger.error('Errore login', { error: e.message });
      json(res, 400, { error: 'Richiesta non valida' });
    }
    return true;
  }

  if (urlPath === '/api/client-info' && req.method === 'GET') {
    json(res, 200, { ip: getClientIp(req) });
    return true;
  }

  if (urlPath === '/api/checkin' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      let comuneId = '';
      const ip = getClientIp(req);

      if (body.richiestaToken) {
        const check = richieste.validaRichiestaPerCheckin(body.richiestaToken);
        if (!check.ok && body.esito === 'verificato') {
          logger.warn('Check-in fallito - richiesta non valida', { ip, token: body.richiestaToken, error: check.error });
          json(res, 400, { error: check.error });
          return true;
        }
        if (check.ok && body.codiceFiscale &&
            String(body.codiceFiscale).toUpperCase() !== check.richiesta.codiceFiscale) {
          logger.warn('Check-in fallito - CF non corrisponde', { ip, token: body.richiestaToken });
          json(res, 400, { error: 'Codice Fiscale non corrisponde alla richiesta' });
          return true;
        }
        comuneId = check.richiesta.comuneId || '';
      }

      const err = validateCheckinPayload(body);
      if (err) {
        logger.warn('Check-in fallito - validazione', { ip, error: err });
        json(res, 400, { error: err });
        return true;
      }
      const record = db.createCheckin({ ...normalizeCheckin(body), comuneId });

      if (body.richiestaToken && body.esito === 'verificato') {
        richieste.completaRichiesta(body.richiestaToken, record.id);
      }

      logger.info('Check-in registrato', { ip, esito: body.esito, cf: body.codiceFiscale, comuneId });
      json(res, 201, { ok: true, id: record.id });
    } catch (e) {
      logger.error('Errore check-in', { error: e.message });
      json(res, 400, { error: 'Richiesta non valida' });
    }
    return true;
  }

  if (urlPath === '/api/richieste' && req.method === 'GET') {
    if (!isAuthorized(req)) {
      json(res, 401, { error: 'Non autorizzato' });
      return true;
    }
    const session = getSession(req);
    const params = new URL(req.url, 'http://localhost').searchParams;
    json(res, 200, {
      richieste: richieste.getRichieste({
        limit: Number(params.get('limit') || 100),
        stato: params.get('stato') || '',
        comuneId: session?.comuneId || '',
      }),
    });
    return true;
  }

  if (urlPath === '/api/richieste' && req.method === 'POST') {
    if (!isAuthorized(req)) {
      json(res, 401, { error: 'Non autorizzato' });
      return true;
    }
    try {
      const session = getSession(req);
      const body = JSON.parse(await readBody(req));
      const ip = getClientIp(req);
      
      const validationErrors = validator.validateRichiestaPayload(body);
      if (validationErrors.length > 0) {
        logger.warn('Creazione richiesta fallita - validazione', { ip, errors: validationErrors });
        json(res, 400, { error: validationErrors.join('; ') });
        return true;
      }
      
      const cf = String(body.codiceFiscale || '').toUpperCase();
      const via = String(body.via || '').trim();
      const civico = String(body.civico || '').trim();
      const cap = String(body.cap || '').trim();
      const comune = String(body.comune || '').trim();
      const provincia = String(body.provincia || '').trim().toUpperCase();
      const indirizzo = `${via} ${civico}, ${cap} ${comune} ${provincia}, Italia`;
      const geo = await geocodeIndirizzo(indirizzo);
      const record = richieste.createRichiesta({
        comuneId: session?.comuneId || '',
        codiceFiscale: cf,
        via, civico, cap, comune, provincia, indirizzo,
        latitudineResidenza: geo.lat,
        longitudineResidenza: geo.lng,
        indirizzoGeocodificato: geo.displayName,
      });
      logger.info('Richiesta check-in creata', { ip, comuneId: session?.comuneId, cf, token: record.token });
      const baseUrl = buildBaseUrl(req);
      const link = baseUrl + '/?r=' + record.token;
      
      // Simula invio notifica (Twilio/SendGrid)
      const contatto = body.contatto || '';
      if (contatto) {
        logger.info('[NOTIFICA INVIATA]', {
          destinatario: contatto,
          link: link,
          tipo: contatto.includes('@') ? 'Email (SendGrid simulato)' : 'SMS (Twilio simulato)',
          cf: cf,
          scadenzaMinuti: richieste.SCADENZA_MINUTI
        });
        console.log(`[NOTIFICA INVIATA] Destinatario: ${contatto} - Link: ${link}`);
      }
      
      json(res, 201, {
        richiesta: record,
        link: link,
        messaggio: buildMessaggioNotifica(record, baseUrl),
        scadenzaMinuti: richieste.SCADENZA_MINUTI,
        notificaInviata: !!contatto,
      });
    } catch (e) {
      logger.error('Errore creazione richiesta', { error: e.message });
      json(res, 400, { error: e.message || 'Richiesta non valida' });
    }
    return true;
  }

  const matchRichiesta = urlPath.match(/^\/api\/richieste\/([a-f0-9]+)$/);
  if (matchRichiesta && req.method === 'GET') {
    const record = richieste.getByToken(matchRichiesta[1]);
    if (!record) {
      json(res, 404, { error: 'Richiesta non trovata' });
      return true;
    }
    json(res, 200, {
      richiesta: {
        token: record.token,
        stato: record.stato,
        codiceFiscale: record.codiceFiscale,
        via: record.via,
        civico: record.civico,
        cap: record.cap,
        comune: record.comune,
        provincia: record.provincia,
        indirizzo: record.indirizzo,
        latitudineResidenza: record.latitudineResidenza,
        longitudineResidenza: record.longitudineResidenza,
        createdAt: record.createdAt,
        scadeAt: record.scadeAt,
        scadenzaMinuti: richieste.SCADENZA_MINUTI,
      },
    });
    return true;
  }

  if (urlPath === '/api/checkins' && req.method === 'GET') {
    if (!isAuthorized(req)) {
      json(res, 401, { error: 'Non autorizzato' });
      return true;
    }
    const session = getSession(req);
    const params = new URL(req.url, 'http://localhost').searchParams;
    const records = db.getCheckins({
      limit: Number(params.get('limit') || 200),
      cf: params.get('cf') || '',
      from: params.get('from') || '',
      to: params.get('to') || '',
      esito: params.get('esito') || '',
      comuneId: session?.comuneId || '',
    });
    json(res, 200, { checkins: records });
    return true;
  }

  if (urlPath === '/api/stats' && req.method === 'GET') {
    if (!isAuthorized(req)) {
      json(res, 401, { error: 'Non autorizzato' });
      return true;
    }
    const session = getSession(req);
    json(res, 200, db.getStats(session?.comuneId || ''));
    return true;
  }

  return false;
}

function serveStatic(req, res, urlPath) {
  const safePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function handler(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const clientIp = getClientIp(req);

  try {
    if (urlPath.startsWith('/api/')) {
      if (!checkRateLimit(clientIp)) {
        logger.warn('Rate limit exceeded', { ip: clientIp });
        json(res, 429, { error: 'Troppe richieste. Riprova tra un minuto.' });
        return;
      }
      const handled = await handleApi(req, res, urlPath);
      if (handled) return;
      json(res, 404, { error: 'Endpoint non trovato' });
      return;
    }

    serveStatic(req, res, urlPath);
  } catch (error) {
    logger.error('Unhandled error in handler', { error: error.message, stack: error.stack, url: urlPath, ip: clientIp });
    json(res, 500, { error: 'Errore interno del server' });
  }
}

http.createServer(handler).listen(PORT_HTTP, '0.0.0.0', () => {
  logger.info('Server HTTP avviato', { port: PORT_HTTP });
  console.log(`HTTP  → http://192.168.1.3:${PORT_HTTP}`);
  console.log(`Admin → http://192.168.1.3:${PORT_HTTP}/admin.html`);
});

const pfxPath = path.join(ROOT, 'cert', 'server.pfx');
if (fs.existsSync(pfxPath)) {
  https.createServer(
    { pfx: fs.readFileSync(pfxPath), passphrase: 'checkin' },
    handler
  ).listen(PORT_HTTPS, '0.0.0.0', () => {
    console.log(`HTTPS → https://192.168.1.3:${PORT_HTTPS}`);
    console.log(`Admin → https://192.168.1.3:${PORT_HTTPS}/admin.html`);
    console.log(`Password admin: ${ADMIN_PASSWORD}`);
  });
} else {
  console.log('Certificato HTTPS non trovato: esegui setup-cert.ps1');
}
