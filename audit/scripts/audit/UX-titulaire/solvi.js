const ux = require('./ux');
(async () => { const b = await ux.lancer();
 for (const [t,w,h,tact] of [['d',1440,900,false],['t',390,800,true]]) {
 const { p } = await ux.ouvrir(b, { w, h, plie: true, tactile: tact }); await ux.aller(p, 'construire');
 const r = await p.evaluate(() => { const a = document.querySelector('.assistant'); const r = a.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; });
 console.log(t, 'assistant', r);
 await p.evaluate(() => document.querySelector('.assistant button').click()); await p.waitForTimeout(700);
 await ux.shot(p, `${t}-solvi`);
 await p.context().close(); }
 await b.close(); })();
