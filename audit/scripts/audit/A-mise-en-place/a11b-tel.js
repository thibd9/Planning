// A11b : ce que voit un téléphone 390×800 pendant la création (sans pleine page) et la cause du débordement.
const { lancer } = require('./outils');
(async () => {
  const o = await lancer({ w: 390, h: 800 }); const { p, cap } = o; const log = (...a) => console.log(...a);
  await p.getByRole('button', { name: /Créer ma pharmacie/ }).click(); await p.waitForTimeout(400);
  const larges = () => p.evaluate(() => [...document.querySelectorAll('.accueil-form *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 2 && e.children.length < 6).slice(0, 6).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)} → ${Math.round(e.getBoundingClientRect().right)}px`));
  log('Étape 1, éléments qui dépassent :', (await larges()).join(' ; '));
  log('Étape 1, largeur document :', await p.evaluate(() => document.documentElement.scrollWidth), '| défilement horizontal possible :', await p.evaluate(() => { scrollTo(300, 0); const x = scrollX || document.scrollingElement.scrollLeft; scrollTo(0, 0); return x; }));
  await cap('e-390-creation-1-ecran');
  await p.locator('#choix-apparence').scrollIntoViewIfNeeded(); await p.waitForTimeout(200); await cap('e-390-creation-1-apparence');
  await p.fill('#officine-nom', 'Test'); await p.locator('.accueil-actions button[type=submit]').click(); await p.waitForTimeout(400);
  log('Étape 2, éléments qui dépassent :', (await larges()).join(' ; '));
  await cap('e-390-creation-2-ecran');
  await p.locator('#tit-identifiant').scrollIntoViewIfNeeded(); await p.waitForTimeout(200); await cap('e-390-creation-2-identifiant');
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
