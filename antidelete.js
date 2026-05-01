// antidelete.js
const {
  saveAntideleteMessage,
  getAntideleteMessage,
  deleteAntideleteMessage,
  saveMediaToGridFS,
  getMediaFromGridFS,
  deleteMediaFromGridFS,
  setUserConfigInMongo,
  loadUserConfigFromMongo
} = require('./mongo_utils');

const MAX_INLINE_BYTES = 200 * 1024; // si < 200KB on peut stocker inline (optionnel), sinon GridFS
const MEDIA_FILENAME_FALLBACK = 'file.bin';

/**
 * Construit et sauvegarde le payload en DB.
 * Téléchargement média en GridFS si présent.
 */
async function buildAndSavePayload(sessionId, msg, downloadFn) {
  try {
    const sanitized = String(sessionId).replace(/[^0-9]/g, '');
    let cfg = await loadUserConfigFromMongo(sanitized) || {};
    if (typeof cfg.antidelete === 'undefined') {
      cfg.antidelete = false;
      await setUserConfigInMongo(sanitized, cfg);
    }
    if (!cfg.antidelete) return;

    const key = msg.key?.id;
    if (!key) return;

    const payload = {
      msgId: key,
      from: msg.key.remoteJid,
      sender: msg.key.participant || msg.key.remoteJid,
      timestamp: Date.now(),
      type: null,
      text: null,
      caption: null,
      mimetype: null,
      mediaRef: null,     // GridFS fileId if media saved
      inlineBase64: null  // small media inline (optional)
    };

    // Texte
    if (msg.message?.conversation) {
      payload.type = 'text';
      payload.text = msg.message.conversation;
    } else if (msg.message?.extendedTextMessage?.text) {
      payload.type = 'text';
      payload.text = msg.message.extendedTextMessage.text;
    } else {
      // Media types: image, video, audio, sticker, document, viewOnce, ephemeral, voice note
      // Baileys may wrap viewOnce in viewOnceMessage or message[Object.keys(...)[0]]
      const m = msg.message || {};
      // Helper to attempt download for a given node
      async function tryDownload(node, kind, filenameHint) {
        if (!node) return;
        payload.type = kind;
        payload.caption = node.caption || node?.fileName || '';
        payload.mimetype = node.mimetype || node?.mediaType || null;
        try {
          const stream = await downloadFn(node, kind === 'sticker' ? 'sticker' : kind);
          const chunks = [];
          for await (const c of stream) chunks.push(c);
          const buffer = Buffer.concat(chunks);
          if (!buffer || !buffer.length) return;
          // si petit, on peut stocker inline (optionnel)
          if (buffer.length <= MAX_INLINE_BYTES) {
            payload.inlineBase64 = buffer.toString('base64');
          } else {
            const filename = filenameHint || MEDIA_FILENAME_FALLBACK;
            const fileId = await saveMediaToGridFS(sanitized, key, buffer, filename, payload.mimetype || 'application/octet-stream');
            payload.mediaRef = fileId;
          }
        } catch (e) {
          console.warn('antidelete: media download failed', e);
        }
      }

      // imageMessage
      if (m.imageMessage) await tryDownload(m.imageMessage, 'image', m.imageMessage.fileName || 'image.jpg');
      else if (m.videoMessage) await tryDownload(m.videoMessage, 'video', m.videoMessage.fileName || 'video.mp4');
      else if (m.audioMessage) await tryDownload(m.audioMessage, 'audio', m.audioMessage.fileName || 'audio.ogg');
      else if (m.documentMessage) await tryDownload(m.documentMessage, 'document', m.documentMessage.fileName || 'file.bin');
      else if (m.stickerMessage) await tryDownload(m.stickerMessage, 'sticker', 'sticker.webp');
      else if (m.viewOnceMessage?.message) {
        // viewOnce wrapper: extract inner node
        const inner = m.viewOnceMessage.message;
        // try common inner types
        if (inner.imageMessage) await tryDownload(inner.imageMessage, 'image', 'viewonce.jpg');
        else if (inner.videoMessage) await tryDownload(inner.videoMessage, 'video', 'viewonce.mp4');
        else if (inner.stickerMessage) await tryDownload(inner.stickerMessage, 'sticker', 'viewonce.webp');
        else payload.type = 'view_once';
      } else if (m.protocolMessage && m.protocolMessage.type === 0) {
        // ephemeral or protocol messages - store metadata
        payload.type = 'protocol';
        payload.text = JSON.stringify(m.protocolMessage || {});
      } else {
        // fallback: try to detect any media node dynamically
        const keys = Object.keys(m);
        for (const k of keys) {
          if (k.endsWith('Message')) {
            await tryDownload(m[k], k.replace('Message','').toLowerCase(), m[k].fileName || MEDIA_FILENAME_FALLBACK);
            if (payload.type && (payload.mediaRef || payload.inlineBase64 || payload.text)) break;
          }
        }
        if (!payload.type) {
          payload.type = 'unknown';
          payload.text = JSON.stringify(Object.keys(m));
        }
      }
    }

    await saveAntideleteMessage(sanitized, key, payload);
  } catch (err) {
    console.error('buildAndSavePayload error', err);
  }
}

