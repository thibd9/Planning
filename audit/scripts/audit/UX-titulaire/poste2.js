const ux = require('./ux');
(async () => { const b = await ux.lancer();
 for (const [t,w,h] of [['d',1440,900],['p',1280,760]]) {
 const { p } = await ux.ouvrir(b, { w, h, plie: true });
 await ux.aller(p, 'officine');
 await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.includes('Planning')).click()); await p.waitForTimeout(500);
 await p.evaluate(() => { const s = [...document.querySelectorAll('details.acc > summary')].find((x) => x.textContent.includes('Postes types')); s.click(); }); await p.waitForTimeout(500);
 console.log(t, await p.evaluate(() => { const e = document.querySelector('.of-defile'); return { client: e.clientWidth, scroll: e.scrollWidth }; }));
 await p.evaluate(() => document.querySelector('.of-defile').scrollIntoView({block:'center'})); await p.waitForTimeout(200);
 await p.locator('[aria-label="Retirer le poste Matin"]').click(); await p.waitForTimeout(400);
 await ux.shot(p, `${t}-officine-poste-retire`);
 console.log(t, 'toast', await p.evaluate(() => document.querySelector('.toast')?.innerText || 'aucun'));
 await p.context().close(); }
 await b.close(); })();
