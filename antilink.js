// antilink.js
// Gestion du mode Anti-Link par groupe (robuste)

const groups = {}; // { "<groupJid>": { enabled: true/false, warns: { "<userJid>": count } } }

// Regex améliorée pour détecter liens
const LINK_REGEX = /(?:https?:\/\/|www\.|t\.co\/|bit\.ly\/|(?:[a-z0-9-]+\.)+[a-z]{2,})([^\s]*)/i;

function containsLink(text) {
  if (!text) return false;
  // retirer balises markdown [text](url) pour détecter l'URL à l'intérieur
  const cleaned = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, '$2');
  // retirer chevrons <...>
  const noAngles = cleaned.replace(/<([^>]+)>/g, '$1');
  return LINK_REGEX.test(noAngles);
}

async function handleAntiLink(socket, msg, from, normalizedBody) {
  // normalizedBody: facultatif, si fourni utilise-le (body extrait dans messages.upsert)
  const group = groups[from];
  if (!group || !group.enabled) return false;

  // déterminer texte à analyser : prefer normalizedBody sinon extraire du msg
  const text = (typeof normalizedBody === 'string' && normalizedBody.trim())
    ? normalizedBody.trim()
    : (msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || msg?.message?.imageMessage?.caption || msg?.message?.videoMessage?.caption || '');

  if (!text) return false;

  const sender = msg.key.participant || msg.key.remoteJid || msg.key.fromMe && socket.user?.id;

  if (!containsLink(text)) return false;

  // Supprimer le message (essaie plusieurs formes)
  try {
    await socket.sendMessage(from, { delete: msg.key });
  } catch (e) {
    console.error('ANTILINK DELETE ERROR', e);
  }

  // init warns
  if (!group.warns[sender]) group.warns[sender] = 0;
  group.warns[sender] += 1;

  // avertir (mention)
  try {
    await socket.sendMessage(from, {
      text: `⚠️ @${(sender||'').split('@')[0]} ʟᴇs ʟɪᴇɴs sᴏɴᴛ ɪɴᴛᴇʀᴅɪᴛs.\nᴀᴠᴇʀᴛɪssᴇᴍᴇɴᴛ ${group.warns[sender]}/3`,
      mentions: [sender]
    });
  } catch (e) {
    console.error('ANTILINK WARN SEND ERROR', e);
  }

  // kick après 3 avertissements (vérifier que le bot est admin)
  if (group.warns[sender] >= 3) {
    try {
      await socket.groupParticipantsUpdate(from, [sender], 'remove');
      await socket.sendMessage(from, {
        text: `🚫 @${(sender||'').split('@')[0]} ᴀ ᴇ́ᴛᴇ́ ᴇxᴄʟᴜ ᴘᴏᴜʀ ᴀᴠᴏɪʀ ᴘᴀʀᴛᴀɢᴇ́ ᴅᴇs ʟɪᴇɴs.`,
        mentions: [sender]
      });
      delete group.warns[sender];
    } catch (e) {
      console.error('ANTILINK KICK ERROR', e);
      // si kick échoue, on notifie l'admin
      try {
        await socket.sendMessage(from, { text: `❌ ɪᴍᴘᴏssɪʙʟᴇ ᴅ'ᴇxᴄʟᴜʀᴇ @${(sender||'').split('@')[0]}. ᴠᴇ́ʀɪғɪᴇ ǫᴜᴇ ʟᴇ ʙᴏᴛ ᴇsᴛ ᴀᴅᴍɪɴ.`, mentions: [sender] });
      } catch (_) {}
    }
  }

  return true;
}

function toggleAntiLink(from, state) {
  if (!groups[from]) groups[from] = { enabled: false, warns: {} };
  groups[from].enabled = !!state;
  if (!groups[from].warns) groups[from].warns = {};
}

function isAntiLinkEnabled(from) {
  return !!(groups[from] && groups[from].enabled);
}

module.exports = { handleAntiLink, toggleAntiLink, isAntiLinkEnabled, containsLink };