// Réglages > Planning > Postes types : fenêtre d'un poste type (existant et nouveau), et « Repartir de zéro ».
const ux = require('./ux');
(async () => {
  const b = await ux.lancer();
  for (const [t, w, h, tact] of [['d', 1440, 900, false], ['t', 390, 800, true]]) {
    const { p, errs } = await ux.ouvrir(b, { w, h, plie: true, tactile: tact });
    await ux.aller(p, 'officine');
    await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.includes('Planning')).click()); await p.waitForTimeout(500);
    await p.evaluate(() => { const s = [...document.querySelectorAll('details.acc > summary')].find((x) => x.textContent.includes('Postes types')); s.click(); s.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(600);
    const f = await ux.defiler(p, `${t}-officine-postes`, { max: 6 });
    // positionner le défilement sur la liste des postes
    await p.evaluate(() => { const s = [...document.querySelectorAll('details.acc > summary')].find((x) => x.textContent.includes('Postes types')); s.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(300);
    await ux.shot(p, `${t}-officine-postes-liste`);
    // ouvrir le premier poste type existant
    const ouvert = await p.evaluate(() => { const d = [...document.querySelectorAll('details.acc')].find((x) => x.querySelector('summary').textContent.includes('Postes types')); const bt = [...d.querySelectorAll('button')].find((x) => /Ouverture/.test(x.textContent) || /Modifier/.test(x.getAttribute('aria-label') || '')); if (bt) { bt.click(); return bt.textContent.trim().slice(0, 60) + ' | ' + (bt.getAttribute('aria-label') || ''); } return [...d.querySelectorAll('button')].map((x) => x.textContent.trim().slice(0, 30) + '/' + (x.getAttribute('aria-label') || '')).join(' ; '); });
    console.log(t, 'ouvert', ouvert); await p.waitForTimeout(700);
    await ux.shot(p, `${t}-officine-poste-1`);
    const d = await p.evaluate(() => { const d = [...document.querySelectorAll('.dialog')].pop(); if (!d) return null; const c = d.querySelector('.dialog-body') || d; return { H: c.clientHeight, T: c.scrollHeight }; });
    if (d && d.T > d.H + 10) { await p.evaluate(() => { const d = [...document.querySelectorAll('.dialog')].pop(); (d.querySelector('.dialog-body') || d).scrollTo(0, 99999); }); await p.waitForTimeout(250); await ux.shot(p, `${t}-officine-poste-2`); }
    console.log(t, JSON.stringify(d), JSON.stringify(await ux.mesurer(p, '.dialog')));
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    // nouveau poste type
    const bt = p.getByRole('button', { name: /Ajouter un poste type/ });
    if (await bt.count()) { await bt.first().click(); await p.waitForTimeout(700); await ux.shot(p, `${t}-officine-poste-nouveau`); await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    // Paramètres > Repartir de zéro
    await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.includes('Paramètres')).click()); await p.waitForTimeout(500);
    await p.evaluate(() => { const s = [...document.querySelectorAll('details.acc > summary')].find((x) => x.textContent.includes('Repartir')); s.click(); s.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(600);
    await ux.shot(p, `${t}-officine-zero`);
    console.log(t, errs);
    await p.context().close();
  }
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