function saveIncomingMessageAsync(sessionId, msg, downloadFn) {
  buildAndSavePayload(sessionId, msg, downloadFn).catch(e => {
    console.error('saveIncomingMessageAsync error', e);
  });
}

async function handleRevocation(socket, messageKey) {
  try {
    const remoteJid = messageKey.remoteJid;
    const sanitized = String(remoteJid || '').replace(/[^0-9]/g, '');
    let cfg = await loadUserConfigFromMongo(sanitized) || {};
    if (typeof cfg.antidelete === 'undefined') {
      cfg.antidelete = false;
      await setUserConfigInMongo(sanitized, cfg);
    }
    if (!cfg.antidelete) return;

    const msgId = messageKey.id;
    if (!msgId) return;

    const saved = await getAntideleteMessage(sanitized, msgId);
    if (!saved) {
      await socket.sendMessage(remoteJid, { text: '*_🗑️ ᴜɴ ᴍᴇssᴀɢᴇ ᴀ ᴇ́ᴛᴇ́ sᴜᴘᴘʀɪᴍᴇ́ (ᴄᴏɴᴛᴇɴᴜ ɴᴏɴ sᴀᴜᴠᴇɢᴀʀᴅᴇ́)._*' });
      return;
    }

    const senderShort = (saved.sender || '').split('@')[0];

    // Priorité: inlineBase64 -> mediaRef (GridFS) -> text/caption
    if (saved.inlineBase64) {
      const buffer = Buffer.from(saved.inlineBase64, 'base64');
      await sendBufferByType(socket, remoteJid, saved, buffer, senderShort);
    } else if (saved.mediaRef) {
      const file = await getMediaFromGridFS(saved.mediaRef);
      if (file && file.buffer) {
        await sendBufferByType(socket, remoteJid, saved, file.buffer, senderShort, file.contentType, file.filename);
      } else {
        // fallback to text
        await socket.sendMessage(remoteJid, { text: `╭┄┄「 ⊹ ࣪ ˖🛡️ *ᴀɴᴛɪᴅᴇʟᴇᴛᴇ*⊹ ࣪ ˖ 」\n│. ˚˖𓍢ִ໋ᴍᴇssᴀɢᴇ sᴜᴘᴘʀɪᴍᴇ́ ᴘᴀʀ @${senderShort}.\n│. ˚˖𓍢ִ໋ ᴀɴᴛɪᴅᴇʟᴇᴛᴇ ᴇɴ ʟɪɢɴᴇ\n│. ˚˖𓍢ִ໋${saved.caption || saved.text || '[ᴄᴏɴᴛᴇɴᴜ ɴᴏɴ ᴅɪsᴘᴏɴɪʙʟᴇ]'}\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ᕗ`, mentions: [saved.sender] });
      }
      // delete media from GridFS after sending to free space
      if (saved.mediaRef) await deleteMediaFromGridFS(saved.mediaRef);
    } else {
      // no media stored
      await socket.sendMessage(remoteJid, { text: `╭┄┄「 ⊹ ࣪ ˖🛡️ *ᴀɴᴛɪᴅᴇʟᴇᴛᴇ*⊹ ࣪ ˖ 」\n│. ˚˖𓍢ִ໋ᴍᴇssᴀɢᴇ sᴜᴘᴘʀɪᴍᴇ́ ᴘᴀʀ @${senderShort}.\n│. ˚˖𓍢ִ໋ ᴀɴᴛɪᴅᴇʟᴇᴛᴇ ᴇɴ ʟɪɢɴᴇ\n│. ˚˖𓍢ִ໋${saved.caption || saved.text || '[ᴄᴏɴᴛᴇɴᴜ ɴᴏɴ ᴅɪsᴘᴏɴɪʙʟᴇ]'}\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ᕗ`, mentions: [saved.sender] });
    }

    // remove DB entry
    await deleteAntideleteMessage(sanitized, msgId);
  } catch (err) {
    console.error('handleRevocation error', err);
  }
}

