// Lance une visite de chaque famille depuis « Comment ça marche ? » et capture l'annonce, la fiche, le « i », le sommaire, une démonstration.
const { ouvrir } = require('../lib.js');
const VISITES = [['dc-onglet-parcours', 'Préparateur', 'equipe'], ['dc-onglet-metiers', 'Apprenti', 'apprenti'], ['dc-onglet-journees', 'sous tension', 'tension'], ['dc-onglet-ecrans', 'espace de l', 'ecrans']];
(async () => {
  const tailles = [[1440, 900, 'b'], [1280, 760, 'p'], [390, 800, 't']].filter((x) => !process.env.T || process.env.T.includes(x[2]));
  for (const [w, h, t] of tailles) {
    for (const [onglet, nom, code] of VISITES.filter((v) => !process.env.V || process.env.V.includes(v[2]))) {
      const o = await ouvrir({ vierge: true, w, h }); const p = o.p;
      const n = `a4-${code}-${t}`;
      await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(500);
      await p.evaluate((id) => document.getElementById(id).click(), onglet); await p.waitForTimeout(300);
      await p.evaluate((nom) => [...document.querySelectorAll('.dc-point')].find((e) => e.textContent.includes(nom))?.click(), nom); await p.waitForTimeout(400);
      await p.evaluate(() => [...document.querySelectorAll('.decouvrir button')].find((e) => /Lancer la visite/.test(e.textContent)).click()); await p.waitForTimeout(1500);
      await o.shot(`${n}-0-annonce`);
      const ann = await p.evaluate(() => document.querySelector('.pt-acte, [data-acte]')?.closest('section')?.innerText.slice(0, 600));
      console.log(n, 'annonce', JSON.stringify(ann));
      await p.evaluate(() => document.querySelector('[data-acte="go"]')?.click()); await p.waitForTimeout(2500);
      await o.shot(`${n}-1-etape`);
      const info = await p.evaluate(() => { const a = document.querySelector('.parcours-test'); if (!a) return null; const r = a.getBoundingClientRect(); return { r: [r.left, r.top, r.width, r.height].map(Math.round), txt: a.innerText.slice(0, 500) }; });
      console.log(n, 'fiche', JSON.stringify(info));
      // bouton i
      const i = await p.evaluate(() => { const b = document.getElementById('pt-info'); if (!b) return null; b.click(); return true; }); await p.waitForTimeout(400);
      if (i) await o.shot(`${n}-2-info`);
      // sommaire
      const s = await p.evaluate(() => { const b = document.querySelector('.pt-chapitre'); if (!b) return null; b.click(); return true; }); await p.waitForTimeout(500);
      if (s) { await o.shot(`${n}-3-sommaire`); await p.evaluate(() => document.querySelector('.pt-retour')?.click()); await p.waitForTimeout(400); }
      // démonstration
      const d = await p.evaluate(() => { const b = document.querySelector('.pt-voir'); if (!b) return null; b.click(); return true; });
      if (d) { await p.waitForTimeout(1800); await o.shot(`${n}-4-demo-a`); await p.waitForTimeout(3500); await o.shot(`${n}-4-demo-b`); }
      // étape suivante (deux fois)
      for (let k = 0; k < 2; k++) { await p.evaluate(() => (document.querySelector('[data-suite="etape"]') || document.querySelector('.pt-passer'))?.click()); await p.waitForTimeout(2500); await o.shot(`${n}-5-suite${k}`); }
      const geo = await p.evaluate(() => { const a = document.querySelector('.parcours-test'); const sv = document.querySelector('.solvi-bulle, .assistant, [class*="solvi"]'); const r = a?.getBoundingClientRect(); return { fiche: r ? [r.left, r.top, r.width, r.height].map(Math.round) : null, solvi: sv ? sv.className : null }; });
      console.log(n, 'geo', JSON.stringify(geo), o.errs);
      await o.b.close();
    }
  }
})();
