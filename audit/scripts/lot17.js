// Lot 17 : officine en chiffres, support en pied de page, Solvi interrogatif, focus depuis « Résoudre ».
const { ouvrir } = require('./lib.js');
(async () => {
  const { b, p, errs, nav, shot } = await ouvrir({ role: 0, w: 1440, h: 900, mode: process.env.MODE });
  const ok = []; const ko = [];
  const t = (nom, c) => (c ? ok : ko).push(nom);
  // Pied de page
  t('pied support présent', await p.locator('.content .pied-support').count() === 1);
  t('numéro fictif en pied', /01 99 00 12 34/.test(await p.locator('.pied-support').innerText()));
  // Réglages
  await nav('officine'); 
  t('carte support retirée', await p.locator('[data-focus="support"]').count() === 0);
  t('fiche officine', await p.locator('[data-focus="infos-officine"]').count() === 1);
  t('6 champs + robot', await p.locator('[data-focus="infos-officine"] .of-grille input[type=number]').count() === 6 && await p.locator('#officine-robot').count() === 1);
  await p.fill('#officine-surfaceVente', '300'); await p.waitForTimeout(200);
  t('remarque surface', /dépasse la surface totale/.test(await p.locator('#of-remarques').innerText().catch(() => '')));
  await p.fill('#officine-surfaceVente', '120'); await p.fill('#officine-caisses', '2'); await p.waitForTimeout(200);
  t('remarque levée', !/dépasse la surface totale/.test(await p.locator('#of-remarques').innerText().catch(() => '')));
  t('chiffres en tête', /120 m² de surface de vente/.test(await p.locator('.page-fait').innerText()));
  await p.locator('[data-focus="infos-officine"]').scrollIntoViewIfNeeded(); await shot('l17-officine');
  // Aide
  await nav('aide');
  t('bloc support', await p.locator('#aide-support').count() === 1);
  const nb = await p.locator('.ad-fiche').count(); t(`fiches ≥ 38 (${nb})`, nb >= 38);
  const sans = await p.locator('.ad-fiche').evaluateAll((l) => l.filter((x) => !/Voir le tutoriel/.test(x.textContent)).map((x) => x.dataset.fiche)); t(`toutes ont un tutoriel (${sans.join(',')})`, sans.length === 0);
  await p.fill('#aide-recherche', 'xyzzy'); await p.waitForTimeout(700);
  t('vide : support proposé', /01 99 00 12 34/.test(await p.locator('#ad-vide').innerText()));
  t('Solvi interrogatif', await p.locator('#ad-vide .solvi.h-intrigue .solvi-signe.doute').count() === 1);
  await p.locator('#ad-vide').scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await p.locator('#ad-vide').screenshot({ path: __dirname + '/shots/l17-vide.png' });
  await p.fill('#aide-recherche', 'support'); await p.waitForTimeout(400);
  t('fiche support trouvée', await p.locator('[data-fiche="support"]').count() === 1);
  await p.fill('#aide-recherche', '');
  // Solvi
  await p.locator('.aide-fab').click(); await p.waitForTimeout(400);
  await p.locator('.aide-saisie input, .aide-form input').first().fill('combien de caisses ?'); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  t('Solvi : chiffres', /2 caisses/.test(await p.locator('.aide-panneau, .aide').first().innerText()));
  await p.locator('.aide-saisie input, .aide-form input').first().fill('blorp zzzz'); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  t('Solvi : support', await p.locator('.aide-support a[href^="tel:"]').count() >= 1);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // Résoudre : à publier. Une retouche à la main sur une semaine publiée reste un brouillon : elle crée la publication en attente.
  await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('releve.v3')); const d = v.officines[v.courante]; const t = new Date(); const auj = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; const x = new Date(auj + 'T12:00:00'); x.setDate(x.getDate() + 8); const plus = x.toISOString().slice(0, 10); const s = d.shifts.filter((q) => q.date >= plus && q.personId !== 'p_helene').sort((a, b) => a.date.localeCompare(b.date))[0]; s.end -= 30; localStorage.setItem('releve.v3', JSON.stringify(v)); });
  await p.reload(); await p.waitForTimeout(800);
  await nav('resoudre'); await p.locator('#onglet-publications').click().catch(() => {}); await p.waitForTimeout(400);
  const bt = p.locator('[data-publier]').first();
  if (await bt.count()) {
    const lib = (await bt.innerText()).trim(); await bt.click(); await p.waitForTimeout(1400);
    const vise = await p.locator('.vise').first().evaluate((e) => ({ focus: document.activeElement === e, tag: e.tagName, df: e.dataset.focus || e.dataset.tour, vu: (() => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; })() })).catch(() => null);
    t(`à publier « ${lib} » → ${JSON.stringify(vise)}`, !!vise && vise.focus && vise.vu);
    await shot('l17-vise');
  } else t('à publier : bouton présent', false);
  console.log(`${ok.length}/${ok.length + ko.length}`, ko.length ? 'ÉCHECS : ' + ko.join(' | ') : '', errs.length ? 'ERREURS ' + errs.join(' ; ') : '');
  await b.close();
})();