// helper to send buffer according to saved.type
async function sendBufferByType(socket, remoteJid, saved, buffer, senderShort, contentType, filename) {
  try {
    if (saved.type === 'image') {
      await socket.sendMessage(remoteJid, { image: buffer, caption: `🛡️ ᴀɴᴛɪᴅᴇʟᴇᴛᴇ — ᴍᴇssᴀɢᴇ sᴜᴘᴘʀɪᴍᴇ́ ᴘᴀʀ @${senderShort}\n\n${saved.caption || ''}`, mentions: [saved.sender] });
    } else if (saved.type === 'video') {
      await socket.sendMessage(remoteJid, { video: buffer, caption: `🛡️ ᴀɴᴛɪᴅᴇʟᴇᴛᴇ — ᴍᴇssᴀɢᴇ sᴜᴘᴘʀɪᴍᴇ́ ᴘᴀʀ @${senderShort}\n\n${saved.caption || ''}`, mentions: [saved.sender] });
    } else if (saved.type === 'audio') {
      await socket.sendMessage(remoteJid, { audio: buffer, ptt: false, mimetype: contentType || saved.mimetype });
    } else if (saved.type === 'sticker') {
      await socket.sendMessage(remoteJid, { sticker: buffer });
    } else if (saved.type === 'document') {
      const ext = (saved.mimetype || '').split('/').pop() || (filename ? filename.split('.').pop() : 'bin');
      await socket.sendMessage(remoteJid, { document: buffer, fileName: `file.${ext}`, caption: `🛡️ ᴀɴᴛɪᴅᴇʟᴇᴛᴇ — ᴍᴇssᴀɢᴇ sᴜᴘᴘʀɪᴍᴇ́ ᴘᴀʀ @${senderShort}`, mentions: [saved.sender] });
    } else {
      // fallback: send as text with note
      await socket.sendMessage(remoteJid, { text: `╭┄┄「 ⊹ ࣪ ˖🛡️ *ᴀɴᴛɪᴅᴇʟᴇᴛᴇ*⊹ ࣪ ˖ 」\n│. ˚˖𓍢ִ໋ᴍᴇssᴀɢᴇ sᴜᴘᴘʀɪᴍᴇ́ ᴘᴀʀ @${senderShort}.\n│. ˚˖𓍢ִ໋ ᴀɴᴛɪᴅᴇʟᴇᴛᴇ ᴇɴ ʟɪɢɴᴇ\n│. ˚˖𓍢ִ໋${saved.caption || saved.text || '[ᴄᴏɴᴛᴇɴᴜ ɴᴏɴ ᴅɪsᴘᴏɴɪʙʟᴇ]'}\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ᕗ`, mentions: [saved.sender] });
    }
  } catch (e) {
    console.error('sendBufferByType error', e);
  }
}

module.exports = {
  saveIncomingMessageAsync,
  handleRevocation
};