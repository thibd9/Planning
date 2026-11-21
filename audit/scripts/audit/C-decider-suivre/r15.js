// Heures : l'écran, et le recalcul à la main pour toute l'équipe (postes publiés et contrat).
const { ouvrir } = require('./lib');
(async () => {
  const o = await ouvrir({ role: 0 }); const { p } = o;
  await o.nav('heures'); await p.waitForTimeout(400);
  const txt = await p.locator('main, .content').first().innerText();
  console.log(txt.replace(/\n+/g, ' | ').slice(0, 3000));
  await o.shot('r15-heures', { fullPage: true });
  const d = await o.data();
  require('fs').writeFileSync(__dirname + '/etat-heures.json', JSON.stringify(d));
  await o.b.close();
})();
