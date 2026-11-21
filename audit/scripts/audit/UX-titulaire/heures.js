// Heures : Faire rattraper (fenêtre Régulariser), Solder (retour), Régulariser automatiquement.
const ux = require('./ux');
(async () => {
  const b = await ux.lancer();
  for (const [t, w, h, tact] of [['d', 1440, 900, false], ['t', 390, 800, true]]) {
    const { p, errs } = await ux.ouvrir(b, { w, h, plie: true, tactile: tact });
    await ux.aller(p, 'heures');
    await p.getByRole('button', { name: /Faire rattraper/ }).first().click(); await p.waitForTimeout(900);
    await ux.shot(p, `${t}-heures-rattraper-1`);
    const d = await p.evaluate(() => { const d = [...document.querySelectorAll('.dialog')].pop(); if (!d) return null; const c = d.querySelector('.dialog-body') || d; return { H: c.clientHeight, T: c.scrollHeight }; });
    let k = 1; if (d && d.T > d.H + 10) for (let y = d.H - 60; k < 5; y += d.H - 60) { await p.evaluate((y) => { const d = [...document.querySelectorAll('.dialog')].pop(); (d.querySelector('.dialog-body') || d).scrollTo(0, y); }, y); await p.waitForTimeout(250); k++; await ux.shot(p, `${t}-heures-rattraper-${k}`); if (y + d.H >= d.T) break; }
    console.log(t, 'rattraper', JSON.stringify(d), JSON.stringify(await ux.mesurer(p, '.dialog')).slice(0, 900));
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await p.getByRole('button', { name: /^Solder/ }).first().click(); await p.waitForTimeout(700);
    console.log(t, 'solder : fenêtre ?', await p.evaluate(() => !!document.querySelector('.dialog')), 'toast', await p.evaluate(() => document.querySelector('.toast')?.innerText || 'aucun'));
    await ux.shot(p, `${t}-heures-solde`);
    await p.evaluate(() => document.getElementById('contenu').scrollTo(0, 0));
    await p.getByRole('button', { name: /Régulariser automatiquement/ }).first().click(); await p.waitForTimeout(3000);
    console.log(t, 'auto : fenêtre ?', await p.evaluate(() => !!document.querySelector('.dialog')), 'toast', await p.evaluate(() => document.querySelector('.toast')?.innerText || 'aucun'));
    await ux.shot(p, `${t}-heures-auto`);
    const f = await ux.defiler(p, `${t}-heures-apres`, { max: 8 });
    if (t === 't') ux.assembler(f.slice(-4), `${ux.DIR}/t-heures-apres-A.png`, 4);
    console.log(t, errs);
    await p.context().close();
  }
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
