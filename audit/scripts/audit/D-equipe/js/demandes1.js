// « Nouvelle demande » côté préparateur : chaque champ, chaque erreur, puis l'envoi de plusieurs demandes.
const { ouvrir } = require('../lib');
(async () => {
  const o = await ouvrir({ role: 3 });
  const { p } = o; const log = [];
  const D = '.dialog';
  const etat = async (lib) => {
    const bt = p.locator(`${D} button.btn.primary`, { hasText: 'Envoyer au responsable' });
    const dis = await bt.isDisabled();
    const title = await bt.getAttribute('title');
    const alertes = await p.evaluate(() => [...document.querySelectorAll('.dialog .notice, .dialog [role=alert], .dialog .erreur')].map((e) => e.innerText.replace(/\s+/g, ' ')).join(' / '));
    log.push(`${lib} → bouton ${dis ? 'GRISÉ' : 'actif'}${title ? ` (title: ${title})` : ''}${alertes ? ` ; messages: ${alertes}` : ''}`);
    return !dis;
  };
  const ouvrirDialogue = async () => { await o.nav('demandes'); await p.locator('#dem-absences').click(); await p.waitForTimeout(300); await p.locator('.card-head button', { hasText: 'Nouvelle demande' }).click(); await p.waitForTimeout(400); };
  const genre = (v) => p.locator(`${D} label.field`, { hasText: 'Type de besoin' }).locator('select').selectOption(v);
  const motif = (v) => p.locator('#demande-motif').selectOption(v);
  const jour = (j) => p.locator(`${D} fieldset button`, { hasText: new RegExp(`^${j}$`) }).click();
  const date = (lib) => p.locator(`${D} label.field`, { hasText: lib }).locator('input[type=date]');
  const envoyer = async () => { const bt = p.locator(`${D} button.btn.primary`, { hasText: 'Envoyer au responsable' }); if (await bt.isDisabled()) { log.push('   NON ENVOYABLE, on ferme'); await p.locator(`${D} button`, { hasText: 'Annuler' }).click(); return; } await bt.click(); await p.waitForTimeout(400); log.push('   toast: ' + (await p.locator('.toast').innerText().catch(() => '-'))); };

  await ouvrirDialogue();
  await o.shot('dem-1-dialogue', { fullPage: false });
  log.push('Sélecteur nature (absence) : ' + JSON.stringify(await p.evaluate(() => 0)));
  await etat('Ouverture (aucun jour, aucune raison)');
  await jour('mercredi'); await etat('Jour mercredi, sans raison');
  await motif('famille'); await etat('Jour mercredi + raison famille');
  // plage perso inversée
  await p.locator(`${D} label.field`, { hasText: 'Partie de la journée' }).locator('select').selectOption('perso'); await p.waitForTimeout(150);
  await p.locator(`${D} label.field`, { hasText: /^De$/ }).locator('input').fill('15:00'); await p.locator(`${D} label.field`, { hasText: /^À$/ }).locator('input').fill('12:00'); await p.waitForTimeout(150);
  await etat('Plage 15:00 → 12:00 (fin avant début)');
  await o.shot('dem-2-plage-inversee');
  // finir avant, heure vide
  await genre('finir_avant'); await p.waitForTimeout(150); await jour('mercredi');
  await p.locator(`${D} label.field`, { hasText: 'Finir avant' }).locator('input').fill(''); await p.waitForTimeout(150);
  await etat('Finir avant, heure vide');
  await p.locator(`${D} label.field`, { hasText: 'Finir avant' }).locator('input').fill('16:00');
  await date('À partir du').fill('2026-12-10'); await date('Jusqu’au').fill('2026-12-01'); await p.waitForTimeout(150);
  await etat('Finir avant 16:00 mercredi, du 10/12 au 01/12 (fin avant début)');
  await o.shot('dem-3-fin-avant-debut');
  await p.locator(`${D} label.field`, { hasText: 'Importance' }).locator('select').selectOption('prioritaire'); await p.waitForTimeout(150);
  await etat('… importance prioritaire');
  await envoyer();
  // Jour précis dans le passé
  await ouvrirDialogue(); await motif('administratif'); await genre('jour'); await p.waitForTimeout(150);
  await date('Date').fill('2026-11-10'); await p.waitForTimeout(150);
  await etat('Un jour précis : 10/11/2026 (passé)');
  await envoyer();
  // Absence : fin avant début, puis dates passées, puis normale
  await ouvrirDialogue(); await motif('repos'); await genre('absence'); await p.waitForTimeout(150);
  log.push('Natures proposées : ' + (await p.locator(`${D} label.field`, { hasText: 'Nature' }).locator('option').allInnerTexts()).join(', '));
  await date('Premier jour').fill('2026-12-18'); await date('Dernier jour').fill('2026-12-14'); await p.waitForTimeout(150);
  await etat('Absence du 18/12 au 14/12');
  await o.shot('dem-4-absence-inversee');
  await date('Premier jour').fill('2026-11-02'); await date('Dernier jour').fill('2026-11-03'); await p.waitForTimeout(150);
  await etat('Absence du 02/11 au 03/11 (passé)');
  await envoyer();
  await ouvrirDialogue(); await motif('repos'); await genre('absence'); await p.waitForTimeout(150);
  await date('Premier jour').fill('2026-12-14'); await date('Dernier jour').fill('2026-12-18'); await p.waitForTimeout(200);
  await etat('Congé du 14/12 au 18/12');
  await o.shot('dem-5-conge');
  await envoyer();
  // Plafond des prioritaires : une deuxième demande prioritaire
  await ouvrirDialogue(); await motif('sante'); await genre('commencer_apres'); await p.waitForTimeout(150); await jour('lundi');
  await p.locator(`${D} label.field`, { hasText: 'Importance' }).locator('select').selectOption('prioritaire'); await p.waitForTimeout(150);
  await etat('Commencer après, lundi, prioritaire (plafond ?)');
  await o.shot('dem-6-plafond');
  await p.locator(`${D} button`, { hasText: 'Annuler' }).click();
  // Préréglage Chabbat
  await ouvrirDialogue(); await p.locator(`${D} button`, { hasText: 'Chabbat' }).click(); await p.waitForTimeout(150);
  log.push('Après Chabbat : raison = ' + await p.locator('#demande-motif').inputValue() + ' ; type = ' + await p.locator(`${D} label.field`, { hasText: 'Type de besoin' }).locator('select').inputValue());
  await etat('Chabbat');
  await envoyer();
  // Double clic sur Envoyer
  await ouvrirDialogue(); await motif('personnel'); await jour('samedi');
  await p.locator(`${D} button.btn.primary`, { hasText: 'Envoyer au responsable' }).dblclick().catch((e) => log.push('dblclick: ' + e.message.slice(0, 80)));
  await p.waitForTimeout(400);
  const d = await o.data();
  log.push('\nBESOINS Nicolas : ' + JSON.stringify(d.besoins.filter((b) => b.personId === 'p_camille').map((b) => [b.forme, b.jours, b.heure, b.plageStart, b.plageEnd, b.from, b.to, b.statut, b.decision, b.motif])));
  log.push('ABSENCES Nicolas : ' + JSON.stringify(d.absences.filter((b) => b.personId === 'p_camille').map((b) => [b.type, b.from, b.to, b.statut, b.motif])));
  await o.nav('demandes'); await p.locator('#dem-absences').click(); await p.waitForTimeout(300);
  log.push('\nLISTE :\n' + (await o.texte()).split('Nouvelle demande')[1]?.slice(0, 3000));
  await o.shot('dem-7-liste', { fullPage: true });
  log.push('ERR ' + JSON.stringify(o.errs));
  o.ecrire('demandes1.txt', log.join('\n'));
  // garder l'état pour la suite
  o.ecrire('etat-demandes.json', JSON.stringify(await p.evaluate(() => ({ v3: localStorage.getItem('releve.v3'), ui: Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])) }))));
  console.log(log.join('\n'));
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
