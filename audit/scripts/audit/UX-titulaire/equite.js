const ux = require('./ux');
(async () => { const b = await ux.lancer();
 const { p } = await ux.ouvrir(b, { plie: true });
 await ux.aller(p, 'equite');
 // déplier Yanis
 await p.evaluate(() => { const e = [...document.querySelectorAll('summary, button')].find((x) => x.textContent.includes('Yanis M.')); e.click(); }); await p.waitForTimeout(600);
 await ux.shot(p, 'd-equite-yanis');
 for (const o of ['Gardes et astreintes', 'Demandes refusées']) { await p.evaluate((o) => [...document.querySelectorAll('button,[role=tab]')].find((x) => x.textContent.trim() === o).click(), o); await p.waitForTimeout(600); await p.evaluate(() => document.getElementById('contenu').scrollTo(0, 0)); await ux.shot(p, 'd-equite-' + o.split(' ')[0]); }
 await p.evaluate(() => { const e = [...document.querySelectorAll('summary')].find((x) => x.textContent.includes('Comment c')); e.click(); e.scrollIntoView({block:'start'}); }); await p.waitForTimeout(500); await ux.shot(p, 'd-equite-calcul');
 await b.close(); })();
