// Déroule une visite guidée : un clic par étape. « Suivant » ferme la fiche, tous les gestes s'enchaînent, l'étape suivante arrive.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const D = __dirname + '/shots/';
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = []; let titre = '';
  p.on('pageerror', (e) => errs.push(`[${titre}] ${e.message}`)); p.on('console', (m) => (m.type() === 'error' || /same key|\[visite/.test(m.text())) && errs.push(`[${titre}] ${m.text().slice(0, 200)}`));
  await p.goto(process.env.URL || 'http://localhost:5180/'); await p.evaluate((r) => { localStorage.clear(); localStorage.setItem('releve.visite.rythme', r); }, process.env.RYTHME || 'vif'); await p.reload(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(500);
  // Le carrousel : on cherche la visite dans chaque famille, on la montre, puis on la lance.
  { const nom = process.env.CARTE || 'Complet'; let vu = false;
    for (const o of ['parcours', 'metiers', 'journees', 'ecrans']) { { const og = p.locator(`#dc-onglet-${o}`); if (await og.count()) { await og.click(); await p.waitForTimeout(250); } } const pt = p.locator(`.dc-point[data-nom="${nom}"]`); if (await pt.count()) { await pt.click(); await p.waitForTimeout(300); vu = true; break; } }
    if (!vu) throw new Error('visite introuvable : ' + nom);
    await p.locator('.dc-diapo .btn.primary').click(); }
  const actes = []; const regards = []; let fautesCouleur = 0;
  // Début de chapitre : l'annonce se lit, puis on entre. Sa couleur doit être celle du profil de la personne.
  const ouverte = async (rang) => {
    for (let k = 0; k < 600; k++) {
      const e = await p.evaluate((r) => { const f = document.querySelector('.parcours-test'); const a = document.querySelector('.pt-acte'); const g = document.querySelector('.pt-regard b'); return { acte: a ? { titre: a.querySelector('h2')?.textContent, n: a.querySelector('.eyebrow')?.textContent, but: a.querySelector('.pt-acte-but')?.textContent, qui: a.querySelector('.pt-acte-qui')?.textContent } : null, regard: g?.textContent, theme: document.documentElement.dataset.theme, ok: !!f && !f.classList.contains('ferme') && (!r || new RegExp(` ${r} sur `).test(f.querySelector('.eyebrow')?.textContent || '')) }; }, rang);
      if (e.regard && regards[regards.length - 1] !== `${e.regard} [${e.theme}]`) regards.push(`${e.regard} [${e.theme}]`);
      if (e.acte) { actes.push(`${e.acte.n} - ${e.acte.titre} [${e.theme}] ${e.acte.qui}`); if (!e.acte.but) fautesCouleur++; if (process.env.ACTES) await p.screenshot({ path: `${D}acte-${actes.length}.png` }); await p.locator('.pt-acte [data-acte="go"]').click(); await p.waitForTimeout(300); continue; }
      if (e.ok) return;
      await p.waitForTimeout(150);
    }
    throw new Error('fiche jamais ouverte, étape ' + rang);
  };
  // Le projecteur est-il au bon endroit ? Si une fenêtre est ouverte, c'est elle qu'il doit éclairer.
  const etat = () => p.evaluate(() => {
    const f = document.querySelector('.focus-parcours'); const r = f?.getBoundingClientRect(); const c = document.getElementById('contenu')?.getBoundingClientRect() ?? { top: 0, left: 0 };
    const d = document.querySelector('.overlay .dialog, .overlay .decouvrir')?.getBoundingClientRect();
    const recouvre = r && d ? Math.max(0, Math.min(r.right, d.right) - Math.max(r.left, d.left)) * Math.max(0, Math.min(r.bottom, d.bottom) - Math.max(r.top, d.top)) / (d.width * d.height) : 1;
    return { focus: !!f, horsFenetre: !!d && recouvre < 0.85, deborde: !!r && !d && r.top < c.top - 1 && r.bottom > c.top + 40 && r.left > c.left - 20, titre: document.querySelector('.parcours-test h2')?.textContent, qui: document.querySelector('.parcours-test .row .small')?.textContent, chapitre: document.querySelector('.pt-chapitre')?.textContent.replace(/, ouvrir.*/, '').trim(), libre: !!document.querySelector('.pt-libre'), legende: document.querySelector('.solvi-bulle b')?.textContent ?? '', fiche: !document.querySelector('.parcours-test.ferme') || !!document.querySelector('.pt-acte') };
  });
  await ouverte(1); await p.waitForTimeout(900);
  const n = parseInt((await p.locator('.parcours-test .eyebrow').textContent()).match(/sur (\d+)/)[1]); let pb = 0, clics = 0;
  const captures = (process.env.CAPTURES || '').split(',').filter(Boolean).map(Number);
  for (let i = 1; i <= n; i++) {
    await ouverte(i); await p.waitForTimeout(1000);
    const lire = await etat(); titre = lire.titre; let souci = ''; const vus = []; let hors = 0;
    if (captures.includes(i)) await p.screenshot({ path: `${D}v${i}-0.png` });
    const bouton = p.locator('.parcours-test [data-suite]'); const suite = await bouton.getAttribute('data-suite');
    if (!lire.focus) souci += ' sans-focus'; if (lire.horsFenetre) souci += ' focus-hors-fenêtre'; if (lire.deborde) souci += ' déborde'; if (lire.libre) souci += ' libre';
    if (i === n && suite !== 'geste') break;
    await bouton.click(); clics++;
    if (suite === 'geste') {
      // Pendant la démonstration : la fiche est fermée, et le projecteur suit ce qui est au premier plan.
      for (let k = 0; k < 400; k++) {
        await p.waitForTimeout(process.env.RAPIDE ? 350 : 700); if (process.env.RAPIDE) await p.locator('.solvi-continuer:not([disabled])').click({ timeout: 250 }).catch(() => {}); const e = await etat();
        if (e.fiche) break;
        if (e.legende && vus[vus.length - 1] !== e.legende) vus.push(e.legende);
        hors = e.horsFenetre ? hors + 1 : 0; if (hors >= 3 && !/focus-hors/.test(souci)) { souci += ' focus-hors-fenêtre(démo)'; await p.screenshot({ path: `${D}v${i}-hors.png` }); }
        if (captures.includes(i) && k % 3 === 1) await p.screenshot({ path: `${D}v${i}-d${k}.png` });
      }
    }
    if (souci) pb++;
    console.log(String(i).padStart(2), souci ? '!!' : 'ok', (lire.chapitre || '').padEnd(28).slice(0, 28), (lire.qui || '').padEnd(24).slice(0, 24), (lire.titre || '').padEnd(30).slice(0, 30), vus.length ? `${vus.length} geste(s)` : '', souci);
  }
  console.log('CHAPITRES\n  ' + actes.join('\n  ')); console.log('REGARDS\n  ' + regards.join('\n  '));
  console.log(`${n} étapes, ${clics} clics, ${pb} à revoir, ${actes.length} chapitres annoncés, ${fautesCouleur} sans but`); console.log([...new Set(errs)].join('\n') || 'aucune erreur'); await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
