// Derniers contrôles : retard pendant le poste, heures de Thomas, rechargement, annulation, bouton Précédent du navigateur, Solvi.
const { ouvrir } = require('../lib');
(async () => {
  const log = [];
  let o = await ouvrir({ role: 4, heure: '2026-11-20T10:00:00' }); let p = o.p;
  await p.locator('#ret-prevenir').first().click(); await p.waitForTimeout(300);
  log.push('Sarah 10 h, retard : ' + (await p.locator('.dialog').innerText()).replace(/\n+/g, ' | ').slice(0, 300));
  await o.shot('fin-1-retard-pendant-poste');
  await o.b.close();
  o = await ouvrir({ role: 3 }); p = o.p;
  const d = await o.data();
  const min = (s) => s.end - s.start - ((s.pauseEnd ?? 0) - (s.pauseStart ?? 0));
  const t = d.semaines['2026-11-16'].snapshot.filter((s) => s.personId === 'p_thomas').reduce((a, s) => a + min(s), 0);
  log.push(`Thomas semaine 16/11 publiée : ${t / 60} h ; contrat 35 h`);
  // annulation par le toast
  await o.nav('demandes'); await p.locator('#dem-absences').click(); await p.locator('.card-head button', { hasText: 'Nouvelle demande' }).click(); await p.waitForTimeout(300);
  await p.locator('#demande-motif').selectOption('repos'); await p.locator('.dialog label.field', { hasText: 'Type de besoin' }).locator('select').selectOption('absence');
  await p.locator('.dialog label.field', { hasText: 'Premier jour' }).locator('input').fill('2026-12-21'); await p.locator('.dialog label.field', { hasText: 'Dernier jour' }).locator('input').fill('2026-12-24');
  await p.locator('.dialog button.primary', { hasText: 'Envoyer' }).click(); await p.waitForTimeout(300);
  const n1 = (await o.data()).absences.length;
  await p.locator('.toast button', { hasText: 'Annuler' }).click(); await p.waitForTimeout(300);
  const n2 = (await o.data()).absences.length;
  log.push(`Annuler (toast) après envoi d’une demande : absences ${n1} → ${n2}`);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
  // rechargement
  await o.nav('suivi');
  await p.reload(); await p.waitForTimeout(900);
  log.push('Après rechargement : titre=' + await p.title() + ' ; profil=' + (await p.locator('.compte-btn').innerText().catch(() => '?')).replace(/\n+/g, ' '));
  // Précédent du navigateur
  await o.nav('moi'); await o.nav('messages');
  await p.goBack().catch(() => {}); await p.waitForTimeout(700);
  log.push('Après « Précédent » : url=' + p.url() + ' ; titre=' + await p.title());
  await o.shot('fin-2-precedent');
  log.push('ERR ' + JSON.stringify(o.errs));
  console.log(log.join('\n'));
  o.ecrire('fin.txt', log.join('\n'));
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
