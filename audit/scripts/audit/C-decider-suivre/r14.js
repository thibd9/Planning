// Rendez-vous : demander (Caroline → Nicolas), accepter, proposer un autre horaire, annuler ; agenda et plannings des deux.
const { ouvrir, dialogue } = require('./lib');
const toast = (p) => p.evaluate(() => document.querySelector('[class*=toast]')?.innerText);
(async () => {
  const o = await ouvrir({ role: 0 }); const { p } = o;
  await o.nav('messages');
  await p.locator('.msg-fil', { hasText: 'Nicolas' }).click(); await p.waitForTimeout(200);
  await p.locator('#rdv-demander').click(); await p.waitForTimeout(400);
  console.log('DIALOGUE RDV', (await dialogue(p)).replace(/\n+/g, ' | '));
  await o.shot('r14-dialogue-rdv');
  // cas limites
  await p.fill('#rdv-date', '2026-11-10'); await p.waitForTimeout(200); console.log('date passée', await p.inputValue('#rdv-date'), '|', await p.locator('#rdv-avis').innerText(), '| envoyer actif', !(await p.locator('#rdv-envoyer').isDisabled()));
  await p.fill('#rdv-date', '2026-11-22'); await p.waitForTimeout(200); console.log('dimanche', '|', (await p.locator('#rdv-avis').innerText()).replace(/\n/g, ' '), '| envoyer actif', !(await p.locator('#rdv-envoyer').isDisabled()));
  await p.selectOption('#rdv-avec', 'p_karim'); await p.fill('#rdv-date', '2026-11-20'); await p.fill('#rdv-debut', '23:00'); await p.waitForTimeout(200); console.log('Igor absent aujourd’hui', (await p.locator('#rdv-avis').innerText()).replace(/\n/g, ' '));
  await p.selectOption('#rdv-avec', 'p_camille'); await p.waitForTimeout(200);
  await p.locator('.rdv-idees button').first().click(); await p.waitForTimeout(200);
  await p.selectOption('#rdv-sujet', { index: 0 }); await p.fill('#rdv-note', 'Point sur tes horaires du mercredi.');
  console.log('choisi', (await p.locator('#rdv-avis').innerText()).replace(/\n/g, ' '), '| sujet', await p.locator('#rdv-sujet').inputValue());
  await p.locator('#rdv-envoyer').click(); await p.waitForTimeout(500);
  console.log('toast', await toast(p));
  let d = await o.data(); let r = d.rendezVous[0]; console.log('RDV', JSON.stringify(r), '| msg', d.messages.slice(-1)[0].texte);
  console.log('CARTE côté Caroline', (await p.locator('.rdv-carte').first().innerText()).replace(/\n+/g, ' | '));
  await o.shot('r14-carte-caroline');
  // Nicolas : propose un autre horaire
  await o.profil('Préparateur'); await o.nav('messages');
  await p.locator('.msg-fil', { hasText: 'Caroline' }).click(); await p.waitForTimeout(300);
  console.log('CARTE côté Nicolas', (await p.locator('.rdv-carte').first().innerText()).replace(/\n+/g, ' | '));
  await p.locator('.rdv-carte button', { hasText: 'Proposer un autre horaire' }).click(); await p.waitForTimeout(400);
  console.log('AUTRE HORAIRE', (await dialogue(p)).replace(/\n+/g, ' | ').slice(0, 900));
  await p.locator('.rdv-idees button').nth(1).click(); await p.waitForTimeout(200);
  await p.locator('#rdv-envoyer').click(); await p.waitForTimeout(500);
  console.log('toast', await toast(p));
  d = await o.data(); r = d.rendezVous[0]; console.log('RDV', JSON.stringify([r.statut, r.date, r.start, r.end, r.attend]), '| msg', d.messages.slice(-1)[0].texte);
  // Caroline accepte
  await o.profil('Titulaire 1'); await o.nav('messages');
  await p.locator('.msg-fil', { hasText: 'Nicolas' }).click(); await p.waitForTimeout(300);
  const cartes = await p.locator('.rdv-carte').count(); console.log('nb cartes rdv dans la conversation', cartes);
  console.log('CARTES', JSON.stringify(await p.locator('.rdv-carte').allInnerTexts()));
  await o.shot('r14-cartes-caroline');
  await p.locator('.rdv-carte button', { hasText: 'Accepter' }).first().click(); await p.waitForTimeout(500);
  console.log('toast', await toast(p));
  d = await o.data(); r = d.rendezVous[0]; console.log('RDV', JSON.stringify([r.statut, r.date, r.start, r.end]), '| annonce', d.annonces[0].titre, JSON.stringify(d.annonces[0].pour));
  // Agenda et plannings
  await o.nav('tableau'); await p.waitForTimeout(400);
  console.log('TABLEAU rdv', await p.evaluate(() => [...document.querySelectorAll('.rdv-liste li')].map((e) => e.innerText.replace(/\n/g, ' ')).join(' / ')));
  await o.nav('construire'); await p.waitForTimeout(500);
  console.log('CONSTRUIRE pastilles rdv', await p.evaluate(() => [...document.querySelectorAll('.pg-rdv')].map((e) => e.getAttribute('title')).join(' / ')));
  await o.shot('r14-construire-rdv');
  await o.nav('moi'); await p.waitForTimeout(400);
  console.log('MON PLANNING Caroline puces', await p.evaluate(() => [...document.querySelectorAll('.rdv-puce')].map((e) => e.innerText.replace(/\n/g, ' ')).join(' / ')));
  await o.profil('Préparateur'); await o.nav('moi'); await p.waitForTimeout(400);
  console.log('MON PLANNING Nicolas puces', await p.evaluate(() => [...document.querySelectorAll('.rdv-puce')].map((e) => e.innerText.replace(/\n/g, ' ')).join(' / ')));
  await o.shot('r14-nicolas-planning', { fullPage: true });
  await o.nav('espace'); await p.waitForTimeout(400);
  console.log('ESPACE Nicolas rdv', await p.evaluate(() => [...document.querySelectorAll('.rdv-liste li')].map((e) => e.innerText.replace(/\n/g, ' ')).join(' / ')));
  // Nicolas annule
  await o.nav('messages'); await p.locator('.msg-fil', { hasText: 'Caroline' }).click(); await p.waitForTimeout(300);
  await p.locator('.rdv-carte button', { hasText: 'Annuler le rendez-vous' }).first().click(); await p.waitForTimeout(400);
  console.log('toast annulation', await toast(p));
  d = await o.data(); r = d.rendezVous[0]; console.log('RDV', r.statut, '| msg', d.messages.slice(-1)[0].texte, '| annonces', d.annonces[0].titre);
  console.log('ERR', o.errs); await o.b.close();
})();
