// Messages : à toute l'équipe, à une personne, l'ordre des conversations, la lecture côté destinataire.
const { ouvrir, dialogue } = require('./lib');
const fils = (p) => p.evaluate(() => [...document.querySelectorAll('.msg-fils > *')].map((e) => e.innerText.replace(/\n+/g, ' ')).filter(Boolean));
(async () => {
  const o = await ouvrir({ role: 0 }); const { p } = o;
  await o.nav('messages');
  console.log('FIL OUVERT', await p.locator('.card-head h2').first().innerText());
  console.log('CONVERSATIONS', JSON.stringify(await fils(p)));
  await o.shot('r13-messages');
  console.log('envoyer vide désactivé', await p.locator('form button[type=submit]').isDisabled());
  await p.fill('#msg-texte', '    '); console.log('espaces seuls désactivé', await p.locator('form button[type=submit]').isDisabled());
  // à toute l'équipe
  await p.locator('.msg-fil', { hasText: 'Toute l’équipe' }).click(); await p.waitForTimeout(200);
  await p.fill('#msg-texte', 'Réunion d’équipe lundi à 13 h 30.'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  console.log('Entrée envoie ?', (await o.data()).messages.length);
  await p.locator('form button[type=submit]').click(); await p.waitForTimeout(300);
  // à Thomas (pas de message) puis à Nicolas
  await p.locator('.msg-fil', { hasText: 'Thomas' }).click(); await p.fill('#msg-texte', 'Thomas, peux-tu passer me voir ?'); await p.locator('form button[type=submit]').click(); await p.waitForTimeout(300);
  await p.locator('.msg-fil', { hasText: 'Nicolas' }).click(); await p.fill('#msg-texte', 'Oui Nicolas, mercredi après 17 h c’est possible.'); await p.locator('form button[type=submit]').click(); await p.waitForTimeout(300);
  console.log('CONVERSATIONS après', JSON.stringify(await fils(p)));
  const d = await o.data(); console.log('messages', JSON.stringify(d.messages.map((m) => [m.de, m.a, m.texte.slice(0, 50), m.luPar])));
  await o.shot('r13-apres-envoi');
  // Créer > message ?
  await p.getByRole('button', { name: /Créer/ }).first().click(); await p.waitForTimeout(300);
  console.log('MENU CRÉER', await p.evaluate(() => [...document.querySelectorAll('[role=menu] *, .menu *')].map((e) => e.innerText).filter(Boolean).slice(0, 12).join(' | ')));
  await p.keyboard.press('Escape');
  // Nicolas lit
  await o.profil('Préparateur');
  console.log('NICOLAS badge', await p.evaluate(() => document.querySelector('[data-tour="nav-messages"]')?.innerText.replace(/\n/g, ' ')));
  await o.nav('messages');
  console.log('NICOLAS fil ouvert', await p.locator('.card-head h2').first().innerText(), '| conversations', JSON.stringify(await fils(p)));
  await o.shot('r13-nicolas');
  await p.locator('.msg-fil', { hasText: 'Toute l’équipe' }).click(); await p.waitForTimeout(300);
  console.log('NICOLAS fil équipe', (await p.locator('.fil').innerText()).replace(/\n+/g, ' | '));
  await p.fill('#msg-texte', 'Bien reçu, merci.'); await p.locator('form button[type=submit]').click(); await p.waitForTimeout(300);
  await o.profil('Titulaire 1'); await o.nav('messages');
  console.log('CAROLINE après réponse', await p.locator('.card-head h2').first().innerText(), '| conversations', JSON.stringify(await fils(p)));
  console.log('ERR', o.errs); await o.b.close();
})();
