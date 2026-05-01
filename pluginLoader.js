const fs = require('fs');
const path = require('path');

function loadPlugins() {
  const plugins = new Map();
  const pluginDir = path.join(__dirname, 'plugins');

  if (!fs.existsSync(pluginDir)) {
    console.warn('⚠️ Aucun dossier plugins trouvé');
    return plugins;
  }

  fs.readdirSync(pluginDir).forEach(file => {
    if (file.endsWith('.js')) {
      try {
        const plugin = require(path.join(pluginDir, file));
        if (plugin.name && plugin.execute) {
          const names = Array.isArray(plugin.name) ? plugin.name : [plugin.name];
          names.forEach(n => plugins.set(n.toLowerCase(), plugin));
          console.log(`✅ Plugin chargé: ${names.join(', ')}`);
        } else {
          console.warn(`⚠️ Plugin ${file} invalide (manque name ou execute)`);
        }
      } catch (err) {
        console.error(`❌ Erreur lors du chargement du plugin ${file}:`, err);
      }
    }
  });

  return plugins;
}

module.exports = { loadPlugins };