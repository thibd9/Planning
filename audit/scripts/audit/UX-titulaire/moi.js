// Mon planning : vue Calendrier, fenêtre « Poser une absence », « Prévenir d'un retard », aperçu « Imprimer ».
const ux = require('./ux');
(async () => {
  const b = await ux.lancer();
  for (const [t, w, h, tact] of [['d', 1440, 900, false], ['t', 390, 800, true]]) {
    const { p, errs } = await ux.ouvrir(b, { w, h, plie: true, tactile: tact });
    await ux.aller(p, 'moi');
    await p.getByRole('button', { name: /Calendrier/ }).first().click(); await p.waitForTimeout(500);
    await p.evaluate(() => { const e = [...document.querySelectorAll('h2,h3')].find((x) => /Mes semaines/.test(x.textContent)); e?.scrollIntoView({ block: 'start' }); });
    await p.waitForTimeout(300); const f = await ux.defiler(p, `${t}-moi-cal`, { max: 6 });
    if (t === 't') ux.assembler(f, `${ux.DIR}/t-moi-cal-A.png`, 4);
    await ux.aller(p, 'moi');
    await p.getByRole('button', { name: /Poser une absence/ }).first().click(); await p.waitForTimeout(600);
    await ux.shot(p, `${t}-moi-absence-1`);
    const dlg = await p.evaluate(() => { const d = document.querySelector('.dialog, [role=dialog]'); if (!d) return null; const c = d.querySelector('.dialog-body') || d; return { H: c.clientHeight, T: c.scrollHeight }; });
    if (dlg && dlg.T > dlg.H + 10) { await p.evaluate(() => { const d = document.querySelector('.dialog, [role=dialog]'); const c = d.querySelector('.dialog-body') || d; c.scrollTo(0, 99999); }); await p.waitForTimeout(250); await ux.shot(p, `${t}-moi-absence-2`); }
    console.log(t, 'dlg', JSON.stringify(dlg));
    console.log(JSON.stringify(await ux.mesurer(p, '.dialog, [role=dialog]')));
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await ux.aller(p, 'moi');
    await p.getByRole('button', { name: /Prévenir d’un retard/ }).first().click(); await p.waitForTimeout(600);
    await ux.shot(p, `${t}-moi-retard`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await ux.aller(p, 'moi');
    await p.locator('#moi-imprimer').click(); await p.waitForTimeout(900);
    await ux.shot(p, `${t}-moi-imprimer`);
    console.log(t, errs);
    await p.context().close();
  }
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
