// Fenêtres à 1280×760 et 390×800 : taille, en-tête, pied visible, défilement interne.
const { ouvrir } = require('../lib.js');
const mesure = (p) => p.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); if (!d) return null; const r = d.getBoundingClientRect(); const tete = d.firstElementChild?.getBoundingClientRect(); const sc = [d, ...d.querySelectorAll('*')].find((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 5; }); const pied = [...d.querySelectorAll('button')].pop()?.getBoundingClientRect(); return { titre: d.querySelector('h2')?.innerText, boite: [r.left, r.top, r.width, r.height].map(Math.round), tete: tete ? Math.round(tete.height) : null, corpsVisible: sc ? sc.clientHeight : null, corpsTotal: sc ? sc.scrollHeight : null, dernierBouton: pied ? Math.round(pied.bottom) : null, H: innerHeight }; });
(async () => {
  for (const [w, h, t] of [[1280, 760, 'p'], [390, 800, 't']]) {
    const o = await ouvrir({ role: 3, w, h }); const p = o.p;
    const cas = [
      ['nouvelle-demande', () => p.evaluate(() => document.querySelector('.top-creer').click())],
      ['signaler', () => p.evaluate(() => document.getElementById('top-signaler').click())],
      ['prevenir', async () => { await o.nav('espace'); await p.evaluate(() => [...document.querySelectorAll('#contenu button')].find((e) => /Prévenir d’un retard/.test(e.textContent))?.click()); }],
      ['journee', async () => { await o.nav('moi'); await p.evaluate(() => document.querySelector('.lien-jour')?.click()); }],
      ['imprimer', async () => { await o.nav('moi'); await p.evaluate(() => [...document.querySelectorAll('#contenu button')].find((e) => /^\s*Imprimer\s*$/.test(e.textContent))?.click()); }],
      ['remplacer', async () => { await o.nav('demandes'); await p.evaluate(() => document.getElementById('dem-remplacements')?.click()); await p.waitForTimeout(300); await p.evaluate(() => [...document.querySelectorAll('#contenu button')].find((e) => /^(Me faire remplacer|Demande urgente)$/.test(e.textContent.trim()))?.click()); }],
      ['rdv', async () => { await o.nav('espace'); await p.evaluate(() => [...document.querySelectorAll('#contenu button')].find((e) => /Demander un rendez-vous/.test(e.textContent))?.click()); }],
    ];
    for (const [nom, f] of cas) {
      await f(); await p.waitForTimeout(700);
      console.log(t, nom, JSON.stringify(await mesure(p)));
      await o.shot(`c3-${t}-${nom}`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    }
    console.log(o.errs); await o.b.close();
  }
})();
