// Résoudre : fenêtres de décision de chaque onglet.
const ux = require('./ux');
const T = process.env.T || 'd';
const CONF = { d: { w: 1440, h: 900 }, t: { w: 390, h: 800, tactile: true } }[T];
const dlg = async (p, nom) => {
  await p.waitForTimeout(800); await ux.shot(p, `${nom}-1`);
  const d = await p.evaluate(() => { const d = [...document.querySelectorAll('.dialog')].pop(); if (!d) return null; const c = d.querySelector('.dialog-body') || d; return { H: c.clientHeight, T: c.scrollHeight, titre: (d.querySelector('h2,h1')?.textContent || '').trim() }; });
  let k = 1; if (d && d.T > d.H + 10) for (let y = d.H - 60; k < 6; y += d.H - 60) { await p.evaluate((y) => { const d = [...document.querySelectorAll('.dialog')].pop(); (d.querySelector('.dialog-body') || d).scrollTo(0, y); }, y); await p.waitForTimeout(250); k++; await ux.shot(p, `${nom}-${k}`); if (y + d.H >= d.T) break; }
  console.log(nom, JSON.stringify(d), JSON.stringify(await ux.mesurer(p, '.dialog')).slice(0, 600));
  return d;
};
const onglet = async (p, o) => { await p.evaluate((o) => [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim().startsWith(o) && x.getBoundingClientRect().width > 0).click(), o); await p.waitForTimeout(600); await p.evaluate(() => document.getElementById('contenu').scrollTo(0, 0)); };
const esc = async (p) => { await p.keyboard.press('Escape'); await p.waitForTimeout(400); };
(async () => {
  const b = await ux.lancer();
  const { p, errs } = await ux.ouvrir(b, { ...CONF, plie: true });
  await ux.aller(p, 'resoudre');
  // Absences : Voir et choisir la solution
  await p.getByRole('button', { name: /Voir et choisir la solution/ }).first().click(); await dlg(p, `${T}-res-reglage`); await esc(p);
  // Absences : déplier « Pourquoi 9 personnes… »
  await p.evaluate(() => { const s = [...document.querySelectorAll('summary, button')].find((x) => /Pourquoi \d+ personnes/.test(x.textContent)); s?.click(); s?.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(500);
  await ux.shot(p, `${T}-res-pourquoi`);
  // Absences : Choisir sur la 2e option (non conseillée)
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === 'Choisir' && x.getBoundingClientRect().width > 0); b[1]?.scrollIntoView({ block: 'center' }); b[1]?.click(); }); await p.waitForTimeout(800);
  const d1 = await p.evaluate(() => !!document.querySelector('.dialog'));
  if (d1) { await dlg(p, `${T}-res-choisir`); await esc(p); } else { await ux.shot(p, `${T}-res-choisir-sans-dialogue`); console.log('Choisir : pas de fenêtre ; toast', await p.evaluate(() => document.querySelector('.toast')?.innerText || 'aucun')); }
  // Remplacements : Refuser
  await ux.aller(p, 'resoudre'); await onglet(p, 'Remplacements');
  await p.getByRole('button', { name: /^Refuser/ }).first().click(); await dlg(p, `${T}-res-refus`); await esc(p);
  // Demandes : Décider (Nicolas), Décider (Jules)
  await onglet(p, 'Demandes');
  const n = await p.getByRole('button', { name: /^Décider/ }).count(); console.log('boutons Décider', n);
  for (let i = 0; i < Math.min(n, 2); i++) { await onglet(p, 'Demandes'); await p.getByRole('button', { name: /^Décider/ }).nth(i).click(); await dlg(p, `${T}-res-decider${i + 1}`); await esc(p); }
  // Gardes : Affecter
  await onglet(p, 'Gardes');
  await p.getByRole('button', { name: /Affecter/ }).first().click(); await p.waitForTimeout(900);
  await ux.shot(p, `${T}-res-affecter`);
  console.log('après Affecter : vue', await p.evaluate(() => document.querySelector('.page-head h1')?.textContent), 'défilement', await p.evaluate(() => document.getElementById('contenu').scrollTop));
  console.log('erreurs', errs);
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
