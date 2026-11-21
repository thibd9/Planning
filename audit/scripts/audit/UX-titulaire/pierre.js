// Titulaire secondaire : une décision part en accord ; ce que voient Pierre puis Caroline.
const ux = require('./ux');
(async () => {
  const b = await ux.lancer();
  const { p, errs } = await ux.ouvrir(b, { role: 1, plie: true });
  await ux.aller(p, 'resoudre');
  await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim().startsWith('Demandes')).click()); await p.waitForTimeout(600);
  await p.getByRole('button', { name: /^Décider/ }).first().click(); await p.waitForTimeout(800);
  await ux.shot(p, 'r1-decider');
  await p.locator('.dialog button, .dialog label', { hasText: /Accepter la demande/ }).first().click(); await p.waitForTimeout(500);
  await ux.shot(p, 'r1-decider-choisi');
  const ok = p.locator('.dialog .dialog-foot button.primary, .dialog button.primary').last();
  console.log('bouton', await ok.innerText());
  await ok.click(); await p.waitForTimeout(900);
  console.log('toast', await p.evaluate(() => document.querySelector('.toast')?.innerText || 'aucun'));
  await ux.shot(p, 'r1-apres-decision');
  await p.evaluate(() => document.getElementById('contenu').scrollTo(0, 0));
  console.log('onglets', await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].map((x) => x.textContent.trim()).join(' | ')));
  const t = await p.evaluate(() => { const e = [...document.querySelectorAll('[role=tab]')].find((x) => /accord/i.test(x.textContent)); e?.click(); return !!e; }); await p.waitForTimeout(600);
  console.log('onglet accord présent', t); await ux.shot(p, 'r1-en-attente');
  // Passer à Caroline
  await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(300); await p.locator('.bandeau-test button, .menu button, [role=dialog] button', { hasText: 'Titulaire 1' }).first().click(); await p.waitForTimeout(900);
  await ux.aller(p, 'tableau'); await ux.shot(p, 'r0-tableau-accord');
  await ux.aller(p, 'resoudre'); await p.waitForTimeout(400); await ux.shot(p, 'r0-resoudre-accord');
  console.log('onglets Caroline', await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].map((x) => x.textContent.trim()).join(' | ')));
  console.log(errs);
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
