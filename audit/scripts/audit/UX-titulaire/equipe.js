// Équipe : fiche d'une autre personne (plié et déplié), clic sur téléphone, fenêtres Ajouter / Besoin ou absence / Retirer.
const ux = require('./ux');
const dlgShots = async (p, nom) => {
  await ux.shot(p, `${nom}-1`);
  const d = await p.evaluate(() => { const d = [...document.querySelectorAll('.dialog, [role=dialog]')].pop(); if (!d) return null; const c = d.querySelector('.dialog-body') || d; return { H: c.clientHeight, T: c.scrollHeight, titre: (d.querySelector('h2,h1')?.textContent || '').trim() }; });
  let k = 1;
  if (d && d.T > d.H + 10) for (let y = d.H - 60; k < 6; y += d.H - 60) { await p.evaluate((y) => { const d = [...document.querySelectorAll('.dialog, [role=dialog]')].pop(); (d.querySelector('.dialog-body') || d).scrollTo(0, y); }, y); await p.waitForTimeout(200); k++; await ux.shot(p, `${nom}-${k}`); if (y + d.H >= d.T) break; }
  console.log(nom, JSON.stringify(d), JSON.stringify(await ux.mesurer(p, '.dialog')));
};
(async () => {
  const b = await ux.lancer();
  for (const [t, w, h, tact, plie] of [['d', 1440, 900, false, true], ['o', 1440, 900, false, false], ['t', 390, 800, true, true]]) {
    const { p, errs } = await ux.ouvrir(b, { w, h, plie, tactile: tact });
    await ux.aller(p, 'equipe');
    // Choisir Inès Da Silva
    await p.locator('button', { hasText: 'Inès Da Silva' }).first().click(); await p.waitForTimeout(700);
    const pos = await p.evaluate(() => ({ y: document.getElementById('contenu').scrollTop }));
    console.log(t, 'après clic Inès, défilement', JSON.stringify(pos));
    await ux.shot(p, `${t}-equipe-ines-clic`);
    if (t !== 't') { await p.evaluate(() => document.getElementById('contenu').scrollTo(0, 0)); }
    const f = await ux.defiler(p, `${t}-equipe-ines`, { max: 10 });
    if (t === 't') ux.assembler(f.slice(0, 8), `${ux.DIR}/t-equipe-ines-A.png`, 4);
    if (t === 'o') { console.log(JSON.stringify(await ux.mesurer(p))); }
    if (t !== 'o') {
      await ux.aller(p, 'equipe');
      await p.getByRole('button', { name: /Ajouter une personne/ }).first().click(); await p.waitForTimeout(700);
      await dlgShots(p, `${t}-equipe-ajouter`);
      // validation à vide
      const enr = p.locator('.dialog .dialog-foot button.primary, .dialog button.primary').last();
      if (await enr.count()) { await enr.click({ force: true }).catch(() => {}); await p.waitForTimeout(400); await ux.shot(p, `${t}-equipe-ajouter-vide`); }
      await p.keyboard.press('Escape'); await p.waitForTimeout(400);
      await ux.aller(p, 'equipe');
      await p.locator('button', { hasText: 'Inès Da Silva' }).first().click(); await p.waitForTimeout(500);
      await p.getByRole('button', { name: /Besoin ou absence/ }).first().click(); await p.waitForTimeout(700);
      await dlgShots(p, `${t}-equipe-besoin`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(400);
      await p.getByRole('button', { name: /Retirer de l’équipe/ }).first().click(); await p.waitForTimeout(600);
      await ux.shot(p, `${t}-equipe-retirer`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    }
    console.log(t, errs);
    await p.context().close();
  }
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
