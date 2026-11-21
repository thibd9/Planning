// Revue mobile : chaque écran de chaque rôle à la largeur d'un téléphone. Débordements, textes coupés, cibles trop petites.
const { chromium } = require('playwright');
(async () => {
  const W = +(process.env.W || 360), H = +(process.env.H || 760);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, locale: 'fr-FR', deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:5180/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(700);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(400);
  if (process.env.CAPTURES) await p.screenshot({ path: `shots/mb-decouvrir.png` });
  await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').first().click(); await p.waitForTimeout(700);
  let soucis = 0, ecrans = 0; const captures = (process.env.CAPTURES || '').split(',').filter(Boolean);
  const releve = async (nom) => {
    await p.waitForTimeout(450); ecrans++;
    const r = await p.evaluate(() => {
      const W = innerWidth; const out = [];
      const visible = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
      const defile = (e) => { for (let x = e.parentElement; x; x = x.parentElement) { const s = getComputedStyle(x); if (/(auto|scroll)/.test(s.overflowX) && x.scrollWidth > x.clientWidth + 1) return x; } return null; };
      if (document.documentElement.scrollWidth > W + 1) out.push(`PAGE déborde de ${document.documentElement.scrollWidth - W}px`);
      // Ce qui défile horizontalement : sur téléphone, rien ne devrait, hors rangées de pastilles prévues pour.
      for (const e of document.querySelectorAll('.content *, .topbar *, .bandeau-test, .tabbar, .side')) { const s = getComputedStyle(e); if (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 4 && visible(e)) out.push(`DÉFILE ${e.className.toString().slice(0, 40)} (${e.scrollWidth - e.clientWidth}px)`); }
      // Ce qui sort de l'écran sans pouvoir être atteint.
      for (const e of document.querySelectorAll('.content button, .content a, .content input, .content select, .content h1, .content h2, .content h3, .content .card, .content .pill, .topbar button')) { if (!visible(e) || defile(e)) continue; const r = e.getBoundingClientRect(); if (r.right > W + 2 || r.left < -2) out.push(`HORS ÉCRAN ${e.tagName.toLowerCase()}.${e.className.toString().slice(0, 30)} « ${(e.textContent || '').trim().slice(0, 24)} » ${Math.round(r.left)}→${Math.round(r.right)}`); }
      // Textes coupés par des points de suspension.
      for (const e of document.querySelectorAll('.content h1, .content h2, .content h3, .content b, .content .btn, .content p, .content span, .topbar *')) { if (!visible(e) || e.children.length > 3) continue; const s = getComputedStyle(e); if (s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) out.push(`COUPÉ « ${(e.textContent || '').trim().slice(0, 34)} » (${e.className.toString().slice(0, 24)})`); }
      // Boutons trop petits pour le doigt.
      for (const e of document.querySelectorAll('.content button, .content a.btn, .topbar button, .tabbar button, .side button')) { if (!visible(e)) continue; const r = e.getBoundingClientRect(); if ((r.width < 32 || r.height < 32) && !e.closest('.pg-c, .plan-grid, .frise, .rat-pl')) out.push(`PETIT ${Math.round(r.width)}×${Math.round(r.height)} « ${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)} » (${e.className.toString().slice(0, 20)})`); }
      // Deux boutons qui se chevauchent.
      const bs = [...document.querySelectorAll('.content .btn, .topbar button')].filter(visible).map((e) => [e, e.getBoundingClientRect()]);
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const [a, ra] = bs[i], [c, rc] = bs[j]; if (a.contains(c) || c.contains(a)) continue; const ox = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left), oy = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top); if (ox > 4 && oy > 4) out.push(`CHEVAUCHE « ${a.textContent.trim().slice(0, 16)} » / « ${c.textContent.trim().slice(0, 16)} »`); }
      return [...new Set(out)];
    });
    soucis += r.length; console.log(`${r.length ? '!!' : 'ok'} ${nom}${r.length ? '\n     ' + r.slice(0, 9).join('\n     ') : ''}`);
    if (captures.some((c) => nom.includes(c))) await p.screenshot({ path: `shots/mb-${nom.replace(/[^a-zA-Z0-9]+/g, '-')}.png` });
  };
  const vues = async (role) => {
    await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); await p.locator('.bandeau-test button', { hasText: role }).first().click(); await p.waitForTimeout(600);
    const liens = await p.evaluate(() => [...new Set([...document.querySelectorAll('[data-tour^="nav-"]')].map((e) => e.getAttribute('data-tour')))]);
    for (const l of liens) { const ok = await p.evaluate((sel) => { const e = [...document.querySelectorAll(`[data-tour="${sel}"]`)].find((x) => x.getBoundingClientRect().width > 0) ?? document.querySelector(`[data-tour="${sel}"]`); if (!e) return false; e.click(); return true; }, l); if (ok) await releve(`${role} ${l.replace('nav-', '')}`); }
  };
  await releve('Titulaire tableau');
  for (const r of (process.env.ROLES || 'Titulaire 1,Préparateur').split(',')) await vues(r);
  console.log(`\n${W}px : ${soucis} souci(s) sur ${ecrans} écrans ; erreurs ${errs.length}`);
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 5).join('\n')); process.exit(1); });
