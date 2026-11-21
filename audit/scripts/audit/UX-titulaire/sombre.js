const ux = require('./ux');
(async () => { const b = await ux.lancer(); const { p } = await ux.ouvrir(b, { plie: true, mode: 'sombre' }); await ux.aller(p, 'construire');
 console.log(await p.evaluate(() => { const e = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Semaine' && x.getBoundingClientRect().width > 0); const s = getComputedStyle(e); const lab = e; return { color: s.color, bg: s.backgroundColor, img: s.backgroundImage.slice(0, 80), cls: e.className, pressed: e.getAttribute('aria-pressed') || e.getAttribute('aria-selected') }; }));
 await ux.aller(p, 'equipe');
 console.log(await p.evaluate(() => { const e = [...document.querySelectorAll('button, span')].find((x) => x.textContent.trim() === 'Vaccination' && x.getBoundingClientRect().width > 0); const s = getComputedStyle(e); let bg = s.backgroundColor; for (let x = e; x; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (!/rgba\(0, 0, 0, 0\)/.test(c)) { bg = c + ' sur ' + x.className; break; } } return { color: s.color, bg }; }));
 await ux.shot(p, 's-equipe-competences', { clip: { x: 260, y: 300, width: 1180, height: 600 } });
 await b.close(); })();
