const ux = require('./ux');
(async () => { const b = await ux.lancer();
 for (const [t,w,h,tact] of [['d',1440,900,false],['t',390,800,true]]) {
 const { p } = await ux.ouvrir(b, { w, h, plie: true, tactile: tact });
 await ux.aller(p, 'journal');
 await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Fiche navette').click()); await p.waitForTimeout(800);
 const f = await ux.defiler(p, `${t}-journal-navette`, { max: 8 });
 if (t === 't') ux.assembler(f.slice(0, 4), `${ux.DIR}/t-journal-navette-A.png`, 4);
 console.log(t, JSON.stringify(await ux.mesurer(p)).slice(0, 1200));
 await ux.aller(p, 'journal');
 await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Journal').click()); await p.waitForTimeout(500);
 await p.evaluate(() => [...document.querySelectorAll('summary')].find((x) => x.textContent.includes('24 règles')).click()); await p.waitForTimeout(600);
 await ux.shot(p, `${t}-journal-regles`);
 const dl = p.waitForEvent('download', { timeout: 4000 }).catch(() => null);
 await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Exporter le dossier')).click()); const d = await dl; await p.waitForTimeout(600);
 console.log(t, 'export', d ? d.suggestedFilename() : 'aucun téléchargement', await p.evaluate(() => document.querySelector('.toast')?.innerText || 'pas de message'), await p.evaluate(() => !!document.querySelector('.dialog')));
 await ux.shot(p, `${t}-journal-export`);
 await p.context().close(); }
 await b.close(); })().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
