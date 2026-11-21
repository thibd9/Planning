// Gardes : fenêtres Importer, Répartir, Ajouter ; sélection d'une garde par pastille ; suppression.
const ux = require('./ux');
const dlg = async (p, nom) => {
  await p.waitForTimeout(700); await ux.shot(p, `${nom}-1`);
  const d = await p.evaluate(() => { const d = [...document.querySelectorAll('.dialog')].pop(); if (!d) return null; const c = d.querySelector('.dialog-body') || d; return { H: c.clientHeight, T: c.scrollHeight }; });
  let k = 1; if (d && d.T > d.H + 10) for (let y = d.H - 60; k < 5; y += d.H - 60) { await p.evaluate((y) => { const d = [...document.querySelectorAll('.dialog')].pop(); (d.querySelector('.dialog-body') || d).scrollTo(0, y); }, y); await p.waitForTimeout(250); k++; await ux.shot(p, `${nom}-${k}`); if (y + d.H >= d.T) break; }
  console.log(nom, JSON.stringify(d), JSON.stringify(await ux.mesurer(p, '.dialog')).slice(0, 700));
};
(async () => {
  const b = await ux.lancer();
  for (const [t, w, h, tact] of [['d', 1440, 900, false], ['t', 390, 800, true]]) {
    const { p, errs } = await ux.ouvrir(b, { w, h, plie: true, tactile: tact });
    await ux.aller(p, 'gardes');
    for (const [bt, nom] of [['Importer un calendrier', 'importer'], ['Répartir', 'repartir'], ['Ajouter une garde', 'ajouter']]) {
      await p.evaluate(() => document.getElementById('contenu').scrollTo(0, 0));
      await p.getByRole('button', { name: new RegExp(bt) }).first().click(); await dlg(p, `${t}-gardes-${nom}`);
      if (nom === 'ajouter') { const ok = p.locator('.dialog button.primary').last(); console.log('ajouter actif', await ok.isEnabled()); }
      await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    }
    // pastille 12 décembre
    await p.evaluate(() => document.getElementById('contenu').scrollTo(0, 0));
    await p.evaluate(() => [...document.querySelectorAll('.cal-g')].find((x) => x.textContent.trim().startsWith('12')).click()); await p.waitForTimeout(800);
    const y = await p.evaluate(() => document.getElementById('contenu').scrollTop);
    console.log(t, 'défilement après pastille', y);
    await ux.shot(p, `${t}-gardes-pastille12`);
    const f = await ux.defiler(p, `${t}-gardes-12`, { max: 8 });
    if (t === 't') ux.assembler(f.slice(0, 8), `${ux.DIR}/t-gardes-12-A.png`, 4);
    // supprimer la garde affichée
    await p.evaluate(() => document.querySelector('[aria-label="Supprimer cette garde"]').scrollIntoView({ block: 'center' }));
    await p.locator('[aria-label="Supprimer cette garde"]').click(); await p.waitForTimeout(500);
    console.log(t, 'toast', await p.evaluate(() => document.querySelector('.toast')?.innerText || 'aucun'), 'dialog', await p.evaluate(() => !!document.querySelector('.dialog')));
    await ux.shot(p, `${t}-gardes-supprimee`);
    console.log(t, errs);
    await p.context().close();
  }
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
