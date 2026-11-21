// Mes préférences : formes, jours, effacer, M'assister, jour à combler, mois clos, date limite dépassée.
const { ouvrir } = require('../lib');
(async () => {
  const o = await ouvrir({ role: 6 });
  const { p } = o; const log = [];
  const etape = async (nom, fn) => { try { await fn(); } catch (e) { log.push(`!! ÉCHEC ${nom}: ${e.message.split('\n')[0].slice(0, 200)}`); await o.shot(`souhaits-echec-${nom}`); } };
  const txt = async (sel) => (await p.locator(sel).first().innerText()).replace(/\n+/g, ' | ');
  const toast = async () => { await p.waitForTimeout(300); return p.locator('.toast').innerText().then((t) => t.replace(/\n+/g, ' ')).catch(() => '-'); };
  const jour = (n) => p.locator('.sh-mois button.sh-jour').filter({ has: p.locator('.n', { hasText: new RegExp(`^${n}$`) }) }).first();
  const nb = async () => (await o.data()).souhaits.filter((s) => s.personId === 'p_yanis' && s.date.startsWith('2026-12')).length;
  await o.nav('demandes');
  await etape('ouverture', async () => {
    log.push('Onglet par défaut : ' + (await p.locator('.voies [aria-selected="true"]').innerText()).replace(/\n+/g, ' | '));
    log.push('Barre : ' + await txt('.sh-barre'));
    await o.shot('souhaits-1-vide', { fullPage: true });
    await p.locator('#dem-souhaits').click(); await p.waitForTimeout(200);
  });
  await etape('poser', async () => {
    await p.locator('.sh-palette button', { hasText: 'Matin' }).click(); await jour(1).click(); await p.waitForTimeout(200);
    log.push('Après clic 1 déc (Matin) : ' + await jour(1).innerText().then((t) => t.replace(/\n+/g, ' ')) + ' ; statut=' + await txt('.sh-ok') + ' ; données=' + await nb());
    await jour(1).click(); await p.waitForTimeout(200);
    log.push('Re-clic 1 déc : ' + await jour(1).innerText().then((t) => t.replace(/\n+/g, ' ')) + ' ; données=' + await nb());
    await p.locator('.sh-palette button', { hasText: 'Repos' }).click(); await jour(2).click(); await jour(3).click();
    await p.locator('.sh-palette button', { hasText: 'Effacer' }).click(); await jour(3).click(); await p.waitForTimeout(200);
    log.push('2 déc / 3 déc après effacer : ' + await jour(2).innerText().then((t) => t.replace(/\n+/g, ' ')) + ' / ' + await jour(3).innerText().then((t) => t.replace(/\n+/g, ' ')) + ' ; données=' + await nb());
    log.push('Détail du jour choisi : ' + await txt('.sh-detail'));
    // jour fermé, jour absent
    log.push('6 déc (dimanche) : ' + await p.locator('.sh-mois .sh-jour.off').first().innerText().then((t) => t.replace(/\n+/g, ' ')));
  });
  await etape('assister', async () => {
    await p.locator('[data-focus="assister"]').click(); log.push('M’assister : ' + await toast() + ' ; données=' + await nb());
    log.push('Barre : ' + await txt('.sh-barre'));
    log.push('Bouton M’assister grisé : ' + await p.locator('[data-focus="assister"]').isDisabled());
    await o.shot('souhaits-2-assiste', { fullPage: true });
    const choix = (await o.data()).souhaits.filter((s) => s.personId === 'p_yanis' && s.date.startsWith('2026-12')).map((s) => `${s.date.slice(8)}:${s.choix}`);
    log.push('Choix posés : ' + choix.join(' '));
  });
  await etape('combler', async () => {
    const court = p.locator('.sh-mois button.sh-jour:has(.sh-aider)').first();
    if (await court.count()) { await p.locator('.sh-palette button', { hasText: 'Journée' }).click(); const t = await court.innerText(); await court.click(); await p.waitForTimeout(200); log.push(`Jour court (${t.replace(/\n+/g, ' ')}) → détail : ` + await txt('.sh-detail')); const b = p.locator('.sh-detail button', { hasText: 'Je peux venir' }).first(); if (await b.count()) { await b.click(); log.push('Je peux venir : ' + await toast() + ' ; détail : ' + await txt('.sh-detail')); } await o.shot('souhaits-3-combler'); } else log.push('Aucun jour signalé « l’équipe ne suffit pas »');
  });
  await etape('mois', async () => {
    await p.getByRole('button', { name: 'Mois précédent' }).click(); await p.waitForTimeout(200);
    log.push('Novembre : ' + await txt('.sh-barre') + ' ; palette grisée=' + await p.locator('.sh-palette button').first().isDisabled());
    await jour(25).click(); await p.waitForTimeout(150); log.push('Clic 25 nov (clos) → données nov=' + (await o.data()).souhaits.filter((s) => s.personId === 'p_yanis' && s.date.startsWith('2026-11')).length + ' ; détail=' + await txt('.sh-detail'));
    await o.shot('souhaits-4-novembre-clos');
    await p.getByRole('button', { name: 'Mois suivant' }).click(); await p.getByRole('button', { name: 'Mois suivant' }).click(); await p.waitForTimeout(200);
    log.push('Janvier : ' + await txt('.sh-barre'));
    await jour(4).click(); await p.waitForTimeout(150); log.push('Clic 4 janv. : données janv.=' + (await o.data()).souhaits.filter((s) => s.personId === 'p_yanis' && s.date.startsWith('2027-01')).length);
    for (let i = 0; i < 14; i++) await p.getByRole('button', { name: 'Mois suivant' }).click();
    log.push('Mars 2028 : ' + await txt('.sh-barre'));
  });
  // Après la date limite : Caroline avance la limite au 15
  await o.profil('Titulaire 1');
  await etape('limite', async () => { await o.nav('officine'); await p.locator('#souhaits-limite').selectOption('15'); await p.waitForTimeout(300); log.push('\nLimite mise au 15 : ' + await p.locator('#souhaits-limite').inputValue()); });
  await o.profil('Étudiant');
  await etape('apres-limite', async () => {
    await o.nav('demandes');
    log.push('Carte préférences : ' + await txt('#dem-souhaits'));
    log.push('Onglet par défaut : ' + (await p.locator('.voies [aria-selected="true"]').innerText()).replace(/\n+/g, ' | '));
    await p.locator('#dem-souhaits').click(); await p.waitForTimeout(300);
    log.push('Barre : ' + await txt('.sh-barre'));
    await p.getByRole('button', { name: 'Mois précédent' }).click(); await p.waitForTimeout(200);
    log.push('Décembre après la limite : ' + await txt('.sh-barre') + ' ; Équipe : ' + await txt('.sh-grille aside .card:last-child'));
    await o.shot('souhaits-5-decembre-clos', { fullPage: true });
  });
  log.push('ERR ' + JSON.stringify(o.errs));
  o.ecrire('souhaits.txt', log.join('\n'));
  console.log(log.join('\n'));
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
