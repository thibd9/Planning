// Droits d'un membre de l'équipe : cloche, journée, frise, aide, Solvi.
const { ouvrir } = require('../lib');
(async () => {
  const o = await ouvrir({ role: 3 });
  const { p } = o; const log = [];
  // 1. Cloche « Collègue qui cherche un remplaçant » puis Mon planning
  await p.locator('.outils .top-ico').first().click(); await p.waitForTimeout(300);
  await o.shot('droits-1-cloche');
  log.push('CLOCHE: ' + (await p.locator('.menu.cloche').innerText()).replace(/\n+/g, ' | '));
  await p.locator('.menu.cloche button', { hasText: 'remplaçant' }).click(); await p.waitForTimeout(600);
  log.push('Après clic, titre: ' + await p.title() + ' ; carte aider: ' + await p.locator('[data-focus="aider"]').count());
  await o.shot('droits-2-apres-cloche');
  // 2. Journée du mercredi 18 (arrêt d'Igor) vue par Nicolas
  await p.locator('.lien-jour', { hasText: 'Mercredi' }).first().click(); await p.waitForTimeout(500);
  log.push('\nJOUR 18: ' + (await p.locator('.dialog').innerText()).replace(/\n+/g, ' | ').slice(0, 1500));
  await o.shot('droits-3-jour-18');
  for (let i = 0; i < 8; i++) { await p.locator('.dialog button', { hasText: 'Veille' }).click(); await p.waitForTimeout(150); }
  log.push('\nJOUR 10: ' + (await p.locator('.dialog').innerText()).replace(/\n+/g, ' | ').slice(0, 1800));
  await o.shot('droits-4-jour-10');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // 3. Frise des absences (onglet Absence ou horaire)
  await o.nav('demandes'); await p.locator('#dem-absences').click(); await p.waitForTimeout(400);
  log.push('\nFRISE: ' + (await p.locator('.fc').innerText().catch(() => 'absente')).replace(/\n+/g, ' | ') + ' ; titles: ' + await p.evaluate(() => [...document.querySelectorAll('.fc [title]')].map((e) => e.getAttribute('title')).join(' / ')));
  // 4. Aide : recherche de mots de gestion
  await o.nav('aide');
  for (const m of ['publier', 'résoudre', 'construire', 'paie', 'équipe', 'heures']) {
    await p.locator('#aide-recherche').fill(m); await p.waitForTimeout(300);
    log.push(`\nAIDE « ${m} »: ` + (await p.evaluate(() => [...document.querySelectorAll('.content h3')].map((h) => h.innerText).join(' / '))));
  }
  await p.locator('#aide-recherche').fill('');
  // 5. Solvi
  await p.locator('.aide-fab').click(); await p.waitForTimeout(400);
  const questions = ['Pourquoi Igor est absent ?', 'Igor est malade ?', 'Qui est absent cette semaine ?', 'Combien d’heures fait Thomas cette semaine ?', 'Quel est le taux horaire de Thomas ?', 'Que dois-je décider ?', 'Le planning du mois prochain est-il publié ?', 'Qui travaille le lundi 7 décembre ?', 'Qui a des heures supplémentaires ?', 'Quelle est la clé de secours ?', 'Ouvre résoudre', 'Ouvre mes gardes', 'Qui est de garde le 31 décembre ?', 'Qui travaille demain ?', 'Mon prochain poste ?', 'Combien d’heures je fais cette semaine ?', 'Jules a eu des retards ?', 'Quand travaille Igor mercredi ?'];
  for (const q of questions) {
    await p.locator('#aide-question').fill(q); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
    const rep = await p.evaluate(() => { const b = [...document.querySelectorAll('.aide-bulle.bot')]; return b[b.length - 1]?.innerText.replace(/\n+/g, ' | '); });
    log.push(`\nSOLVI « ${q} » → ${rep}`);
  }
  await o.shot('droits-5-solvi');
  // Le bouton de « Ouvre mes gardes »
  await p.locator('#aide-question').fill('Ouvre mes gardes'); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  const bt = p.locator('.aide-bulle.bot').last().locator('button.btn.primary');
  log.push('\nBouton mes gardes: ' + (await bt.count() ? await bt.innerText() : 'aucun'));
  if (await bt.count()) { await bt.click(); await p.waitForTimeout(600); log.push('Après clic: ' + await p.title() + ' / ' + (await o.texte()).slice(0, 120).replace(/\n+/g, ' ')); }
  log.push('ERR ' + JSON.stringify(o.errs));
  o.ecrire('droits.txt', log.join('\n'));
  console.log(log.join('\n'));
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
