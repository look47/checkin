const db = require('./database');
const SCADENZA_MINUTI = 15;

// Wrapper functions for backward compatibility
function createRichiesta(data) {
  return db.insertRichiesta(data);
}

function getByToken(token) {
  return db.selectRichiestaByToken(token);
}

function getRichieste(filters = {}) {
  return db.selectRichieste(filters);
}

function completaRichiesta(token, checkinId) {
  return db.updateRichiestaCompletata(token, checkinId);
}

function validaRichiestaPerCheckin(token) {
  const r = getByToken(token);
  if (!r) return { ok: false, error: 'Richiesta check-in non trovata' };
  if (r.stato === 'completata') return { ok: false, error: 'Richiesta check-in già completata' };
  if (r.stato === 'scaduta') return { ok: false, error: 'Tempo scaduto: dovevi completare il check-in entro 15 minuti' };
  return { ok: true, richiesta: r };
}

module.exports = {
  SCADENZA_MINUTI,
  createRichiesta,
  getByToken,
  getRichieste,
  completaRichiesta,
  validaRichiestaPerCheckin,
};
