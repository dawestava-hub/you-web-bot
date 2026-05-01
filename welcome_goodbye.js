// welcome_goodbye.js
// Gestion des messages de bienvenue et d'au revoir par groupe
// Thème stylé "BaseBot" — mentionne l'utilisateur et le nom du groupe
// Les messages par défaut sont construits dynamiquement (pas de placeholders dans les constantes)

// welcome_goodbye.js
// BaseBot Style - Avec Photo Profil

const groups = {};

/**
 * CONFIG PAR GROUPE
 */
function ensureGroup(from) {
  if (!groups[from]) {
    groups[from] = {
      welcome: true,   // active welcome
      goodbye: true,   // active goodbye
      welcomeMsg: null,
      goodbyeMsg: null
    };
  }
}

/**
 * RECUP PP UTILISATEUR
 */
async function getUserProfilePic(sock, jid) {
  try {
    return await sock.profilePictureUrl(jid, "image");
  } catch {
    return "https://i.ibb.co/0jqHpnp/default.png";
  }
}

/**
 * MESSAGE WELCOME
 */
function buildDefaultWelcome(userName, groupName, members) {
  return `
╭┄┄「 ⊹ ࣪˖ *𝐖𝐄𝐋𝐂𝐎𝐌𝐄* ⊹ ࣪˖ 」
│. ˚˖𓍢ִ໋ ᴡᴇʟᴄᴏᴍᴇ @${userName}
│. ˚˖𓍢ִ໋ ɢʀᴏᴜᴘ: *${groupName}*
│. ˚˖𓍢ִ໋ ᴡᴇʟᴄᴏᴍᴇ ᴅᴇᴀʀ 🌟
│. ˚˖𓍢ִ໋ ʙᴏᴛ ᴏɴʟɪɴᴇ 🤖
│. ˚˖𓍢ִ໋ ᴍᴇᴍʙᴇʀs: ${members}
╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ᕗ
> *MADE IN BY YOU TECHX 🌙*
`;
}

/**
 * MESSAGE GOODBYE
 */
function buildDefaultGoodbye(userName, groupName, members) {
  return `
╭┄┄「 ⊹ ࣪˖ *𝐅𝐀𝐑𝐄𝐖𝐄𝐋𝐋* ⊹ ࣪˖ 」
│. ˚˖𓍢ִ໋ ɢᴏᴏᴅʙʏᴇ @${userName}
│. ˚˖𓍢ִ໋ ɢʀᴏᴜᴘ: *${groupName}*
│. ˚˖𓍢ִ໋ ɢᴏᴏᴅʙʏᴇ ᴅᴇᴀʀ 🌟
│. ˚˖𓍢ִ໋ ʙᴏᴛ ᴏɴʟɪɴᴇ 🤖
│. ˚˖𓍢ִ໋ ᴍᴇᴍʙᴇʀs ʀᴇᴍᴀɪɴɪɴɢ: ${members}
╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ᕗ
> *MADE IN BY YOU TECHX 🌙*
`;
}

/**
 * EVENT PRINCIPAL
 */
function welcomeHandler(sock) {

  sock.ev.on("group-participants.update", async (update) => {
    try {
      const { id, participants, action } = update;

      ensureGroup(id);

      let metadata = await sock.groupMetadata(id);
      let groupName = metadata.subject;
      let members = metadata.participants.length;

      for (let user of participants) {
        let userName = user.split("@")[0];

        const pp = await getUserProfilePic(sock, user);

        // ===== WELCOME =====
        if (action === "add" && groups[id].welcome) {

          let text = groups[id].welcomeMsg
            ? groups[id].welcomeMsg
                .replace("{user}", `@${userName}`)
                .replace("{userName}", userName)
                .replace("{group}", groupName)
            : buildDefaultWelcome(userName, groupName, members);

          await sock.sendMessage(id, {
            image: { url: pp },
            caption: text,
            mentions: [user]
          });
        }

        // ===== GOODBYE =====
        if (action === "remove" && groups[id].goodbye) {

          let text = groups[id].goodbyeMsg
            ? groups[id].goodbyeMsg
                .replace("{user}", `@${userName}`)
                .replace("{userName}", userName)
                .replace("{group}", groupName)
            : buildDefaultGoodbye(userName, groupName, members);

          await sock.sendMessage(id, {
            image: { url: pp },
            caption: text,
            mentions: [user]
          });
        }
      }

    } catch (err) {
      console.log("Erreur welcome/goodbye:", err);
    }
  });
}

