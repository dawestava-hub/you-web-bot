// s-utils.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

/* ---------- Helpers internes ---------- */
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&apos;',
    '"': '&quot;'
  })[c]);
}

function makeTextSVG(width, author, title) {
  const padding = 16;
  const fontSizeTitle = Math.max(28, Math.floor(width / 14));
  const fontSizeAuthor = Math.max(18, Math.floor(width / 22));
  const bgHeight = fontSizeTitle + fontSizeAuthor + padding * 2;

  const svg = `
  <svg width="${width}" height="${bgHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="rgba(0,0,0,0.6)"/>
        <stop offset="1" stop-color="rgba(0,0,0,0.35)"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${width}" height="${bgHeight}" fill="url(#g)"/>
    <text x="${padding}" y="${padding + fontSizeTitle}" font-family="sans-serif" font-size="${fontSizeTitle}" fill="#ffffff" font-weight="700">${escapeXml(title)}</text>
    <text x="${padding}" y="${padding + fontSizeTitle + fontSizeAuthor + 4}" font-family="sans-serif" font-size="${fontSizeAuthor}" fill="#ffffff" opacity="0.9">${escapeXml(author)}</text>
  </svg>
  `;
  return Buffer.from(svg);
}

/* ---------- Conversion image statique -> webp sticker ---------- */
async function imageToStickerStatic(buffer, author = '', title = '') {
  // redimensionne en 512x512 en conservant ratio et fond transparent
  const base = await sharp(buffer)
    .rotate()
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toBuffer();

  if (!author && !title) return base;

  const svg = makeTextSVG(512, author || '', title || '');
  const composed = await sharp(base)
    .composite([{ input: svg, gravity: 'south' }])
    .webp({ quality: 90 })
    .toBuffer();

  return composed;
}

/* ---------- Conversion média animé (gif/mp4/...) -> webp animé via ffmpeg ---------- */
async function mediaToStickerAnimated(buffer, mime = '', author = '', title = '') {
  const tmpIn = path.join(os.tmpdir(), `in_${Date.now()}`);
  const tmpOut = path.join(os.tmpdir(), `out_${Date.now()}.webp`);
  await writeFile(tmpIn, buffer);

  // drawtext nécessite ffmpeg compilé avec libfreetype et un chemin de police valide.
  // Ajuste fontfile si nécessaire sur ton serveur.
  const fontfile = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

  // Construire filtre drawtext si author/title fournis
  let vf = '';
  if (author || title) {
    const safeTitle = (title || '').replace(/:/g, '\\:').replace(/'/g, "\\'");
    const safeAuthor = (author || '').replace(/:/g, '\\:').replace(/'/g, "\\'");
    vf = `drawtext=fontfile=${fontfile}:text='${safeTitle}':fontcolor=white:fontsize=48:box=1:boxcolor=black@0.5:boxborderw=5:x=10:y=h-110,` +
         `drawtext=fontfile=${fontfile}:text='${safeAuthor}':fontcolor=white:fontsize=32:box=1:boxcolor=black@0.5:boxborderw=5:x=10:y=h-50`;
  } else {
    vf = 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000';
  }

  await new Promise((resolve, reject) => {
    ffmpeg(tmpIn)
      .outputOptions([
        '-vcodec', 'libwebp',
        '-lossless', '0',
        '-qscale', '75',
        '-preset', 'default',
        '-loop', '0',
        '-an',
        '-vsync', '0',
        '-s', '512:512'
      ])
      .videoFilters(vf)
      .on('end', () => resolve())
      .on('error', err => reject(err))
      .save(tmpOut);
  });

  const outBuffer = await fs.promises.readFile(tmpOut);
  await Promise.all([unlink(tmpIn).catch(()=>{}), unlink(tmpOut).catch(()=>{})]);
  return outBuffer;
}

/* ---------- Fonction principale : créer sticker à partir d'un objet media ---------- */
/**
 * media: { buffer: Buffer, mime: string, fileName?: string }
 * retourne: { buffer: Buffer, animated: boolean }
 */
async function createStickerFromMedia(media, author = '', title = '') {
  if (!media || !media.buffer) throw new Error('Media buffer manquant');

  const mime = (media.mime || '').toLowerCase();

  // image statique (jpeg/png/webp non animé)
  if (mime.startsWith('image/') && !mime.includes('gif') && !mime.includes('webp')) {
    const webp = await imageToStickerStatic(media.buffer, author, title);
    return { buffer: webp, animated: false };
  }

  // déjà webp (sticker statique ou animé) : renvoyer tel quel
  if (mime === 'image/webp') {
    // On renvoie tel quel; si on veut ajouter du texte il faudrait reconvertir
    return { buffer: media.buffer, animated: false };
  }

  // GIF ou vidéo -> sticker animé
  if (mime.startsWith('video/') || mime.includes('gif') || mime === 'image/gif') {
    const webpAnim = await mediaToStickerAnimated(media.buffer, mime, author, title);
    return { buffer: webpAnim, animated: true };
  }

  // document contenant image/vidéo (ex: documentMessage)
  if (media.fileName && /\.(jpe?g|png|gif|mp4|webm|webp)$/i.test(media.fileName)) {
    const ext = path.extname(media.fileName).slice(1).toLowerCase();
    if (['mp4','webm','gif'].includes(ext)) {
      const webpAnim = await mediaToStickerAnimated(media.buffer, mime, author, title);
      return { buffer: webpAnim, animated: true };
    } else {
      const webp = await imageToStickerStatic(media.buffer, author, title);
      return { buffer: webp, animated: false };
    }
  }

  throw new Error('ғᴏʀᴍᴀᴛ ɴᴏɴ sᴜᴘᴘᴏʀᴛᴇ́ ᴘᴏᴜʀ ʟᴀ ᴄᴏɴᴠᴇʀsɪᴏɴ ᴇɴ sᴛɪᴄᴋᴇʀ');
}

/* ---------- Envoi du sticker via Baileys/BlazeXBaileys ---------- */
async function sendSticker(socket, jid, stickerBuffer, quoted = null) {
  // BlazeXBaileys accepte { sticker: Buffer } ou { sticker: Buffer, mimetype: 'image/webp' }
  return socket.sendMessage(jid, { sticker: stickerBuffer, mimetype: 'image/webp' }, { quoted });
}

module.exports = {
  imageToStickerStatic,
  mediaToStickerAnimated,
  createStickerFromMedia,
  sendSticker
};