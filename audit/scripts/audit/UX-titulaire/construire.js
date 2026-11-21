// Construire : fenêtres Nouveau poste / Modifier le poste, Proposer un planning, Publication, vue Mois, Voir la journée, Impression.
const ux = require('./ux');
const T = process.env.T || 'd';
const CONF = { d: { w: 1440, h: 900 }, p: { w: 1280, h: 760 }, t: { w: 390, h: 800, tactile: true } }[T];
const dlg = async (p, nom) => {
  await p.waitForTimeout(700);
  await ux.shot(p, `${nom}-1`);
  const d = await p.evaluate(() => { const d = [...document.querySelectorAll('.dialog')].pop(); if (!d) return null; const c = d.querySelector('.dialog-body') || d; return { H: c.clientHeight, T: c.scrollHeight, titre: (d.querySelector('h2,h1')?.textContent || '').trim() }; });
  let k = 1;
  if (d && d.T > d.H + 10) for (let y = d.H - 60; k < 6; y += d.H - 60) { await p.evaluate((y) => { const d = [...document.querySelectorAll('.dialog')].pop(); (d.querySelector('.dialog-body') || d).scrollTo(0, y); }, y); await p.waitForTimeout(250); k++; await ux.shot(p, `${nom}-${k}`); if (y + d.H >= d.T) break; }
  console.log(nom, JSON.stringify(d), JSON.stringify(await ux.mesurer(p, '.dialog')).slice(0, 900));
  return d;
};
const fermer = async (p) => { await p.keyboard.press('Escape'); await p.waitForTimeout(400); };
(async () => {
  const b = await ux.lancer();
  const { p, errs } = await ux.ouvrir(b, { ...CONF, plie: true });
  await ux.aller(p, 'construire');
  // 1. Nouveau poste : premier « + » de Caroline (samedi)
  await p.evaluate(() => { const a = [...document.querySelectorAll('.pg-c .add')].find((x) => x.getBoundingClientRect().width > 0); a.scrollIntoView({ block: 'center' }); a.click(); });
  await dlg(p, `${T}-construire-nouveau`); await fermer(p);
  // 2. Modifier un poste existant (première tuile)
  await p.evaluate(() => { const a = [...document.querySelectorAll('.pg-c .tile, .pg-c button.tile')].find((x) => x.getBoundingClientRect().width > 0 && !x.classList.contains('garde')); a.scrollIntoView({ block: 'center' }); a.click(); });
  await dlg(p, `${T}-construire-modifier`); await fermer(p);
  // 3. Proposer un planning (sur la semaine 7-13 décembre, vide) : avancer de deux semaines
  await p.evaluate(() => document.getElementById('contenu').scrollTo(0, 0));
  for (let i = 0; i < 2; i++) { await p.getByRole('button', { name: /Semaine suivante/ }).first().click().catch(async () => { await p.locator('[aria-label*="suivante"]').first().click(); }); await p.waitForTimeout(500); }
  await ux.shot(p, `${T}-construire-vide`);
  await p.getByRole('button', { name: /Proposer un planning/ }).first().click(); await p.waitForTimeout(2500);
  await dlg(p, `${T}-construire-proposer`);
  // choisir la première proposition si possible
  const choix = p.locator('.dialog button', { hasText: /Choisir|Prendre|Appliquer|Utiliser/ }).first();
  if (await choix.count()) { await choix.click(); await p.waitForTimeout(900); await ux.shot(p, `${T}-construire-apres-proposition`); console.log('toast', await p.evaluate(() => document.querySelector('.toast')?.innerText || 'aucun')); }
  else await fermer(p);
  // 4. Publier
  const pub = p.getByRole('button', { name: /Publier/ }).first();
  console.log('publier actif', await pub.isEnabled().catch(() => 'absent'));
  if (await pub.isEnabled().catch(() => false)) { await pub.click(); await dlg(p, `${T}-construire-publier`); await fermer(p); }
  // 5. Vue Mois
  await p.evaluate(() => document.getElementById('contenu').scrollTo(0, 0));
  await p.getByRole('button', { name: /^Mois$/ }).first().click(); await p.waitForTimeout(900);
  const f = await ux.defiler(p, `${T}-construire-mois`, { max: 8 });
  if (T === 't') ux.assembler(f, `${ux.DIR}/t-construire-mois-A.png`, 4);
  console.log('mois', JSON.stringify(await ux.mesurer(p)).slice(0, 1500));
  await p.getByRole('button', { name: /^Semaine$/ }).first().click(); await p.waitForTimeout(600);
  // 6. Voir la journée (lundi)
  await p.evaluate(() => { const j = [...document.querySelectorAll('.jour-btn')].find((x) => x.getBoundingClientRect().width > 0); j.click(); });
  await dlg(p, `${T}-construire-journee`); await fermer(p);
  // 7. Impression
  await p.evaluate(() => document.getElementById('contenu').scrollTo(0, 0));
  await p.locator('[aria-label="Imprimer le planning"]').click(); await p.waitForTimeout(1200);
  await ux.shot(p, `${T}-construire-impression`);
  console.log('erreurs', errs);
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
