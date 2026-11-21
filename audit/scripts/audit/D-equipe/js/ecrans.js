// Téléphone 390×800, tablette 820×1180, portable 1280×760 : chaque écran de l'équipe et quelques fenêtres. Débordements, textes coupés, cibles trop petites.
const { ouvrir } = require('../lib');
const { chromium } = require('playwright');
const releve = (p) => p.evaluate(() => {
  const W = innerWidth; const out = [];
  const visible = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const defile = (e) => { for (let x = e.parentElement; x; x = x.parentElement) { const s = getComputedStyle(x); if (/(auto|scroll)/.test(s.overflowX) && x.scrollWidth > x.clientWidth + 1) return x; } return null; };
  if (document.documentElement.scrollWidth > W + 1) out.push(`PAGE déborde de ${document.documentElement.scrollWidth - W}px`);
  const racine = document.querySelector('.dialog') || document;
  for (const e of racine.querySelectorAll('.content *, .dialog *')) { const s = getComputedStyle(e); if (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 4 && visible(e)) out.push(`DÉFILE ${e.className.toString().slice(0, 40)} (${e.scrollWidth - e.clientWidth}px)`); }
  for (const e of racine.querySelectorAll('button, a, input, select, h1, h2, h3, .card, .pill, textarea')) { if (!visible(e) || defile(e)) continue; const r = e.getBoundingClientRect(); if (r.right > W + 2 || r.left < -2) out.push(`HORS ÉCRAN ${e.tagName.toLowerCase()}.${e.className.toString().slice(0, 30)} « ${(e.textContent || '').trim().slice(0, 24)} » ${Math.round(r.left)}→${Math.round(r.right)}`); }
  for (const e of racine.querySelectorAll('h1, h2, h3, b, .btn, p, span, label')) { if (!visible(e) || e.children.length > 3) continue; const s = getComputedStyle(e); if (s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) out.push(`COUPÉ « ${(e.textContent || '').trim().slice(0, 34)} » (${e.className.toString().slice(0, 24)})`); }
  for (const e of racine.querySelectorAll('.content button, .content a.btn, .topbar button, .tabbar button, .dialog button')) { if (!visible(e)) continue; const r = e.getBoundingClientRect(); if ((r.width < 32 || r.height < 32) && !e.closest('.pg-c, .plan-grid, .frise, .rat-pl')) out.push(`PETIT ${Math.round(r.width)}×${Math.round(r.height)} « ${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)} » (${e.className.toString().slice(0, 20)})`); }
  const bs = [...racine.querySelectorAll('.btn, .topbar button')].filter(visible).map((e) => [e, e.getBoundingClientRect()]);
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const [a, ra] = bs[i], [c, rc] = bs[j]; if (a.contains(c) || c.contains(a)) continue; const ox = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left), oy = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top); if (ox > 4 && oy > 4) out.push(`CHEVAUCHE « ${a.textContent.trim().slice(0, 16)} » / « ${c.textContent.trim().slice(0, 16)} »`); }
  return [...new Set(out)];
});
(async () => {
  const b = await chromium.launch();
  const tailles = (process.env.TAILLES || '390x800,820x1180,1280x760').split(',');
  const log = [];
  for (const t of tailles) {
    const [w, h] = t.split('x').map(Number);
    for (const role of [3, 2, 4]) {
      const o = await ouvrir({ role, w, h, b, tactile: w < 900 });
      const { p } = o; const tag = `${t}-r${role}`;
      const clic = (sel) => p.evaluate((s) => { const e = [...document.querySelectorAll(s)].find((x) => x.getBoundingClientRect().width > 0) ?? document.querySelector(s); e?.click(); return !!e; }, sel);
      if (role === 3) log.push(`\n### ${t} barre du bas : ` + await p.evaluate(() => { const tb = document.querySelector('.tabbar'); return tb && getComputedStyle(tb).display !== 'none' ? [...tb.querySelectorAll('button')].map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ') : 'absente'; }));
      const vues = role === 3 ? ['espace', 'moi', 'demandes', 'suivi', 'documents', 'planning', 'messages', 'aide'] : role === 2 ? ['espace', 'mesgardes'] : ['espace'];
      for (const v of vues) {
        await clic(`[data-tour="nav-${v}"]`); await p.waitForTimeout(500);
        if (v === 'demandes') {
          for (const on of ['souhaits', 'absences', 'remplacements']) { await clic(`#dem-${on}`); await p.waitForTimeout(350); const r = await releve(p); log.push(`${r.length ? '!!' : 'ok'} ${tag} demandes/${on}${r.length ? '\n     ' + r.slice(0, 10).join('\n     ') : ''}`); await o.shot(`ecran-${tag}-demandes-${on}`, { fullPage: true }); }
          continue;
        }
        const r = await releve(p); log.push(`${r.length ? '!!' : 'ok'} ${tag} ${v}${r.length ? '\n     ' + r.slice(0, 10).join('\n     ') : ''}`);
        await o.shot(`ecran-${tag}-${v}`, { fullPage: true });
      }
      if (role === 3) {
        // Compte (menu du compte)
        await p.locator('.compte-btn').click(); await p.waitForTimeout(250); await o.shot(`ecran-${tag}-menu-compte`); await p.getByRole('button', { name: 'Mon compte', exact: true }).click(); await p.waitForTimeout(500);
        let r = await releve(p); log.push(`${r.length ? '!!' : 'ok'} ${tag} compte${r.length ? '\n     ' + r.slice(0, 10).join('\n     ') : ''}`); await o.shot(`ecran-${tag}-compte`, { fullPage: true });
        // Fenêtres
        const fenetre = async (nom, ouvrirFn) => { await ouvrirFn(); await p.waitForTimeout(450); const r2 = await releve(p); log.push(`${r2.length ? '!!' : 'ok'} ${tag} fenêtre ${nom}${r2.length ? '\n     ' + r2.slice(0, 10).join('\n     ') : ''}`); await o.shot(`ecran-${tag}-fen-${nom}`); await p.keyboard.press('Escape'); await p.waitForTimeout(300); };
        await clic('[data-tour="nav-demandes"]'); await p.waitForTimeout(300); await clic('#dem-absences'); await p.waitForTimeout(300);
        await fenetre('nouvelle-demande', async () => { await p.locator('.card-head button', { hasText: 'Nouvelle demande' }).click(); });
        await clic('#dem-remplacements'); await p.waitForTimeout(300);
        await fenetre('remplacer', async () => { await p.locator('.dm', { hasText: 'Ven. 27 novembre' }).locator('button').last().click(); });
        await clic('[data-tour="nav-espace"]'); await p.waitForTimeout(400);
        await fenetre('retard', async () => { await p.locator('#ret-prevenir').first().click(); });
        await fenetre('signaler', async () => { await p.locator('#top-signaler').click(); await p.waitForTimeout(200); await p.locator('label[for="sg-absence"]').click(); });
        await clic('[data-tour="nav-moi"]'); await p.waitForTimeout(400);
        await fenetre('journee', async () => { await p.locator('.lien-jour').nth(3).click(); });
        await fenetre('rdv', async () => { await clic('[data-tour="nav-espace"]'); await p.waitForTimeout(300); await p.locator('#esp-rdv-demander').click(); });
        // Menu volet sur téléphone
        if (w < 900) { await p.locator('.tabbar .burger').click(); await p.waitForTimeout(400); await o.shot(`ecran-${tag}-volet`); log.push(`${tag} volet : ` + (await p.locator('.side').innerText()).replace(/\n+/g, ' | ')); await p.locator('.side-tete button').click().catch(() => {}); }
        // cloche
        await p.locator('.outils .top-ico').first().click(); await p.waitForTimeout(300); const rc = await releve(p); log.push(`${rc.length ? '!!' : 'ok'} ${tag} cloche ouverte${rc.length ? '\n     ' + rc.slice(0, 6).join('\n     ') : ''}`); await o.shot(`ecran-${tag}-cloche`); await p.keyboard.press('Escape');
      }
      await o.ctx.close();
    }
  }
  // Thème sombre : accueil et Mon planning, téléphone et bureau
  for (const [w, h] of [[390, 800], [1440, 900]]) {
    const o = await ouvrir({ role: 3, w, h, b, mode: 'sombre', tactile: w < 900 });
    for (const v of ['espace', 'moi', 'demandes']) { await o.p.evaluate((s) => { const e = [...document.querySelectorAll(`[data-tour="nav-${s}"]`)].find((x) => x.getBoundingClientRect().width > 0) ?? document.querySelector(`[data-tour="nav-${s}"]`); e?.click(); }, v); await o.p.waitForTimeout(500); await o.shot(`sombre-${w}-${v}`, { fullPage: w < 900 }); }
    log.push(`sombre ${w} : fond=${await o.p.evaluate(() => getComputedStyle(document.body).backgroundColor)} data-mode=${await o.p.evaluate(() => document.documentElement.dataset.mode || document.documentElement.className)}`);
    await o.ctx.close();
  }
  require('fs').writeFileSync(`${__dirname}/../ecrans.txt`, log.join('\n'));
  console.log(log.join('\n'));
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message); process.exit(1); });
