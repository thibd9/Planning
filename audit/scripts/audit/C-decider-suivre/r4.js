// 1) « Confier » à Léa (volontaire de l'appel déjà lancé pour Igor le 20/11). 2) Appel pour Thomas (sam. 21/11).
const { ouvrir, dialogue } = require('./lib');
(async () => {
  let o = await ouvrir({ role: 0 });
  let { p } = o;
  await o.nav('resoudre');
  await p.locator('section.appel button', { hasText: 'Confier' }).first().click(); await p.waitForTimeout(700);
  console.log('TOAST', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  let d = await o.data();
  console.log('Léa 20/11 brouillon', JSON.stringify(d.shifts.filter((s) => s.personId === 'p_lea' && s.date === '2026-11-20').map((s) => [s.start, s.end, s.origine])), 'publié', JSON.stringify(d.semaines['2026-11-16'].snapshot.filter((s) => s.personId === 'p_lea' && s.date === '2026-11-20').map((s) => [s.start, s.end])));
  console.log('trou', JSON.stringify(d.trous.filter((t) => t.shift.date === '2026-11-20').map((t) => [t.statut, t.resolution])));
  console.log('notif Léa', JSON.stringify(d.notifications.filter((n) => n.personId === 'p_lea')));
  console.log('messages', JSON.stringify(d.messages.slice(2).map((m) => [m.de, m.a, m.texte])));
  console.log('journal0', d.journal[0].titre, '| annonce0', JSON.stringify(d.annonces[0]));
  await o.b.close();

  o = await ouvrir({ role: 0 }); p = o.p;
  await p.getByRole('button', { name: /Retard ou absence/ }).first().click(); await p.waitForTimeout(400);
  await p.selectOption('#sg-qui', 'p_thomas'); await p.locator('label[for=sg-absence]').click();
  await p.fill('#sg-du', '2026-11-21'); await p.fill('#sg-au', '2026-11-21');
  await p.locator('#sg-confirmer').click(); await p.waitForTimeout(700);
  await o.nav('resoudre');
  const carte = p.locator('.card:has(h3:has-text("Thomas N."))').first();
  const appel = carte.locator('section.appel');
  console.log('APPEL avant', (await appel.innerText()).slice(0, 1500));
  const bt = appel.locator('.appel-tete button.btn.primary');
  console.log('bouton', await bt.innerText(), 'désactivé', await bt.isDisabled());
  if (!(await bt.isDisabled())) { await bt.click(); await p.waitForTimeout(600); }
  console.log('TOAST', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  console.log('APPEL après', (await appel.innerText()).slice(0, 1200));
  await o.shot('r4-appel-thomas', { fullPage: true });
  d = await o.data();
  const r = d.remplacements.find((x) => x.trouId && x.date === '2026-11-21');
  console.log('REMPL', JSON.stringify(r));
  console.log('MESSAGES', JSON.stringify(d.messages.slice(2).map((m) => [m.de, m.a, m.texte.slice(0, 90)])));
  console.log('JOURNAL0', d.journal[0].titre);
  // Le volontaire répond depuis son profil, si c'est l'un des profils de test.
  const profils = { p_karim: 'Pharmacien', p_camille: 'Préparateur', p_sarah: 'Animateur', p_manon: 'Apprenti', p_yanis: 'Étudiant', p_antoine: 'Titulaire 2' };
  const qui = (r?.sollicites ?? []).find((x) => profils[x]);
  console.log('volontaire testable', qui);
  if (qui) {
    await o.profil(profils[qui]);
    await o.nav('moi');
    const recu = p.locator('.appel-recu').first();
    console.log('APPEL RECU', await recu.count() ? (await recu.innerText()).slice(0, 600) : 'absent');
    await o.shot('r4-appel-recu');
    if (await recu.count()) { await recu.getByRole('button', { name: 'Je peux' }).click(); await p.waitForTimeout(500); }
    await o.profil('Titulaire 1');
    await o.nav('resoudre');
    const c2 = p.locator('.card:has(h3:has-text("Thomas N."))').first();
    console.log('APPEL titulaire', (await c2.locator('section.appel').innerText()).slice(0, 800));
    const conf = c2.locator('section.appel button', { hasText: /Confier/ }).first();
    if (await conf.count()) { await conf.click(); await p.waitForTimeout(700); }
    d = await o.data();
    console.log('après confier', JSON.stringify(d.shifts.filter((s) => s.personId === qui && s.date === '2026-11-21').map((s) => [s.start, s.end, s.origine])), JSON.stringify(d.semaines['2026-11-16'].snapshot.filter((s) => s.personId === qui && s.date === '2026-11-21').map((s) => [s.start, s.end])));
    console.log('notif', JSON.stringify(d.notifications.filter((n) => n.personId === qui)));
  }
  console.log('ERR', o.errs);
  await o.b.close();
})();
