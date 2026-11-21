// Outils de la revue UX-equipe-transversal : ouvrir l'application (vierge ou sous un profil), capturer, faire défiler, mesurer.
const { chromium } = require('playwright');
const fs = require('fs');
const DIR = __dirname;
const IDS = ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste', 'sarah.lemoine', 'manon.girard', 'yanis.morel', 'lea.fontaine'];
exports.ouvrir = async ({ role = 3, w = 1440, h = 900, mode, heure = '2026-11-20T10:00:00', tactile = false, vierge = false, b: bExist } = {}) => {
  const b = bExist ?? (await chromium.launch());
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'fr-FR', deviceScaleFactor: 1, ...(tactile || w < 600 ? { hasTouch: true, isMobile: true } : {}) });
  if (heure) await ctx.clock.setFixedTime(new Date(heure));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('PAGE ' + e.message)); p.on('console', (m) => (m.type() === 'error') && errs.push(m.text().slice(0, 300)));
  p.on('dialog', (d) => { errs.push('DIALOG ' + d.message()); d.accept().catch(() => {}); });
  await p.goto('http://localhost:5180/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  if (mode) await p.evaluate(([m, ids]) => { const o = {}; for (const id of ids) o[id] = { theme: 'ciel', texte: 'normal', mode: m }; localStorage.setItem('releve.preferences', JSON.stringify(o)); }, [mode, IDS]);
  if (!vierge) {
    await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(400); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').nth(role).click(); await p.waitForTimeout(800);
    if (mode) { await p.evaluate(([m, ids]) => { const o = {}; for (const id of ids) o[id] = { theme: 'ciel', texte: 'normal', mode: m }; localStorage.setItem('releve.preferences', JSON.stringify(o)); }, [mode, IDS]); await p.reload(); await p.waitForTimeout(800); }
  }
  const nav = async (v) => { const ok = await p.evaluate((v) => { const e = [...document.querySelectorAll(`[data-tour="nav-${v}"]`)].find((x) => x.getBoundingClientRect().width > 0) ?? document.querySelector(`[data-tour="nav-${v}"]`); if (!e) return false; e.click(); return true; }, v); await p.waitForTimeout(700); return ok; };
  const shot = (nom, opt = {}) => p.screenshot({ path: `${DIR}/captures/${nom}.png`, ...opt });
  // Capture la page puis la fait défiler (élément #contenu) écran par écran ; renvoie le nombre de captures.
  const defiler = async (nom, max = 8, sel = '#contenu') => {
    const H = await p.evaluate((s) => { const c = document.querySelector(s); return c ? [c.scrollHeight, c.clientHeight] : [0, 0]; }, sel);
    let n = 0;
    for (let y = 0; n < max; y += Math.max(200, H[1] - 80)) {
      await p.evaluate(([s, y]) => document.querySelector(s)?.scrollTo(0, y), [sel, y]); await p.waitForTimeout(250);
      await shot(`${nom}-${n}`); n++;
      if (y + H[1] >= H[0]) break;
    }
    await p.evaluate((s) => document.querySelector(s)?.scrollTo(0, 0), sel);
    return { n, hauteur: H[0], visible: H[1] };
  };
  const data = () => p.evaluate(() => { const r = JSON.parse(localStorage.getItem('releve.v3')); return r.officines ? r.officines[r.courante] : r; });
  const texte = (sel = '.content') => p.evaluate((s) => (document.querySelector(s) || document.body).innerText, sel);
  const profil = async (court) => { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(300); await p.locator('.bandeau-test button', { hasText: court }).first().click(); await p.waitForTimeout(800); };
  const ecrire = (nom, contenu) => fs.writeFileSync(`${DIR}/${nom}`, typeof contenu === 'string' ? contenu : JSON.stringify(contenu, null, 1));
  // Mesures : petites polices, faibles contrastes, petites cibles, textes coupés, débordements.
  const mesurer = (sel = 'body') => p.evaluate((sel) => {
    const W = innerWidth; const out = { deborde: document.documentElement.scrollWidth - W, petits: [], cibles: [], coupes: [], hors: [], polices: {} };
    const vis = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
    const racine = document.querySelector(sel) || document.body;
    for (const e of racine.querySelectorAll('*')) {
      if (!vis(e)) continue;
      const direct = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
      const s = getComputedStyle(e);
      if (direct) { const fs = parseFloat(s.fontSize); out.polices[fs] = (out.polices[fs] || 0) + 1; if (fs < 12) out.petits.push(`${fs}px « ${e.textContent.trim().slice(0, 40)} » (${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)})`); }
      if (s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) out.coupes.push(`« ${e.textContent.trim().slice(0, 50)} » (${String(e.className).slice(0, 30)})`);
      if (e.matches('button, a, [role=tab], input, select, summary')) { const r = e.getBoundingClientRect(); if (r.height < 40 || r.width < 40) out.cibles.push(`${Math.round(r.width)}×${Math.round(r.height)} « ${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)} » (${String(e.className).slice(0, 25)})`); if (r.right > W + 2 || r.left < -2) out.hors.push(`« ${(e.textContent || '').trim().slice(0, 30)} » ${Math.round(r.left)}→${Math.round(r.right)}`); }
    }
    out.petits = [...new Set(out.petits)].slice(0, 40); out.cibles = [...new Set(out.cibles)].slice(0, 60); out.coupes = [...new Set(out.coupes)].slice(0, 30);
    return out;
  }, sel);
  return { b, ctx, p, errs, nav, shot, defiler, data, texte, profil, ecrire, mesurer };
};
// Contraste WCAG entre deux couleurs CSS rgb().
exports.contraste = (a, b) => { const l = (c) => { const v = c.match(/[\d.]+/g).slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }; const [x, y] = [l(a), l(b)].sort((m, n) => n - m); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
