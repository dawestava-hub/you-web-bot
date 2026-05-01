// normalize.js
'use strict';

/**
 * Convertit n'importe quel format (JID, LID, participant) en JID standard
 * @param {string} jid - Le JID à normaliser
 * @returns {string} JID normalisé au format numero@s.whatsapp.net
 */
function normalizeJid(jid) {
  if (!jid) return '';
  
  // Si c'est déjà un JID standard, on le retourne
  if (jid.includes('@s.whatsapp.net')) return jid;
  
  // Extraire le numéro (ignore @lid, @g.us, etc.)
  const number = String(jid).split('@')[0].split(':')[0];
  
  // Retourner au format standard
  return number ? `${number}@s.whatsapp.net` : '';
}

/**
 * Extrait le numéro d'un JID (sans le domaine)
 * @param {string} jid - Le JID
 * @returns {string} Le numéro uniquement
 */
function jidToNumber(jid) {
  if (!jid) return '';
  return String(jid).split('@')[0].split(':')[0];
}

/**
 * Crée un mapping entre LIDs et numéros pour un groupe
 * @param {Array} participants - Liste des participants du groupe
 * @returns {Object} Mapping avec différentes clés
 */
function createLidMapping(participants) {
  const mapping = {
    // Mapping LID -> { number, jid, lid, admin }
    lidToInfo: {},
    // Mapping numéro -> { number, jid, lid, admin }
    numberToInfo: {},
    // Mapping JID standard -> { number, jid, lid, admin }
    jidToInfo: {},
    // Liste des numéros admins
    adminNumbers: [],
    // Liste des LIDs admins
    adminLids: [],
    // Liste des JIDs admins
    adminJids: []
  };

  if (!participants || !Array.isArray(participants)) return mapping;

  for (const p of participants) {
    const lid = p.lid || '';
    const jid = p.jid || p.id || '';
    const number = jidToNumber(jid) || jidToNumber(lid);
    const admin = p.admin || null;

    const info = {
      number,
      jid: normalizeJid(jid),
      lid: lid,
      admin,
      raw: p
    };

    if (lid) mapping.lidToInfo[lid] = info;
    if (number) mapping.numberToInfo[number] = info;
    if (jid) mapping.jidToInfo[normalizeJid(jid)] = info;

    if (admin) {
      if (number) mapping.adminNumbers.push(number);
      if (lid) mapping.adminLids.push(lid);
      if (jid) mapping.adminJids.push(normalizeJid(jid));
    }
  }

  return mapping;
}

/**
 * Récupère metadata et retourne UNIQUEMENT des JIDs standards avec mapping LID
 * @returns { 
 *   metadata, 
 *   participants, 
 *   groupAdminsJid, 
 *   groupAdminsNum,
 *   groupAdminsLid,
 *   botJid, 
 *   botNum,
 *   botLid,
 *   lidMapping
 * }
 */
async function getGroupAdminsInfo(socket, groupJid) {
  if (!socket || !groupJid) throw new Error('socket et groupJid requis');

  const metadata = await socket.groupMetadata(groupJid);
  const participants = metadata?.participants || [];

  // Créer le mapping LID <-> Numéro
  const lidMapping = createLidMapping(participants);

  // Normaliser tous les participants
  const normalizedParticipants = participants.map(p => ({
    ...p,
    id: normalizeJid(p.id || p.jid || ''),
    jid: normalizeJid(p.jid || p.id || ''),
    lid: p.lid || '',
    number: jidToNumber(p.jid || p.id || p.lid || ''),
    admin: p.admin || null
  }));

  // Détecter et normaliser le JID du bot
  let botJid = null;
  let botNum = null;
  let botLid = null;
  
  try {
    if (socket.user) {
      // Récupérer les infos du bot
      botJid = normalizeJid(socket.user.jid || socket.user.id || '');
      botNum = jidToNumber(botJid);
      botLid = socket.user.lid ? socket.user.lid.split(':')[0] + '@lid' : null;

      // Chercher dans le mapping si on a le LID
      if (botLid && lidMapping.lidToInfo[botLid]) {
        const info = lidMapping.lidToInfo[botLid];
        botJid = info.jid;
        botNum = info.number;
      }
      
      // Chercher par numéro
      if (botNum && lidMapping.numberToInfo[botNum]) {
        const info = lidMapping.numberToInfo[botNum];
        botJid = info.jid;
        botLid = info.lid;
      }
    }
  } catch (e) { 
    console.error('[normalize] Error getting bot JID:', e);
  }

  return { 
    metadata, 
    participants: normalizedParticipants, 
    lidMapping,
    // Admins sous différents formats
    groupAdminsJid: lidMapping.adminJids,
    groupAdminsNum: lidMapping.adminNumbers,
    groupAdminsLid: lidMapping.adminLids,
    // Infos du bot
    botJid, 
    botNum,
    botLid,
    // Pour debug
    rawSocketUser: socket.user
  };
}

/**
 * Vérifie si un utilisateur est admin en utilisant le mapping
 * @param {Object} lidMapping - Le mapping créé par createLidMapping
 * @param {string} userIdentifier - JID, LID ou numéro
 * @returns {boolean}
 */
function isAdmin(lidMapping, userIdentifier) {
  if (!lidMapping || !userIdentifier) return false;

  const number = jidToNumber(userIdentifier);
  const jid = normalizeJid(userIdentifier);
  
  // Vérifier par numéro
  if (number && lidMapping.adminNumbers.includes(number)) return true;
  
  // Vérifier par JID
  if (jid && lidMapping.adminJids.includes(jid)) return true;
  
  // Vérifier par LID
  if (lidMapping.adminLids.includes(userIdentifier)) return true;
  
  // Vérifier dans le mapping inverse
  if (lidMapping.lidToInfo[userIdentifier]?.admin) return true;
  if (lidMapping.numberToInfo[number]?.admin) return true;
  if (lidMapping.jidToInfo[jid]?.admin) return true;

  return false;
}

module.exports = { 
  getGroupAdminsInfo, 
  jidToNumber, 
  normalizeJid,
  isAdmin,
  createLidMapping
};