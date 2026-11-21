const ux = require('./ux');
(async () => { const b = await ux.lancer();
 const { p } = await ux.ouvrir(b, { plie: true });
 await ux.aller(p, 'regles');
 await p.evaluate(() => { const s = [...document.querySelectorAll('summary, button')].find((x) => x.textContent.includes('Durée hebdomadaire maximale')); s.click(); }); await p.waitForTimeout(500);
 const inp = p.locator('input[aria-label="Seuil de la règle Durée hebdomadaire maximale"]'); await inp.fill('44'); await inp.press('Tab'); await p.waitForTimeout(500);
 console.log('toast:', await p.evaluate(() => document.querySelector('.toast')?.innerText || 'aucun'));
 await ux.shot(p, 'd-regles-modif');
 await b.close(); })();
