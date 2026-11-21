const { ouvrir, allerSemaine, dlg } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte, nav, bascule } = await ouvrir({ role: 0 });
  const log = (...a) => console.log(...a);
  const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const poser = async (nom, jour, { type, debut, fin, pause } = {}) => {
    await p.getByRole('button', { name: `Ajouter un poste à ${nom} ${jour}` }).click(); await p.waitForTimeout(250);
    if (type) await p.locator('[role=dialog] .ptc', { hasText: type }).first().click();
    const ins = p.locator('[role=dialog] .dp-horaires input[type=time]');
    if (debut) await ins.nth(0).fill(debut);
    if (fin) await ins.nth(1).fill(fin);
    if (pause === false) await p.locator('[role=dialog] .dp-pause input').uncheck();
    await p.waitForTimeout(150);
    const effets = await texte('[role=dialog] .notice');
    await p.locator('[role=dialog] button', { hasText: 'Enregistrer' }).click(); await p.waitForTimeout(250);
    return effets;
  };
  const ctrl = async () => ({ pills: await texte('[data-tour="controles"] .card-head .pill'), issues: await texte('[data-tour="controles"] .issue'), obj: (await texte('.pg-o .pg-o-mot')).join(' | ') });
  await nav('construire'); await allerSemaine(p, '2026-12-14');
  // 1. Manque de pharmacien
  log('1a effets', await poser('Nicolas L.', 'lundi', { type: 'Ouverture' }));
  let c = await ctrl(); log('1a CONTROLES', JSON.stringify(c, null, 1));
  log('1b effets', await poser('Caroline T.', 'lundi', { type: 'Matin' }));
  c = await ctrl(); log('1b CONTROLES', JSON.stringify(c, null, 1));
  await shot('08-manque-pharmacien', { fullPage: true });
  // Survol de la case objectif du lundi
  await p.locator('.pg-o').nth(1).hover(); await p.waitForTimeout(500);
  log('1b bulle', await p.evaluate(() => document.querySelector('.pg-o[data-aide]')?.getAttribute('data-aide')));
  // 2. Dépassement d'heures : Thomas journée longue du lundi au samedi
  for (const j of JOURS.slice(0, 5)) await poser('Thomas N.', j, { type: 'Journée longue' });
  log('2 effets samedi', await poser('Thomas N.', 'samedi', { type: 'Samedi journée' }));
  c = await ctrl(); log('2 CONTROLES Thomas', c.pills, c.issues.filter((x) => /Thomas/.test(x)));
  log('2 ligne Thomas', await p.evaluate(() => [...document.querySelectorAll('.pg-p')].find((x) => /Thomas/.test(x.innerText))?.innerText.replace(/\s+/g, ' ')));
  // 3. Repos insuffisant : Inès mardi 11:30-19:30 puis mercredi 06:00-12:00
  await poser('Inès D.', 'mardi', { type: 'Fermeture' });
  log('3 effets mercredi', await poser('Inès D.', 'mercredi', { debut: '06:00', fin: '12:00', pause: false }));
  c = await ctrl(); log('3 CONTROLES Inès', c.issues.filter((x) => /Inès/.test(x)));
  await shot('08-controles', { fullPage: true });
  // 4. Pause : 7 h sans pause
  log('4 effets', await poser('Jules P.', 'jeudi', { debut: '08:30', fin: '16:30', pause: false }));
  // 5. Clic sur un constat : la grille signale la ligne
  const issue = p.locator('[data-tour="controles"] .issue', { hasText: 'Inès' }).first();
  await issue.click(); await p.waitForTimeout(400);
  log('5 cases signalées', await p.evaluate(() => [...document.querySelectorAll('.pg-c.flag, .pg-o.flag')].length));
  // 6. Publier avec bloquants
  await p.locator('[data-focus="publier"]').click(); await p.waitForTimeout(400);
  log('6 PUB dlg', await dlg(p));
  log('6 bouton désactivé', await p.locator('[role=dialog] .dialog-foot button.primary').isDisabled());
  await shot('08-publier-bloquants');
  await p.locator('[role=dialog] label.check input').first().check();
  log('6 après « je publie quand même »', await p.locator('[role=dialog] .dialog-foot button.primary').isDisabled());
  await p.keyboard.press('Escape');
  log('errs', errs);
  await b.close();
})();
