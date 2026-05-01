// routes.js - Toutes les routes API et pages du dashboard
const express = require('express');
const path = require('path');
const router = express.Router();

// ========== 1. D'ABORD LES ROUTES API (DOIVENT ÊTRE EN PREMIER) ==========

// API NEWSLETTERS
router.post('/newsletter/add', async (req, res) => {
  try {
    const { jid, emojis } = req.body;
    if (!jid) return res.status(400).json({ error: 'jid required' });
    if (!jid.endsWith('@newsletter')) return res.status(400).json({ error: 'Invalid newsletter jid' });
    
    console.log('Newsletter add:', { jid, emojis });
    res.status(200).json({ status: 'ok', jid });
  } catch (e) { 
    res.status(500).json({ error: e.message || e }); 
  }
});

router.post('/newsletter/remove', async (req, res) => {
  try {
    const { jid } = req.body;
    if (!jid) return res.status(400).json({ error: 'jid required' });
    
    console.log('Newsletter remove:', jid);
    res.status(200).json({ status: 'ok', jid });
  } catch (e) { 
    res.status(500).json({ error: e.message || e }); 
  }
});

router.get('/newsletter/list', async (req, res) => {
  try {
    const list = []; 
    res.status(200).json({ status: 'ok', channels: list });
  } catch (e) { 
    res.status(500).json({ error: e.message || e }); 
  }
});

// API ADMINS
router.post('/admin/add', async (req, res) => {
  try {
    const { jid } = req.body;
    if (!jid) return res.status(400).json({ error: 'jid required' });
    
    console.log('Admin add:', jid);
    res.status(200).json({ status: 'ok', jid });
  } catch (e) { 
    res.status(500).json({ error: e.message || e }); 
  }
});

router.post('/admin/remove', async (req, res) => {
  try {
    const { jid } = req.body;
    if (!jid) return res.status(400).json({ error: 'jid required' });
    
    console.log('Admin remove:', jid);
    res.status(200).json({ status: 'ok', jid });
  } catch (e) { 
    res.status(500).json({ error: e.message || e }); 
  }
});

router.get('/admin/list', async (req, res) => {
  try {
    const list = [];
    res.status(200).json({ status: 'ok', admins: list });
  } catch (e) { 
    res.status(500).json({ error: e.message || e }); 
  }
});

// API SESSIONS
router.get('/connect', async (req, res) => {
  const { number } = req.query;
  if (!number) return res.status(400).json({ error: 'Number parameter is required' });
  
  res.status(200).json({ status: 'connection_initiated', number });
});

router.get('/active', (req, res) => {
  res.status(200).json({ 
    botName: 'BASEBOT-MD', 
    count: 0, 
    numbers: [], 
    timestamp: new Date().toISOString() 
  });
});

router.get('/ping', (req, res) => {
  res.status(200).json({ 
    status: 'active', 
    botName: 'BASEBOT-MD', 
    message: 'BASEBOT-MD', 
    activeSessions: 0 
  });
});

router.get('/connect-all', async (req, res) => {
  try {
    res.status(200).json({ status: 'success', connections: [] });
  } catch (error) { 
    res.status(500).json({ error: 'Failed to connect all bots' }); 
  }
});

router.get('/reconnect', async (req, res) => {
  try {
    res.status(200).json({ status: 'success', connections: [] });
  } catch (error) { 
    res.status(500).json({ error: 'Failed to reconnect bots' }); 
  }
});

router.get('/update-config', async (req, res) => {
  const { number, config } = req.query;
  if (!number || !config) {
    return res.status(400).json({ error: 'Number and config are required' });
  }
  
  try {
    JSON.parse(config);
    res.status(200).json({ status: 'otp_sent', message: 'OTP sent to your number' });
  } catch (error) { 
    return res.status(400).json({ error: 'Invalid config format' }); 
  }
});

router.get('/verify-otp', async (req, res) => {
  const { number, otp } = req.query;
  if (!number || !otp) return res.status(400).json({ error: 'Number and OTP are required' });
  
  res.status(200).json({ status: 'success', message: 'Config updated successfully' });
});

router.get('/getabout', async (req, res) => {
  const { number, target } = req.query;
  if (!number || !target) {
    return res.status(400).json({ error: 'Number and target number are required' });
  }
  
  res.status(200).json({ 
    status: 'success', 
    number: target, 
    about: 'Example about text', 
    setAt: new Date().toISOString() 
  });
});

// API POUR LE DASHBOARD
router.get('/api/sessions', async (req, res) => {
  try {
    console.log('✅ API /api/sessions appelée');
    const sessions = [];
    res.json({ ok: true, sessions });
  } catch (err) {
    console.error('❌ Erreur API /api/sessions:', err);
    res.status(500).json({ ok: false, error: err.message || err });
  }
});

router.get('/api/active', async (req, res) => {
  try {
    console.log('✅ API /api/active appelée');
    res.json({ ok: true, active: [], count: 0 });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || err });
  }
});

router.post('/api/session/delete', async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).json({ ok: false, error: 'number required' });
    
    const sanitized = ('' + number).replace(/[^0-9]/g, '');
    console.log(`Suppression de la session ${sanitized}`);
    
    res.json({ ok: true, message: `Session ${sanitized} removed` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || err });
  }
});

router.get('/api/newsletters', async (req, res) => {
  try {
    console.log('✅ API /api/newsletters appelée');
    res.json({ ok: true, list: [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || err });
  }
});

router.get('/api/admins', async (req, res) => {
  try {
    console.log('✅ API /api/admins appelée');
    res.json({ ok: true, list: [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || err });
  }
});

router.get('/api/session/config', async (req, res) => {
  const { number } = req.query;
  if (!number) return res.status(400).json({ ok: false, error: 'Number required' });
  
  console.log('✅ API /api/session/config appelée pour:', number);
  res.json({ ok: true, config: {} });
});

// ========== 2. ENSUITE LES FICHIERS STATIQUES ==========
router.use('/dashboard/static', express.static(path.join(process.cwd(), 'dashboard_static')));

// ========== 3. ENFIN LES PAGES HTML ==========
router.get('/dashboard', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dashboard_static', 'index.html'));
});

router.get('/dashboard/newsletters', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dashboard_static', 'newsletters.html'));
});

router.get('/dashboard/newsletter-add', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dashboard_static', 'newsletter-add.html'));
});

router.get('/dashboard/newsletter-remove', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dashboard_static', 'newsletter-remove.html'));
});

router.get('/dashboard/admins', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dashboard_static', 'admins.html'));
});

router.get('/dashboard/admin-add', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dashboard_static', 'admin-add.html'));
});

router.get('/dashboard/admin-remove', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dashboard_static', 'admin-remove.html'));
});

router.get('/dashboard/sessions', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dashboard_static', 'sessions.html'));
});

router.get('/dashboard/session-connect', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dashboard_static', 'session-connect.html'));
});

router.get('/dashboard/session-config', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dashboard_static', 'session-config.html'));
});

router.get('/dashboard/session-about', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dashboard_static', 'session-about.html'));
});

router.get('/dashboard/active', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dashboard_static', 'active.html'));
});

router.get('/dashboard/connect-all', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dashboard_static', 'connect-all.html'));
});

router.get('/dashboard/reconnect', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dashboard_static', 'reconnect.html'));
});

module.exports = router;