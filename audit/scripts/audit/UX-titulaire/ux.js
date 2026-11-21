// Outils de la revue UX titulaire : ouvrir, naviguer, capturer par défilement de #contenu, mesurer.
const { chromium } = require('playwright');
const fs = require('fs');
const DIR = __dirname + '/captures';
fs.mkdirSync(DIR, { recursive: true });

exports.DIR = DIR;
exports.lancer = () => chromium.launch();

// plie : true = état réel à l'ouverture (accordéons fermés, onglets normaux)
exports.ouvrir = async (b, { role = 0, w = 1440, h = 900, mode, plie = false, tactile = false } = {}) => {
  process.env.PLIE = plie ? '1' : '';
  if (!plie) delete process.env.PLIE;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'fr-FR', deviceScaleFactor: 1, ...(tactile ? { hasTouch: true, isMobile: true } : {}) });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push('PAGE ' + e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 300)));
  await p.goto('http://localhost:5180/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(300);
  await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').nth(role).click(); await p.waitForTimeout(700);
  if (mode) {
    await p.evaluate((m) => { const o = {}; for (const id of ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste']) o[id] = { theme: 'ciel', texte: 'normal', mode: m }; localStorage.setItem('releve.preferences', JSON.stringify(o)); }, mode);
    await p.reload(); await p.waitForTimeout(700);
  }
  return { ctx, p, errs };
};

exports.aller = async (p, vue) => {
  await p.evaluate((v) => { const e = [...document.querySelectorAll(`[data-tour="nav-${v}"]`)].find((x) => x.getBoundingClientRect().width > 0) ?? document.querySelector(`[data-tour="nav-${v}"]`); e?.click(); }, vue);
  await p.waitForTimeout(700);
  await p.evaluate(() => document.getElementById('contenu')?.scrollTo(0, 0));
  await p.waitForTimeout(150);
};

// Capture l'écran entier à chaque palier de défilement de #contenu. Renvoie les chemins.
exports.defiler = async (p, nom, { max = 12, el = '#contenu' } = {}) => {
  const out = [];
  const dims = await p.evaluate((s) => { const c = document.querySelector(s); return c ? { H: c.clientHeight, T: c.scrollHeight } : null; }, el);
  if (!dims) { const f = `${DIR}/${nom}-1.png`; await p.screenshot({ path: f }); return [f]; }
  const pas = Math.max(200, dims.H - 90);
  let i = 0;
  for (let y = 0; i < max; y += pas) {
    await p.evaluate(([s, y]) => document.querySelector(s).scrollTo(0, y), [el, y]); await p.waitForTimeout(220);
    i++; const f = `${DIR}/${nom}-${i}.png`; await p.screenshot({ path: f }); out.push(f);
    if (y + dims.H >= dims.T - 2) break;
  }
  await p.evaluate((s) => document.querySelector(s).scrollTo(0, 0), el);
  return out;
};

exports.shot = async (p, nom, opt = {}) => { const f = `${DIR}/${nom}.png`; await p.screenshot({ path: f, ...opt }); return f; };

// Mesures automatiques dans une zone (par défaut le contenu + la barre du haut).
exports.mesurer = async (p, racine = '.content') => p.evaluate((racine) => {
  const R = document.querySelector(racine) || document.body; const W = innerWidth;
  const vis = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const rgb = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fond = (e) => { for (let x = e; x; x = x.parentElement) { const st = getComputedStyle(x); if (st.backgroundImage && st.backgroundImage !== 'none') return null; const c = rgb(st.backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const petits = [], contrastes = [], coupes = [], cibles = [];
  const vus = new Set();
  for (const e of R.querySelectorAll('*')) {
    if (!vis(e)) continue;
    const propre = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    const s = getComputedStyle(e);
    if (propre && propre.length > 1) {
      const fs = parseFloat(s.fontSize);
      if (fs < 12) petits.push(`${fs}px « ${propre.slice(0, 40)} »`);
      const c = rgb(s.color); const bg = c && fond(e); if (c && bg) { const l1 = lum(c), l2 = lum(bg); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); const gros = fs >= 18.6 || (fs >= 14 && +s.fontWeight >= 700); if (ratio < (gros ? 3 : 4.5)) contrastes.push(`${ratio.toFixed(2)} ${fs}px « ${propre.slice(0, 36)} »`); }
    }
    if (s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) coupes.push(`« ${(e.textContent || '').trim().slice(0, 50)} »`);
    if (e.matches('button, a, [role=tab], input[type=checkbox], input[type=radio], select, summary')) { const r = e.getBoundingClientRect(); if (r.height < 40 || r.width < 40) { const t = (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30); const k = `${Math.round(r.width)}×${Math.round(r.height)} ${t}`; if (!vus.has(k)) { vus.add(k); cibles.push(k); } } }
  }
  const deborde = []; for (const e of R.querySelectorAll('*')) { if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (r.right > W + 2) { let defil = false; for (let x = e.parentElement; x; x = x.parentElement) { const st = getComputedStyle(x); if (/(auto|scroll|hidden)/.test(st.overflowX) && x !== document.body && x !== document.documentElement) { defil = true; break; } } if (!defil) deborde.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 25)} → ${Math.round(r.right)}`); } }
  const defilH = []; for (const e of R.querySelectorAll('*')) { const st = getComputedStyle(e); if (/(auto|scroll)/.test(st.overflowX) && e.scrollWidth > e.clientWidth + 4 && vis(e)) defilH.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)} (+${e.scrollWidth - e.clientWidth}px)`); }
  const u = (a) => [...new Set(a)];
  return { pageDeborde: document.documentElement.scrollWidth - W, petits: u(petits).slice(0, 40), nPetits: petits.length, contrastes: u(contrastes).slice(0, 40), nContrastes: contrastes.length, coupes: u(coupes).slice(0, 30), cibles: cibles.slice(0, 60), nCibles: cibles.length, deborde: u(deborde).slice(0, 15), defilH: u(defilH).slice(0, 15) };
}, racine);

// Assemble plusieurs captures côte à côte (téléphone) en une image : python PIL.
exports.assembler = (fichiers, sortie, parLigne = 4) => {
  const { execFileSync } = require('child_process');
  execFileSync('python3', ['-I', __dirname + '/assemble.py', sortie, String(parLigne), ...fichiers]);
  return sortie;
};
