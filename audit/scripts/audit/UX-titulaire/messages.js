// Messages : débordement au téléphone, ouvrir une conversation, envoyer, fenêtre de rendez-vous.
const ux = require('./ux');
(async () => {
  const b = await ux.lancer();
  for (const [t, w, h, tact] of [['d', 1440, 900, false], ['t', 390, 800, true]]) {
    const { p, errs } = await ux.ouvrir(b, { w, h, plie: true, tactile: tact });
    await ux.aller(p, 'messages');
    const m = await p.evaluate(() => { const W = innerWidth; const out = []; for (const e of document.querySelectorAll('.content *')) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.right > W + 2 && e.children.length < 3) out.push(`${e.tagName}.${String(e.className).slice(0, 20)} ${Math.round(r.left)}→${Math.round(r.right)} « ${(e.textContent || '').trim().slice(0, 30)} »`); } const c = document.getElementById('contenu'); return { cw: c.clientWidth, sw: c.scrollWidth, out: out.slice(0, 15) }; });
    console.log(t, JSON.stringify(m, null, 1));
    // ouvrir la conversation de Pierre
    await p.locator('button', { hasText: 'Pierre Fiandino' }).first().click(); await p.waitForTimeout(700);
    console.log(t, 'défilement après clic Pierre', await p.evaluate(() => document.getElementById('contenu').scrollTop));
    await ux.shot(p, `${t}-messages-pierre`);
    // écrire et envoyer
    const ta = p.locator('textarea').first(); await ta.scrollIntoViewIfNeeded(); await ta.fill('Essai de message.');
    const env = p.getByRole('button', { name: /Envoyer/ }).first();
    console.log(t, 'Envoyer visible', await env.isVisible(), JSON.stringify(await env.boundingBox()));
    await ux.shot(p, `${t}-messages-saisie`);
    await env.click({ force: true }).catch((e) => console.log('clic impossible', e.message.slice(0, 80))); await p.waitForTimeout(600);
    await ux.shot(p, `${t}-messages-envoye`);
    // rendez-vous
    await p.evaluate(() => document.getElementById('contenu').scrollTo(0, 0));
    await p.getByRole('button', { name: /Demander un rendez-vous/ }).first().click(); await p.waitForTimeout(800);
    await ux.shot(p, `${t}-messages-rdv-1`);
    const d = await p.evaluate(() => { const d = [...document.querySelectorAll('.dialog')].pop(); const c = d.querySelector('.dialog-body') || d; return { H: c.clientHeight, T: c.scrollHeight }; });
    if (d.T > d.H + 10) { await p.evaluate(() => { const d = [...document.querySelectorAll('.dialog')].pop(); (d.querySelector('.dialog-body') || d).scrollTo(0, 99999); }); await p.waitForTimeout(250); await ux.shot(p, `${t}-messages-rdv-2`); }
    console.log(t, 'rdv', JSON.stringify(d), JSON.stringify(await ux.mesurer(p, '.dialog')).slice(0, 700));
    console.log(t, errs);
    await p.context().close();
  }
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
