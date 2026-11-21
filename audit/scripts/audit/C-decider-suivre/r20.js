// Documents : onglets, plannings publiés, dépôt (setInputFiles), suppression, reçus de l'équipe, historique.
const { ouvrir, dialogue } = require('./lib');
const F = __dirname + '/fichiers/';
const toast = (p) => p.evaluate(() => document.querySelector('[class*=toast]')?.innerText);
(async () => {
  const o = await ouvrir({ role: 0 }); const { p } = o;
  await o.nav('documents'); await p.waitForTimeout(400);
  console.log('ONGLETS', await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].map((b) => b.innerText.replace(/\n/g, ' ')).join(' / ')));
  console.log('PLANNINGS', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(0, 1200));
  await o.shot('r20-plannings');
  await p.locator('.doc button', { hasText: /Ouvrir|Voir/ }).first().click(); await p.waitForTimeout(500);
  console.log(' -> ouvre', await p.evaluate(() => document.querySelector('h1')?.innerText), '|', await p.evaluate(() => document.querySelector('.week-nav .label, h2')?.innerText?.slice(0, 60)));
  await o.nav('documents');
  await p.locator('[role=tab]', { hasText: 'Mes absences' }).click(); await p.waitForTimeout(200);
  console.log('MES ABSENCES', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(300, 700));
  await p.locator('[role=tab]', { hasText: 'Mes fichiers' }).click(); await p.waitForTimeout(200);
  console.log('MES FICHIERS', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(300, 1100));
  await o.shot('r20-fichiers-vide');
  const input = p.locator('input[type=file]').first();
  await input.setInputFiles(F + 'notes.txt'); await p.waitForTimeout(400); console.log(' txt ->', await p.locator('.erreur, [role=alert], .notice.danger').first().innerText().catch(() => '(pas de message)'));
  await input.setInputFiles(F + 'gros.pdf'); await p.waitForTimeout(400); console.log(' gros pdf ->', await p.locator('.erreur, [role=alert], .notice.danger').first().innerText().catch(() => '(pas de message)'));
  await input.setInputFiles(F + 'arret-test.pdf'); await p.waitForTimeout(600); console.log(' pdf -> toast', await toast(p));
  await input.setInputFiles(F + 'photo.png'); await p.waitForTimeout(1200); console.log(' png -> toast', await toast(p));
  console.log(' LISTE', (await p.locator('.doc-liste, ul.card').last().innerText().catch(() => '')).replace(/\n+/g, ' | '));
  await o.shot('r20-fichiers-deposes');
  let d = await o.data(); console.log(' données', JSON.stringify((d.documents ?? []).map((x) => [x.nom, x.categorie, x.partage, x.taille, x.data.slice(0, 30)])));
  // Ouvrir (lien de téléchargement)
  let dl = null; p.on('download', (x) => { dl = x; });
  await p.locator('.doc a', { hasText: 'Ouvrir' }).first().click(); await p.waitForTimeout(800);
  console.log(' Ouvrir -> download', !!dl, dl ? dl.suggestedFilename() : '');
  // Rechargement : les fichiers restent ?
  await p.reload(); await p.waitForTimeout(800); await o.nav('documents'); await p.locator('[role=tab]', { hasText: 'Mes fichiers' }).click(); await p.waitForTimeout(200);
  console.log(' après rechargement', await p.locator('.doc').count(), 'documents');
  // Supprimer
  await p.locator('[aria-label^="Supprimer"]').first().click(); await p.waitForTimeout(400);
  console.log(' suppression : fenêtre de confirmation ?', (await dialogue(p)).slice(0, 100) || 'aucune', '| toast', await toast(p), '| reste', await p.locator('.doc').count());
  // Reçus de l'équipe : Nicolas dépose un document partagé
  await o.profil('Préparateur'); await o.nav('documents'); await p.locator('[role=tab]', { hasText: 'Mes fichiers' }).click(); await p.waitForTimeout(200);
  console.log('NICOLAS fichiers', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(300, 900));
  await p.locator('input[type=file]').first().setInputFiles(F + 'arret-test.pdf'); await p.waitForTimeout(600);
  d = await o.data(); console.log(' doc Nicolas', JSON.stringify((d.documents ?? []).filter((x) => x.personId === 'p_camille').map((x) => [x.nom, x.categorie, x.partage])));
  await o.profil('Titulaire 1'); await o.nav('documents');
  await p.locator('[role=tab]', { hasText: 'Reçus' }).click(); await p.waitForTimeout(300);
  console.log('CAROLINE reçus', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(300, 900));
  await o.shot('r20-recus');
  await p.locator('[role=tab]', { hasText: 'Absences de l’équipe' }).click(); await p.waitForTimeout(300);
  console.log('HISTORIQUE', (await p.locator('main, .content').first().innerText()).replace(/\n+/g, ' | ').slice(300, 1800));
  await o.shot('r20-historique', { fullPage: true });
  console.log('ERR', o.errs); await o.b.close();
})();
