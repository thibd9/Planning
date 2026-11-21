// Raccourcis de l'accueil, filtre « Mes postes », annuler une demande de remplacement, motif « Autre raison ».
const { ouvrir } = require('../lib');
(async () => {
  const log = [];
  const o = await ouvrir({ role: 3 }); const { p } = o;
  const T = { timeout: 4000 };
  for (const r of ['Voir mon planning', 'Demander une absence ou un horaire', 'Écrire à Caroline T.']) {
    await o.nav('espace'); await p.locator('.esp-raccourcis button', { hasText: r }).click(T); await p.waitForTimeout(400);
    log.push(`Raccourci « ${r} » → ${await p.title()} ; dialogue=${await p.locator('.dialog').count()} ; onglet=${await p.locator('.voies [aria-selected="true"] b').innerText(T).catch(() => '-')} ; fil=${await p.locator('section.card h2.h3').first().innerText(T).catch(() => '-')}`);
    await p.keyboard.press('Escape');
  }
  await o.nav('espace'); await p.locator('.top-creer').click(T); await p.waitForTimeout(400);
  log.push(`Barre « Faire une demande » → ${await p.title()} ; dialogue=${await p.locator('.dialog').count()}`); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await o.nav('planning');
  await p.locator('.plan-bar button, .plan-bar [role=radio]', { hasText: 'Mes postes' }).first().click(T); await p.waitForTimeout(300);
  log.push('Mes postes : lignes=' + await p.locator('table.lecture tbody tr').count());
  await p.locator('.plan-bar button, .plan-bar [role=radio]', { hasText: 'Toute l’équipe' }).first().click(T); await p.waitForTimeout(300);
  log.push('Toute l’équipe : lignes=' + await p.locator('table.lecture tbody tr').count());
  await o.nav('demandes'); await p.locator('#dem-remplacements').click(); await p.waitForTimeout(300);
  await p.locator('.dm', { hasText: 'Ven. 27 novembre' }).locator('button').last().click(T); await p.waitForTimeout(300);
  await p.locator('#rempl-motif').selectOption('autre');
  const bt = p.locator('.dialog button.primary', { hasText: 'Envoyer la demande' });
  log.push(`Motif « Autre raison », sans précision : grisé=${await bt.isDisabled()} title=${await bt.getAttribute('title')}`);
  await p.locator('#rempl-precision').fill('ab'); log.push(`… précision « ab » : grisé=${await bt.isDisabled()}`);
  await p.locator('#rempl-precision').fill('Mariage'); log.push(`… précision « Mariage » : grisé=${await bt.isDisabled()}`);
  await bt.click(); await p.waitForTimeout(300);
  const l = p.locator('.dm', { hasText: 'Ven. 27 novembre' });
  log.push('Ligne : ' + (await l.innerText()).replace(/\n+/g, ' | '));
  await l.locator('button', { hasText: 'Annuler' }).click(); await p.waitForTimeout(300);
  log.push(`Annuler la demande : dialogue de confirmation=${await p.locator('.dialog').count()} ; toast=${await p.locator('.toast').innerText(T).catch(() => 'aucun')} ; ligne=${(await l.innerText()).replace(/\n+/g, ' | ')}`);
  log.push('Statut : ' + JSON.stringify((await o.data()).remplacements.filter((r) => r.demandeur === 'p_camille').map((r) => r.statut)));
  console.log(log.join('\n')); o.ecrire('extra.txt', log.join('\n'));
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
