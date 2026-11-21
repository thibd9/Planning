// A7b : après le retrait d'Igor, la demande de remplacement qui le concerne (Résoudre, cloche).
const { exemple } = require('./outils');
(async () => {
  const o = await exemple({ role: 0 });
  const { p, cap, texte } = o; const log = (...a) => console.log(...a);
  await o.fermerTour();
  let d = await o.courante(); const igor = d.personnes.find((x) => x.prenom === 'Igor');
  log('Remplacements liés à Igor :', JSON.stringify(d.remplacements.filter((r) => r.demandeur === igor.id || (r.volontaires || []).includes(igor.id)).map((r) => ({ date: r.date, statut: r.statut, demandeur: r.demandeur === igor.id, volontaire: (r.volontaires || []).includes(igor.id) }))));
  await o.nav('equipe'); await p.locator('.g-item', { hasText: 'Igor' }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /Retirer de l’équipe/ }).click(); await p.getByRole('button', { name: /Oui, retirer Igor/ }).click(); await p.waitForTimeout(500);
  await o.nav('resoudre'); await p.waitForTimeout(400);
  const carte = p.locator('.content').getByText('Demandes de remplacement').first();
  await carte.scrollIntoViewIfNeeded().catch(() => {});
  log('RÉSOUDRE (remplacements) :', (await texte('.content')).split('Demandes de remplacement')[1]?.slice(0, 500).replace(/\n/g, ' | '));
  await cap('a7-06-resoudre-remplacement-orphelin', { fullPage: true });
  await p.locator('.top-ico[aria-haspopup]').first().click(); await p.waitForTimeout(300);
  log('CLOCHE :', (await texte('.menu.cloche')).replace(/\n/g, ' | ').slice(0, 600));
  await cap('a7-07-cloche-apres-retrait');
  // Le journal : le retrait y est-il ?
  await p.keyboard.press('Escape'); await o.nav('journal'); await p.waitForTimeout(300);
  log('JOURNAL :', (await texte('.content')).replace(/\n/g, ' | ').slice(0, 600));
  log('ERREURS console :', o.errs.join(' || ') || 'aucune');
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
