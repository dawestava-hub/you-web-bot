// antidelete_cleaner.js
// Démarre un cleaner global qui supprime les messages antidelete
// plus vieux que CLEAN_INTERVAL_MS pour chaque session activée.
// Appelle startAntideleteCleaner() une seule fois au boot (après initMongo()).

const { configsCol, clearOldMessages, initMongo } = require('./mongo_utils');

const CLEAN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
let _antideleteCleanerStarted = false;

/**
 * startAntideleteCleaner
 * - Idempotent : ne démarre qu'un seul interval même si appelé plusieurs fois.
 * - Doit être appelé après initMongo() et après que le socket soit prêt.
 */
async function startAntideleteCleaner() {
  if (_antideleteCleanerStarted) return;
  _antideleteCleanerStarted = true;

  try {
    // S'assure que Mongo est initialisé (initMongo est idempotent)
    await initMongo();

    // Lancer l'intervalle
    setInterval(async () => {
      try {
        // Récupère toutes les sessions qui ont antidelete activé
        const cursor = configsCol.find({ 'config.antidelete': true });
        const docs = await cursor.toArray();
        for (const doc of docs) {
          try {
            const sessionId = String(doc.number);
            // Supprime les messages plus vieux que CLEAN_INTERVAL_MS pour cette session
            await clearOldMessages(sessionId, CLEAN_INTERVAL_MS);
          } catch (inner) {
            console.error('antidelete cleaner: failed clearing for session', doc?.number, inner);
          }
        }
      } catch (e) {
        console.error('antidelete cleaner error', e);
      }
    }, CLEAN_INTERVAL_MS);

    console.log('Antidelete cleaner started (interval:', CLEAN_INTERVAL_MS, 'ms)');
  } catch (e) {
    console.error('startAntideleteCleaner error', e);
    _antideleteCleanerStarted = false;
    throw e;
  }
}

module.exports = {
  startAntideleteCleaner
};