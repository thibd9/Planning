// Résoudre > Absences : les options proposées pour le poste d'Igor du 20/11, la fenêtre « Voir et choisir la solution ».
const { ouvrir, dialogue } = require('./lib');
(async () => {
  const { b, p, errs, data, nav, shot } = await ouvrir({ role: 0 });
  await nav('resoudre');
  const opts = await p.evaluate(() => [...document.querySelectorAll('.options .option')].map((o) => o.innerText.replace(/\n+/g, ' | ')));
  console.log('OPTIONS CARTE', opts.length); opts.forEach((o) => console.log(' -', o.slice(0, 400)));
  await shot('r1-carte-absence', { fullPage: true });
  await p.getByRole('button', { name: /Voir et choisir la solution/ }).click(); await p.waitForTimeout(600);
  console.log('DIALOGUE', (await dialogue(p)).slice(0, 3000));
  await shot('r1-dialogue-reglage');
  console.log('ERR', errs);
  await b.close();
})();
