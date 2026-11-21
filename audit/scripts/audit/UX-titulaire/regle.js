const ux = require('./ux');
(async () => { const b = await ux.lancer();
 for (const [t,w,h,tact] of [['d',1440,900,false],['t',390,800,true]]) {
 const { p } = await ux.ouvrir(b, { w, h, plie: true, tactile: tact });
 await ux.aller(p, 'regles');
 for (const nom of ['Durée hebdomadaire maximale', 'Nombre de pharmaciens']) {
  await p.evaluate((nom) => { const s = [...document.querySelectorAll('summary, button')].find((x) => x.textContent.includes(nom)); s.click(); s.scrollIntoView({block:'start'}); document.getElementById('contenu').scrollBy(0,-90); }, nom); await p.waitForTimeout(600);
  await ux.shot(p, `${t}-regles-${nom.split(' ')[0]}-${nom.split(' ')[2]}`);
 }
 await p.evaluate(() => [...document.querySelectorAll('[role=tab], .seg button, button')].find((x) => /^Réglables/.test(x.textContent.trim()))?.click()); await p.waitForTimeout(500);
 await p.evaluate(() => document.getElementById('contenu').scrollTo(0,0)); await ux.shot(p, `${t}-regles-filtre`);
 await p.context().close(); }
 await b.close(); })();
