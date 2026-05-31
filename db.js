const db = require('./database');

// Wrapper functions for backward compatibility
function createCheckin(data) {
  return db.insertCheckin(data);
}

function getCheckins(filters = {}) {
  return db.selectCheckins(filters);
}

function getStats(comuneId = '') {
  return db.selectStats(comuneId);
}

module.exports = { createCheckin, getCheckins, getStats };
