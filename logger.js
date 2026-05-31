const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');
ensureLogDir();

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogFile() {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `app-${date}.log`);
}

function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
}

function writeLog(level, message, meta = {}) {
  const logLine = formatLog(level, message, meta);
  const logFile = getLogFile();
  fs.appendFileSync(logFile, logLine, 'utf8');
  
  // Also output to console for development
  console.log(`[${level.toUpperCase()}] ${message}`, meta);
}

const logger = {
  info: (message, meta) => writeLog('info', message, meta),
  error: (message, meta) => writeLog('error', message, meta),
  warn: (message, meta) => writeLog('warn', message, meta),
  debug: (message, meta) => writeLog('debug', message, meta),
};

module.exports = logger;
