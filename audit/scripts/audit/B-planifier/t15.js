const { ouvrir, allerSemaine, dlg } = require('./h.js');
const W = +(process.env.W || 1280), H = +(process.env.H || 760), MODE = process.env.MODE;
(async () => {
  const { b, p, errs, shot, data, texte, nav } = await ouvrir({ role: 0, w: W, h: H, mode: MODE });
  const log = (...a) => console.log(...a);
  const tag = `${W}x${H}${MODE ? '-' + MODE : ''}`;
  const mesure = async (nom) => {
    const r = await p.evaluate(() => {
      const Wd = innerWidth; const out = [];
      const visible = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const defile = (e) => { for (let x = e.parentElement; x; x = x.parentElement) { const s = getComputedStyle(x); if (/(auto|scroll)/.test(s.overflowX) && x.scrollWidth > x.clientWidth + 1) return x; } return null; };
      if (document.documentElement.scrollWidth > Wd + 1) out.push(`PAGE déborde de ${document.documentElement.scrollWidth - Wd}px`);
      const racine = document.querySelector('[role=dialog]') || document;
      for (const e of racine.querySelectorAll('button, a, input, select, h1, h2, h3, .pill')) { if (!visible(e) || defile(e)) continue; const r = e.getBoundingClientRect(); if (r.right > Wd + 2 || r.left < -2) out.push(`HORS ÉCRAN ${e.tagName.toLowerCase()} « ${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30)} » ${Math.round(r.left)}→${Math.round(r.right)}`); }
      for (const e of racine.querySelectorAll('h1, h2, h3, b, .btn, p, span, label')) { if (!visible(e) || e.children.length > 3) continue; const s = getComputedStyle(e); if (s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) out.push(`COUPÉ « ${(e.textContent || '').trim().slice(0, 40)} »`); }
      for (const e of racine.querySelectorAll('button, a.btn, input, select')) { if (!visible(e)) continue; const r = e.getBoundingClientRect(); if ((r.width < 24 || r.height < 24) && !e.closest('.pg-c, .plan-grid, .mo, .frise')) out.push(`PETIT ${Math.round(r.width)}×${Math.round(r.height)} « ${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)} »`); }
      return [...new Set(out)].slice(0, 14);
    });
    log(`${r.length ? '!!' : 'ok'} [${tag}] ${nom}${r.length ? '\n     ' + r.join('\n     ') : ''}`);
    await shot(`15-${tag}-${nom}`);
  };
  await mesure('tableau');
  await nav('construire'); await allerSemaine(p, '2026-11-30'); await mesure('construire-semaine');
  // défilement de la grille
  log('grille scrollWidth/clientWidth', await p.evaluate(() => { const g = document.querySelector('.plan-scroll'); return g ? `${g.scrollWidth}/${g.clientWidth}` : '-'; }));
  await p.evaluate(() => document.querySelector('[data-tour="controles"]')?.scrollIntoView()); await p.waitForTimeout(300); await mesure('construire-controles');
  await p.evaluate(() => document.querySelector('.plan-grid .pg-c .tile')?.click()); await p.waitForTimeout(400); await mesure('dlg-poste');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('[data-tour="proposer"]')?.click()); await p.waitForTimeout(400);
  await p.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((x) => /Calculer les propositions/.test(x.textContent))?.click());
  await p.waitForSelector('[role=dialog] .variant', { timeout: 60000 }); await mesure('dlg-propositions');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  // publier les modifs : faire une retouche d'abord
  await p.evaluate(() => document.querySelector('.plan-grid .pg-c .tile')?.click()); await p.waitForTimeout(300);
  await p.locator('[role=dialog] .dp-horaires input[type=time]').nth(1).fill('15:00'); await p.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Enregistrer')?.click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-focus="publier"]')?.click()); await p.waitForTimeout(400); await mesure('dlg-publier-modifs');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.pg-h .jour-btn')?.click()); await p.waitForTimeout(400); await mesure('dlg-journee');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('[aria-label="Imprimer le planning"]')?.click()); await p.waitForTimeout(500); await mesure('dlg-impression');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => [...document.querySelectorAll('.ph-outils button')].find((x) => /Mois/.test(x.textContent))?.click()); await p.waitForTimeout(600); await mesure('construire-mois');
  await nav('gardes'); await mesure('gardes');
  await p.evaluate(() => [...document.querySelectorAll('.page-head button')].find((x) => /Ajouter/.test(x.textContent))?.click()); await p.waitForTimeout(400); await mesure('dlg-garde');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => [...document.querySelectorAll('.page-head button')].find((x) => /Répartir/.test(x.textContent))?.click()); await p.waitForTimeout(400); await mesure('dlg-repartir');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => [...document.querySelectorAll('.page-head button')].find((x) => /Importer/.test(x.textContent))?.click()); await p.waitForTimeout(400); await mesure('dlg-import');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.top-creer')?.click()); await p.waitForTimeout(200);
  await p.evaluate(() => [...document.querySelectorAll('.menu button')].find((x) => /formation/.test(x.textContent))?.click()); await p.waitForTimeout(500); await mesure('dlg-formation');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.top-creer')?.click()); await p.waitForTimeout(200);
  await p.evaluate(() => [...document.querySelectorAll('.menu button')].find((x) => /inventaire/.test(x.textContent))?.click()); await p.waitForTimeout(500); await mesure('dlg-inventaire');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await nav('tableau');
  await p.evaluate(() => document.querySelector('.outils .top-ico, .top-ico')?.click()); await p.waitForTimeout(300); await mesure('cloche');
  log('errs', errs);
  await b.close();
})();
