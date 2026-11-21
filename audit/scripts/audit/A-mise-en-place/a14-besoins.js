// A14 (exemple) : besoin et absence saisis par la titulaire depuis la fiche « Équipe ».
const { exemple } = require('./outils');
(async () => {
  const log = (...a) => console.log(...a);
  const o = await exemple({ role: 0 }); const p = o.p; await o.fermerTour();
  const nico = async () => (await o.courante()).personnes.find((x) => x.prenom === 'Nicolas');
  await o.nav('equipe'); await p.locator('.g-item', { hasText: 'Nicolas' }).click(); await p.waitForTimeout(300);
  const id = (await nico()).id; let d = await o.courante();
  log('Avant : absences', d.absences.filter((a) => a.personId === id).length, '| besoins', d.besoins.filter((b) => b.personId === id).length, '| trous', d.trous.length);
  await p.getByRole('button', { name: /Besoin ou absence/ }).click(); await p.waitForTimeout(300);
  await p.locator('.dialog select').filter({ has: p.locator('option[value="absence"]') }).selectOption('absence'); await p.waitForTimeout(150);
  const dates = p.locator('.dialog input[type=date]');
  await dates.nth(0).fill('2026-11-26'); await dates.nth(1).fill('2026-11-24'); await p.waitForTimeout(100);
  log('Absence fin avant début : bouton désactivé =', await p.locator('.dialog').getByRole('button', { name: 'Enregistrer' }).isDisabled());
  await dates.nth(1).fill('2026-11-27'); await p.waitForTimeout(100);
  await p.locator('.dialog').getByRole('button', { name: 'Enregistrer' }).click(); await p.waitForTimeout(400);
  log('Toast :', await o.toast());
  d = await o.courante(); log('Après absence : absences', d.absences.filter((a) => a.personId === id).map((a) => `${a.type} ${a.from}→${a.to} ${a.statut}`).join(', '), '| trous', d.trous.length);
  log('Fiche, absences à venir :', (await p.locator('.acc', { hasText: 'Absences à venir' }).innerText()).replace(/\n/g, ' | '));
  // Un besoin par le raccourci « Mercredi ».
  await p.getByRole('button', { name: /Besoin ou absence/ }).click(); await p.waitForTimeout(300);
  await p.locator('.dialog button', { hasText: 'Mercredi' }).first().click(); await p.waitForTimeout(150);
  await p.locator('.dialog').getByRole('button', { name: 'Enregistrer' }).click(); await p.waitForTimeout(400);
  log('Toast :', await o.toast());
  log('Fiche, besoins :', (await p.locator('.acc', { hasText: 'Besoins personnels' }).innerText()).replace(/\n/g, ' | '));
  await o.cap('a14-01-fiche-besoins-absences', { fullPage: false });
  const avantB = (await o.courante()).besoins.filter((b) => b.personId === id).length;
  await p.locator('.acc', { hasText: 'Besoins personnels' }).locator('button[aria-label="Retirer ce besoin"]').last().click(); await p.waitForTimeout(300);
  log('Retrait d’un besoin : confirmation demandée =', await p.locator('.dialog').count(), '| besoins', avantB, '→', (await o.courante()).besoins.filter((b) => b.personId === id).length, '| toast :', await o.toast());
  log('ERREURS console :', o.errs.join(' || ') || 'aucune');
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
