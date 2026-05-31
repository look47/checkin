const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'checkins.json');
const RICHIESTE_FILE = path.join(DATA_DIR, 'richieste.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson(filePath) {
  ensureDataDir();
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]', 'utf8');
      return [];
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function writeJson(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// SQL-like abstraction layer
class Database {
  constructor() {
    this.checkins = [];
    this.richieste = [];
    this.load();
  }

  load() {
    this.checkins = readJson(DB_FILE);
    this.richieste = readJson(RICHIESTE_FILE);
  }

  save() {
    writeJson(DB_FILE, this.checkins);
    writeJson(RICHIESTE_FILE, this.richieste);
  }

  // Checkins operations
  insertCheckin(data) {
    const record = {
      id: require('crypto').randomUUID(),
      createdAt: new Date().toISOString(),
      ...data,
    };
    this.checkins.unshift(record);
    this.save();
    return record;
  }

  selectCheckins(filters = {}) {
    let results = [...this.checkins];

    if (filters.comuneId) {
      results = results.filter(r => r.comuneId === filters.comuneId);
    }
    if (filters.cf) {
      const q = filters.cf.toUpperCase();
      results = results.filter(r => r.codiceFiscale.includes(q));
    }
    if (filters.esito) {
      results = results.filter(r => r.esito === filters.esito);
    }
    if (filters.from) {
      const fromDate = new Date(filters.from).getTime();
      results = results.filter(r => new Date(r.timestamp).getTime() >= fromDate);
    }
    if (filters.to) {
      const toDate = new Date(filters.to).getTime() + 86400000 - 1;
      results = results.filter(r => new Date(r.timestamp).getTime() <= toDate);
    }
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  selectStats(comuneId = '') {
    let records = this.checkins;

    if (comuneId) {
      records = records.filter(r => r.comuneId === comuneId);
    }

    const today = new Date().toISOString().slice(0, 10);
    const oggi = records.filter(r => r.timestamp.startsWith(today)).length;
    const verificati = records.filter(r => r.esito === 'verificato').length;
    const falliti = records.filter(r => r.esito === 'fallito').length;
    const totale = records.length;
    const successoPerc = totale > 0 ? ((verificati / totale) * 100).toFixed(1) : 0;

    return { totale, oggi, verificati, falliti, successoPerc };
  }

  // Richieste operations
  insertRichiesta(data) {
    const now = new Date();
    const scadeAt = new Date(now.getTime() + 15 * 60 * 1000);
    const record = {
      id: require('crypto').randomUUID(),
      token: require('crypto').randomBytes(16).toString('hex'),
      stato: 'in_attesa',
      createdAt: now.toISOString(),
      scadeAt: scadeAt.toISOString(),
      completataAt: null,
      checkinId: null,
      ...data,
    };
    this.richieste.unshift(record);
    this.save();
    return record;
  }

  selectRichiestaByToken(token) {
    const idx = this.richieste.findIndex(r => r.token === token);
    if (idx === -1) return null;
    
    // Aggiorna stato se scaduto
    if (new Date(this.richieste[idx].scadeAt).getTime() < Date.now()) {
      this.richieste[idx].stato = 'scaduta';
      this.save();
    }
    
    return this.richieste[idx];
  }

  selectRichieste(filters = {}) {
    let results = this.richieste.map(r => {
      // Aggiorna stato scadute
      if (new Date(r.scadeAt).getTime() < Date.now() && r.stato === 'in_attesa') {
        r.stato = 'scaduta';
      }
      return r;
    });
    
    this.save();

    if (filters.comuneId) {
      results = results.filter(r => r.comuneId === filters.comuneId);
    }
    if (filters.stato) {
      results = results.filter(r => r.stato === filters.stato);
    }
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  updateRichiestaCompletata(token, checkinId) {
    const idx = this.richieste.findIndex(r => r.token === token);
    if (idx === -1) return null;
    
    if (this.richieste[idx].stato !== 'in_attesa') return this.richieste[idx];
    
    this.richieste[idx].stato = 'completata';
    this.richieste[idx].completataAt = new Date().toISOString();
    this.richieste[idx].checkinId = checkinId;
    this.save();
    
    return this.richieste[idx];
  }
}

// Singleton instance
const db = new Database();

module.exports = db;
