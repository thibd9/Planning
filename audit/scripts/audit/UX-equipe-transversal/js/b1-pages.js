// Chaque page de l'espace équipe d'un profil, à une taille : capture, défilement, mesures. ROLE, T (b|p|t), MODE, PAGES, PRE.
const { ouvrir } = require('../lib.js');
const fs = require('fs');
const TAILLES = { b: [1440, 900], p: [1280, 760], t: [390, 800] };
(async () => {
  const role = +(process.env.ROLE || 3); const mode = process.env.MODE; const pre = process.env.PRE || `b1-r${role}`;
  const pages = (process.env.PAGES || 'espace,moi,demandes,suivi,documents,mesgardes,planning,messages,compte').split(',');
  const mesures = {};
  for (const t of (process.env.T || 'b').split('')) {
    const [w, h] = TAILLES[t];
    const o = await ouvrir({ role, w, h, mode }); const p = o.p;
    for (const v of pages) {
      let ok;
      if (v === 'compte') { ok = await p.evaluate(() => { const b = document.querySelector('.compte-btn'); if (!b) return false; b.click(); return true; }); await p.waitForTimeout(300); ok = await p.evaluate(() => { const b = [...document.querySelectorAll('.menu button')].find((e) => /Mon compte/.test(e.textContent)); if (!b) return false; b.click(); return true; }); await p.waitForTimeout(700); }
      else ok = await o.nav(v);
      if (!ok) { console.log(t, v, 'absent'); continue; }
      await p.evaluate(() => document.getElementById('contenu')?.scrollTo(0, 0)); await p.waitForTimeout(300);
      const nom = `${pre}${mode ? '-' + mode : ''}-${v}-${t}`;
      const d = await o.defiler(nom, +(process.env.MAX || 10));
      mesures[nom] = { ...d, ...(await o.mesurer('#contenu')), entete: await p.evaluate(() => ({ eyebrow: document.querySelector('.page-head .eyebrow')?.innerText, h1: document.querySelector('#contenu h1')?.innerText, sous: document.querySelector('.page-head p')?.innerText })) };
      console.log(nom, JSON.stringify({ n: d.n, h: d.hauteur, deb: mesures[nom].deborde, coupes: mesures[nom].coupes.length, petits: mesures[nom].petits.length }));
    }
    console.log(t, 'errs', o.errs);
    await o.b.close();
  }
  fs.writeFileSync(`${__dirname}/../mesures-${pre}${mode ? '-' + mode : ''}-${process.env.T || 'b'}.json`, JSON.stringify(mesures, null, 1));
})();
