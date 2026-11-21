const ux = require('./ux');
(async () => { const b = await ux.lancer(); const { p } = await ux.ouvrir(b, { plie: true }); await ux.aller(p, 'documents');
 await p.getByRole('button', { name: /^Voir/ }).first().click(); await p.waitForTimeout(900);
 console.log('après Voir : titre', await p.evaluate(() => document.querySelector('.page-head h1')?.textContent), 'fenêtre', await p.evaluate(() => document.querySelector('.dialog h2')?.textContent || 'aucune'));
 await ux.shot(p, 'd-documents-voir');
 await b.close(); })();
