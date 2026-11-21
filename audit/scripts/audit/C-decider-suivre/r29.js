// Rendez-vous décliné ; demande de Nicolas vers Caroline (sens inverse).
const { ouvrir } = require('./lib');
(async () => {
  const o = await ouvrir({ role: 3 }); const { p } = o;
  await o.nav('messages'); await p.locator('.msg-fil', { hasText: 'Caroline' }).click(); await p.locator('#rdv-demander').click(); await p.waitForTimeout(400);
  console.log('sujets Nicolas', await p.locator('#rdv-sujet').innerText());
  await p.locator('#rdv-envoyer').click(); await p.waitForTimeout(400);
  await o.profil('Titulaire 1');
  console.log('badge messages Caroline', await p.evaluate(() => document.querySelector('[data-tour="nav-messages"]')?.innerText.replace(/\n/g, ' ')));
  await o.nav('tableau'); console.log('tableau rdv', await p.evaluate(() => [...document.querySelectorAll('.rdv-liste li')].map((e) => e.innerText.replace(/\n/g, ' ')).join(' / ')));
  await o.nav('messages');
  console.log('fil ouvert', await p.locator('.card-head h2').first().innerText());
  await p.locator('.rdv-carte button', { hasText: 'Décliner' }).click(); await p.waitForTimeout(400);
  const d = await o.data(); console.log('rdv', d.rendezVous[0].statut, '| message', d.messages.slice(-1)[0].texte, '| toast', await p.evaluate(() => document.querySelector('[class*=toast]')?.innerText));
  console.log('carte', (await p.locator('.rdv-carte').innerText()).replace(/\n/g, ' | '));
  await o.b.close();
})();
