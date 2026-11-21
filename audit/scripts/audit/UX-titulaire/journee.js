const ux = require('./ux');
(async () => { const b = await ux.lancer();
 for (const [t,w,h,tact] of [['d',1440,900,false],['t',390,800,true]]) {
 const { p } = await ux.ouvrir(b, { w, h, plie: true, tactile: tact });
 await ux.aller(p, 'construire');
 await p.evaluate(() => { const j = [...document.querySelectorAll('.jour-btn')].find((x) => x.getBoundingClientRect().width > 0); j.click(); }); await p.waitForTimeout(900);
 await ux.shot(p, `${t}-journee-1`);
 const d = await p.evaluate(() => { const d = [...document.querySelectorAll('.dialog')].pop(); const c = d.querySelector('.dialog-body') || d; return { H: c.clientHeight, T: c.scrollHeight }; });
 console.log(t, JSON.stringify(d));
 let k=1; for (let y = d.H - 60; y < d.T && k < 6; y += d.H - 60) { await p.evaluate((y) => { const d = [...document.querySelectorAll('.dialog')].pop(); (d.querySelector('.dialog-body') || d).scrollTo(0, y); }, y); await p.waitForTimeout(250); k++; await ux.shot(p, `${t}-journee-${k}`); }
 console.log(JSON.stringify(await ux.mesurer(p, '.dialog')).slice(0,1500));
 await p.context().close(); }
 await b.close(); })();
