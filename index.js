const express = require('express');
const path = require('path');
const bodyParser = require("body-parser");
const app = express();
const PORT = process.env.PORT || 2001;

let code = require('./pair'); 

require('events').EventEmitter.defaultMaxListeners = 500;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/code', code);

// Page de pairing
app.get('/pair', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'pair.html'));
});

// Page de suppression
app.get('/delete', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'delete.html'));
});

// Page principale
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'main.html'));
});

// ===== SERVIR LES FICHIERS STATIQUES DU DASHBOARD =====
// IMPORTANT: Cette ligne doit être AVANT vos routes /dashboard
app.use('/dashboard', express.static(path.join(process.cwd(), 'dashboard_static')));

// ===== VOS AUTRES ROUTES API =====
// Middleware d'authentification
function requireAdminPass(req, res, next) {
  const pass = req.headers['x-admin-pass'] || req.body?.adminPass;
  if (pass === 'adminowner') return next();
  return res.status(401).json({ ok: false, error: 'Unauthorized' });
}

// Route de suppression admin
app.post('/api/session/delete', requireAdminPass, async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).json({ ok: false, error: 'number required' });

    const sanitized = ('' + number).replace(/[^0-9]/g, '');
    console.log(`Suppression de la session ${sanitized}`);
    return res.json({ ok: true, message: `Session ${sanitized} removed` });
  } catch (err) {
    console.error('API /api/session/delete error', err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`
╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ᕗ
│  𝐘𝐎𝐔 𝐖𝐄𝐁 𝐁𝐎𝐓 𝐃𝐀𝐒𝐇𝐁𝐎𝐎𝐑𝐃 𝐒𝐄𝐑𝐕𝐄𝐑      
│
│  Server running on:                
│  http://localhost:${PORT}                
│                                    
│  Dashboard:                        
│  http://localhost:${PORT}/dashboard     
│  http://localhost:${PORT}/dashboard/sessions.html
│  http://localhost:${PORT}/dashboard/admins.html
╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ᕗ
`);
});

module.exports = app;