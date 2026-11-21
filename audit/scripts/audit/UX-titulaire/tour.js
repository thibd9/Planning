// Fait le tour de toutes les rubriques du titulaire à une taille donnée : captures par défilement + mesures.
// TAILLE=d|p|t|s|o  ROLE=0  VUES=tableau,moi,...
const ux = require('./ux');
const fs = require('fs');
const T = process.env.TAILLE || 'd';
const CONF = { d: { w: 1440, h: 900, plie: true }, p: { w: 1280, h: 760, plie: true }, t: { w: 390, h: 800, plie: true, tactile: true }, s: { w: 1440, h: 900, plie: true, mode: 'sombre' }, o: { w: 1440, h: 900, plie: false }, ts: { w: 390, h: 800, plie: true, tactile: true, mode: 'sombre' } }[T];
const role = +(process.env.ROLE || 0);
const pre = (role ? `r${role}-` : '') + T;
(async () => {
  const b = await ux.lancer();
  const { p, errs } = await ux.ouvrir(b, { role, ...CONF });
  const vues = (process.env.VUES || 'tableau,moi,equipe,officine,regles,construire,gardes,resoudre,messages,heures,equite,stats,journal,documents,aide').split(',');
  const mes = {};
  for (const v of vues) {
    if (v === 'compte') { await p.evaluate(() => document.querySelector('[data-tour="compte"]').click()); await p.waitForTimeout(250); await p.locator('.menu button', { hasText: 'Mon compte' }).click(); await p.waitForTimeout(700); }
    else await ux.aller(p, v);
    const fichiers = await ux.defiler(p, `${pre}-${v}`, { max: +(process.env.MAX || 14) });
    mes[v] = { n: fichiers.length, ...(await ux.mesurer(p)) };
    if (T === 't' || T === 'ts') { for (let k = 0; k < fichiers.length; k += 4) ux.assembler(fichiers.slice(k, k + 4), `${ux.DIR}/${pre}-${v}-A${k / 4 + 1}.png`, 4); }
    console.log(v, fichiers.length);
  }
  fs.writeFileSync(`${__dirname}/mesures-${pre}.json`, JSON.stringify({ mes, errs }, null, 1));
  console.log('erreurs', errs.length, errs.slice(0, 5));
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
