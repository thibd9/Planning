// La semaine entière tient dans la largeur : aucune colonne coupée, aucun défilement horizontal.
const { ouvrir } = require('./lib');
(async () => {
  let ko = 0;
  for (const w of (process.env.W || '2000,1728,1440,1280,1100,1024,900,768,600,390').split(',').map(Number)) {
    const { b, p, nav } = await ouvrir({ w, h: 900, mode: process.env.MODE, url: process.env.URL || 'http://localhost:5180/' });
    if (process.env.TEXTE) { await p.evaluate(() => { document.documentElement.dataset.texte = 'grand'; }); }
    if (await p.locator('.tab[data-tab="construire"]').isVisible()) await p.locator('.tab[data-tab="construire"]').click(); else await nav('construire'); await p.waitForTimeout(500);
    const mesure = async (quoi) => {
      const m = await p.evaluate(() => { const s = document.querySelector('.plan-scroll'); const g = document.querySelector('.plan-grid'); const h = [...g.querySelectorAll('.pg-h')]; const der = h[h.length - 1].getBoundingClientRect(); const c = s.getBoundingClientRect();
        const coupes = [...g.querySelectorAll('.tile .th')].filter((t) => { const r = t.getBoundingClientRect(); const tu = t.closest('.tile').getBoundingClientRect(); return r.right > tu.right + 0.5 || r.left < tu.left - 0.5; }).length;
        const deborde = [...g.querySelectorAll('.tile, .jour-btn, .jour-voir, .pg-o-mot, .pg-sum > *, .pg-p .nm')].filter((t) => { const r = t.getBoundingClientRect(); const par = t.parentElement.getBoundingClientRect(); const cell = t.closest('.pg-c, .pg-h, .pg-o, .pg-sum, .pg-p')?.getBoundingClientRect() ?? par; return r.width > 2 && (r.right > c.right + 1 || r.right > cell.right + 1.5 || r.left < cell.left - 1.5); }).length;
        const lesquels = [...g.querySelectorAll('.tile, .jour-btn, .jour-voir, .pg-o-mot, .pg-sum > *, .pg-p .nm')].filter((t) => { const r = t.getBoundingClientRect(); const par = t.parentElement.getBoundingClientRect(); const cell = t.closest('.pg-c, .pg-h, .pg-o, .pg-sum, .pg-p')?.getBoundingClientRect() ?? par; return r.width > 2 && (r.right > c.right + 1 || r.right > cell.right + 1.5 || r.left < cell.left - 1.5); }).slice(0, 3).map((t) => `${t.className.slice(0, 30)} ${Math.round(t.getBoundingClientRect().left)}-${Math.round(t.getBoundingClientRect().right)} / ${Math.round(c.right)} cellule ${Math.round((t.closest('.pg-c, .pg-h, .pg-o, .pg-sum, .pg-p') ?? t.parentElement).getBoundingClientRect().left)}-${Math.round((t.closest('.pg-c, .pg-h, .pg-o, .pg-sum, .pg-p') ?? t.parentElement).getBoundingClientRect().right)}`);
        return { lesquels, defile: s.scrollWidth - s.clientWidth, page: document.documentElement.scrollWidth - innerWidth, dernier: Math.round(der.right - c.right), col: Math.round(h[1].getBoundingClientRect().width), tuiles: g.querySelectorAll('.tile').length, coupes, deborde }; });
      const ok = m.defile <= 1 && m.page <= 1 && m.dernier <= 1 && m.coupes === 0 && m.deborde === 0; if (!ok) ko++;
      console.log(String(w).padStart(5), quoi.padEnd(8), ok ? 'ok ' : 'KO ', JSON.stringify(m));
    };
    await mesure('heures');
    if (process.env.CAPTURE) await p.locator('.plan').first().screenshot({ path: `shots/grille-${w}${process.env.MODE || ''}.png` });
    for (const l of ['Équité']) { await p.locator('.plan').getByRole('button', { name: l, exact: true }).click(); await p.waitForTimeout(350); await mesure(l.toLowerCase()); }
    await b.close();
  }
  console.log(ko ? `${ko} mesure(s) en défaut` : 'la semaine tient partout');
})();
