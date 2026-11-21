// Lit le localStorage enregistré dans un fichier d'état Playwright, sans navigateur.
const fs = require('fs');
module.exports = (f) => { const s = JSON.parse(fs.readFileSync(f, 'utf8')); const ls = Object.fromEntries(s.origins.flatMap((o) => o.localStorage.map((x) => [x.name, x.value]))); return { ls, v3: JSON.parse(ls['releve.v3'] || 'null') }; };
