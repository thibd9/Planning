// Un appel à l'équipe (remplacement ouvert) vu par un collègue sollicité : cloche, carte d'appel, réponse.
const { ouvrir } = require('../lib.js');
const TAILLES = { b: [1440, 900], p: [1280, 760], t: [390, 800] };
(async () => {
  for (const t of (process.env.T || 'b').split('')) {
    const [w, h] = TAILLES[t]; const pre = `b6-${t}`;
    const o = await ouvrir({ role: +(process.env.ROLE || 3), w, h }); const p = o.p;
    const d = await o.data();
    const moi = d.personnes.find((x) => x.prenom === (process.env.QUI || 'Nicolas'));
    const ouverts = d.remplacements.filter((r) => r.statut === 'ouverte').map((r) => ({ id: r.id, date: r.date, de: d.personnes.find((x) => x.id === r.personId)?.prenom, sollicites: (r.sollicites || []).map((i) => d.personnes.find((x) => x.id === i)?.prenom), volontaires: r.volontaires }));
    console.log('moi', moi.id, JSON.stringify(ouverts));
    // cloche
    await p.evaluate(() => document.querySelector('.top-ico[aria-haspopup]')?.click()); await p.waitForTimeout(400);
    await p.evaluate(() => [...document.querySelectorAll('.menu.cloche button')].find((e) => /remplaçant/.test(e.textContent))?.click()); await p.waitForTimeout(900);
    console.log(pre, 'après cloche : vue', await p.evaluate(() => document.querySelector('#contenu h1')?.innerText));
    await o.shot(`${pre}-apres-cloche`);
    // où est la carte d'appel ? on cherche un texte « remplaç » / « Je peux » / « volontaire »
    const ou = await p.evaluate(() => { const c = document.getElementById('contenu'); const el = [...c.querySelectorAll('section, .card, article, div')].filter((e) => /Je peux|Je ne peux pas|cherche|volontaire|appel/i.test(e.innerText || '') && e.querySelector('button')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { cls: el.className, top: Math.round(r.top), texte: el.innerText.slice(0, 700) }; });
    console.log(pre, 'carte', JSON.stringify(ou)); await p.waitForTimeout(400); await o.shot(`${pre}-carte`);
    // Accueil : l'appel y figure-t-il ?
    await o.nav('espace'); await o.defiler(`${pre}-accueil`, 3);
    console.log(pre, 'accueil mentionne', await p.evaluate(() => /remplaç|appel|cherche/i.test(document.getElementById('contenu').innerText)), (await p.evaluate(() => { const m = document.getElementById('contenu').innerText.match(/.{0,80}(remplaç|cherche).{0,120}/i); return m ? m[0] : null; })));
    await o.nav('moi'); console.log(pre, 'mon planning mentionne', (await p.evaluate(() => { const m = document.getElementById('contenu').innerText.match(/.{0,80}(remplaç|cherche).{0,160}/i); return m ? m[0] : null; })));
    await o.defiler(`${pre}-moi`, 2);
    console.log(pre, 'errs', o.errs);
    await o.b.close();
  }
})();
