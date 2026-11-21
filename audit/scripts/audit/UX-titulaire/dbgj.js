const ux = require('./ux');
(async () => { const b = await ux.lancer(); const { p } = await ux.ouvrir(b, { plie: true }); await ux.aller(p, 'journal');
console.log(await p.evaluate(() => [...document.querySelectorAll('.content button, .content summary, .content [role=button]')].map((x) => x.tagName + ':' + x.textContent.trim().slice(0, 30)).join(' | ')));
await b.close(); })();
