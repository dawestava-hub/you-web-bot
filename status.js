// status.js
const { generateWAMessageContent, generateWAMessageFromContent } = require("@rexxhayanasi/elaina-baileys");
const crypto = require("crypto");

async function groupStatus(socket, jid, content) {
  const { backgroundColor } = content;
  delete content.backgroundColor;

  const inside = await generateWAMessageContent(content, {
    upload: socket.waUploadToServer,
    backgroundColor
  });

  const messageSecret = crypto.randomBytes(32);

  const m = generateWAMessageFromContent(
    jid,
    {
      messageContextInfo: { messageSecret },
      groupStatusMessageV2: {
        message: {
          ...inside,
          messageContextInfo: { messageSecret }
        }
      }
    },
    {}
  );

  await socket.relayMessage(jid, m.message, { messageId: m.key.id });
  return m;
}

async function buildStatusContent(m, socket, prefix, command) {
  const quoted = m.quoted ? m.quoted : m;
  const mime = (quoted.msg || quoted).mimetype || "";
  const textToParse = m.text || m.body || "";
  const caption = textToParse.replace(new RegExp(`^\\${prefix}${command}\\s*`, "i"), "").trim();

  if (/image/.test(mime)) {
    const buffer = await quoted.download();
    return { image: buffer, caption };
  } else if (/video/.test(mime)) {
    const buffer = await quoted.download();
    return { video: buffer, caption };
  } else if (/audio/.test(mime)) {
    const buffer = await quoted.download();
    return { audio: buffer, mimetype: "audio/mp4" };
  } else if (caption) {
    return { text: caption };
  } else {
    throw new Error("no_content");
  }
}

module.exports = { groupStatus, buildStatusContent };