/**
 * Toggle functions
 */
function toggleWelcome(from, state) {
  ensureGroup(from);
  groups[from].welcome = !!state;
}

function toggleGoodbye(from, state) {
  ensureGroup(from);
  groups[from].goodbye = !!state;
}

function isWelcomeEnabled(from) {
  return !!(groups[from] && groups[from].welcome);
}

function isGoodbyeEnabled(from) {
  return !!(groups[from] && groups[from].goodbye);
}

/**
 * Personnaliser les messages (optionnel)
 * Les templates personnalisés peuvent contenir {user}, {userName}, {group}
 * Exemple: "Salut {user} ! Bienvenue dans {group}."
 */
function setWelcomeTemplate(from, template) {
  ensureGroup(from);
  if (typeof template === 'string' && template.trim()) groups[from].welcomeMsg = template.trim();
}

function setGoodbyeTemplate(from, template) {
  ensureGroup(from);
  if (typeof template === 'string' && template.trim()) groups[from].goodbyeMsg = template.trim();
}

/**
 * Remplace les placeholders dans un template string (si template custom fourni)
 */
function renderTemplateString(template, vars = {}) {
  return template
    .replace(/{user}/g, vars.user || '')
    .replace(/{userName}/g, vars.userName || '')
    .replace(/{group}/g, vars.group || '');
}

/**
 * Handler pour les événements de participants (add/remove)
 * update: objet Baileys group-participants.update
 */
async function handleParticipantUpdate(socket, from, update) {
  try {
    if (!update || !update.action) return;

    // Normaliser participants (compatibilité versions)
    const participants = Array.isArray(update.participants)
      ? update.participants
      : (update.participant ? [update.participant] : []);

    if (!participants.length) return;

    // Récupérer le nom du groupe (subject) si possible
    let groupName = '';
    try {
      const meta = await socket.groupMetadata(from);
      groupName = meta?.subject || from.split('@')[0];
    } catch (e) {
      groupName = from.split('@')[0];
    }

    for (const participant of participants) {
      const userJid = participant;
      const userName = (participant || '').split('@')[0];

      // JOIN
      if (update.action === 'add' && isWelcomeEnabled(from)) {
        ensureGroup(from);

        // Si template custom string défini -> render, sinon utiliser builder par défaut
        const tpl = groups[from].welcomeMsg;
        const text = tpl
          ? renderTemplateString(tpl, { user: `@${userName}`, userName, group: groupName })
          : buildDefaultWelcome(userJid, userName, groupName);

        await socket.sendMessage(from, {
          text,
          mentions: [userJid]
        });
      }

      // LEAVE / REMOVE
      if ((update.action === 'remove' || update.action === 'leave') && isGoodbyeEnabled(from)) {
        ensureGroup(from);

        const tpl = groups[from].goodbyeMsg;
        const text = tpl
          ? renderTemplateString(tpl, { user: `@${userName}`, userName, group: groupName })
          : buildDefaultGoodbye(userJid, userName, groupName);

        await socket.sendMessage(from, {
          text,
          mentions: [userJid]
        });
      }
    }
  } catch (err) {
    console.error('WELCOME_GOODBYE HANDLER ERROR', err);
  }
}

module.exports = {
  toggleWelcome,
  toggleGoodbye,
  isWelcomeEnabled,
  isGoodbyeEnabled,
  setWelcomeTemplate,
  setGoodbyeTemplate,
  handleParticipantUpdate
};