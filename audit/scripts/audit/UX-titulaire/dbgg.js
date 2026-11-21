const ux = require('./ux');
(async () => { const b = await ux.lancer(); const { p } = await ux.ouvrir(b, { plie: true }); await ux.aller(p, 'gardes');
console.log(await p.evaluate(() => [...document.querySelectorAll('.cal-g')].map((x) => JSON.stringify(x.textContent)).join(' ')));
await b.close(); })();
