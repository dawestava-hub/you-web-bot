// sessionConfig.js (placer à la racine du projet)
const BOT_NAME_FANCY = 'YOU WEB BOT';

const DEFAULT_SESSION_CONFIG = {
  botName: BOT_NAME_FANCY,
  AUTO_VIEW_STATUS: true,
  AUTO_LIKE_STATUS: true,
  AUTO_RECORDING: false,
  AUTO_LIKE_EMOJI: ['🐉','🔥','💀','👑','💪','😎','🥶','⚡','🩸','❤️'],
  PREFIX: '.'
};

// clés autorisées à modifier via setconfig
const ALLOWED_KEYS = Object.keys(DEFAULT_SESSION_CONFIG).concat(['custom']);

function sanitizeSessionKey(numberOrFrom) {
  const s = String(numberOrFrom || '').replace(/[^0-9]/g, '');
  return s.length ? s : '';
}

function parseValueByType(raw) {
  if (raw === undefined || raw === null) return raw;
  const s = String(raw).trim();

  // JSON explicite
  if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
    try { return JSON.parse(s); } catch (e) { /* fallback */ }
  }

  // bool explicite
  if (/^(true|on|1)$/i.test(s)) return true;
  if (/^(false|off|0)$/i.test(s)) return false;

  // array comma separated
  if (s.includes(',')) {
    return s.split(',').map(x => x.trim()).filter(x => x.length).slice(0, 50);
  }

  // number (préserver codes commençant par 0)
  if (!isNaN(s) && s !== '') {
    if (/^0\d+$/i.test(s)) return s;
    return s.includes('.') ? parseFloat(s) : parseInt(s, 10);
  }

  // string fallback (limiter longueur)
  return s.length > 1000 ? s.slice(0, 1000) : s;
}

function formatValueForDisplay(v) {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v === null || v === undefined) return '';
  return String(v);
}

module.exports = {
  BOT_NAME_FANCY,
  DEFAULT_SESSION_CONFIG,
  ALLOWED_KEYS,
  sanitizeSessionKey,
  parseValueByType,
  formatValueForDisplay
};