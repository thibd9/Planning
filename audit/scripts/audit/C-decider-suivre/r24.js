// Solvi : vingt-cinq questions réalistes de titulaire.
const { ouvrir } = require('./lib');
const Q = ['qui travaille demain ?', 'combien d’heures a fait Thomas ce mois-ci ?', 'comment publier ?', 'Léa est malade demain', 'qui est absent cette semaine ?', 'quel pharmacien est là samedi ?', 'qui ferme lundi ?', 'qu’est-ce que je dois décider aujourd’hui ?', 'quand travaille Nicolas ?', 'Igor est là lundi ?', 'qui est de garde le 29 novembre ?', 'combien d’heures sup cette semaine ?', 'où en est le compteur de Yanis ?', 'comment refuser un congé ?', 'Thomas s’est blessé à la réserve', 'je serai en retard de 10 minutes', 'faire rattraper des heures à Yanis', 'comment exporter la fiche navette ?', 'combien de samedis a fait Yanis ?', 'on est assez nombreux ?', 'qui est en congé en décembre ?', 'combien font 151,67 / 4', 'de 8h30 à 19h30 ça fait combien d’heures ?', 'comment ajouter une personne', 'qui travaille avec moi demain ?', 'qui est en retard aujourd’hui ?', 'remplacemnt de nicolas', 'quelles demandes de congé sont en attente ?'];
(async () => {
  const o = await ouvrir({ role: 0 }); const { p } = o;
  await p.locator('.aide-fab').click(); await p.waitForTimeout(400);
  await o.shot('r24-solvi-ouvert');
  for (const q of Q) {
    const n = await p.locator('.aide-bulle.bot').count();
    await p.fill('#aide-question', q); await p.keyboard.press('Enter');
    await p.waitForFunction((k) => document.querySelectorAll('.aide-bulle.bot:not(.attente)').length > k, n, { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(150);
    const r = await p.evaluate(() => { const b = [...document.querySelectorAll('.aide-bulle.bot:not(.attente)')].pop(); return b ? b.innerText.replace(/\n+/g, ' | ') : ''; });
    console.log(`Q « ${q} »\n   R ${r.slice(0, 600)}`);
  }
  await o.shot('r24-solvi-fin');
  console.log('ERR', o.errs); await o.b.close();
})();
