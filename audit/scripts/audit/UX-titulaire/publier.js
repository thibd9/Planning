const ux = require('./ux');
const T = process.env.T || 'd';
const CONF = { d: { w: 1440, h: 900 }, p: { w: 1280, h: 760 }, t: { w: 390, h: 800, tactile: true } }[T];
(async () => { const b = await ux.lancer();
 const { p, errs } = await ux.ouvrir(b, { ...CONF, plie: true });
 await ux.aller(p, 'construire');
 for (let i = 0; i < 2; i++) { await p.locator('[aria-label="Semaine suivante"]').first().click(); await p.waitForTimeout(500); }
 await p.getByRole('button', { name: /Proposer un planning/ }).first().click(); await p.waitForTimeout(2500);
 await p.locator('.dialog button', { hasText: 'Placer dans le brouillon' }).click(); await p.waitForTimeout(1000);
 console.log('toast', await p.evaluate(() => document.querySelector('.toast')?.innerText || 'aucun'));
 await ux.shot(p, `${T}-construire-brouillon`);
 const f = await ux.defiler(p, `${T}-construire-brouillon-def`, { max: 5 });
 await p.evaluate(() => document.getElementById('contenu').scrollTo(0, 0)); await p.waitForTimeout(300);
 await p.getByRole('button', { name: /^Publier/ }).first().click(); await p.waitForTimeout(900);
 await ux.shot(p, `${T}-construire-publier-1`);
 const d = await p.evaluate(() => { const d = [...document.querySelectorAll('.dialog')].pop(); if (!d) return null; const c = d.querySelector('.dialog-body') || d; return { H: c.clientHeight, T: c.scrollHeight, t: d.innerText.slice(0, 1500) }; });
 console.log(JSON.stringify(d));
 if (d && d.T > d.H + 10) { await p.evaluate(() => { const d = [...document.querySelectorAll('.dialog')].pop(); (d.querySelector('.dialog-body') || d).scrollTo(0, 99999); }); await p.waitForTimeout(300); await ux.shot(p, `${T}-construire-publier-2`); }
 // publier pour voir le retour
 const ok = p.locator('.dialog .dialog-foot button.primary, .dialog button.primary').last();
 console.log('bouton', await ok.innerText().catch(() => '?'));
 await ok.click(); await p.waitForTimeout(1000);
 console.log('toast après publication', await p.evaluate(() => document.querySelector('.toast')?.innerText || 'aucun'));
 await ux.shot(p, `${T}-construire-publie`);
 console.log(errs); await b.close(); })().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
