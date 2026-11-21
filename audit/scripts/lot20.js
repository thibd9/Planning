// Lot 20 : disposition du tableau de bord (comptoir et décisions, ou priorité d'abord), choix dans « Mon compte ».
const fs = require('fs');
const { ouvrir } = require('./lib.js');
const axeSrc = fs.readFileSync(__dirname + '/axe/node_modules/axe-core/axe.min.js', 'utf8');
const MODE = process.env.MODE; const MOBILE = !!process.env.MOBILE;
(async () => {
  const ok = []; const ko = []; const t = (nom, c) => (c ? ok : ko).push(nom);
  const { b, p, errs, shot } = await ouvrir({ role: 0, w: MOBILE ? 390 : 1440, h: MOBILE ? 844 : 1000, mode: MODE });
  const axe = async (nom) => { await p.evaluate(axeSrc); const r = await p.evaluate(async () => await window.axe.run(document.querySelector('.content') || document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })); t(`accessibilité : ${nom} (${r.violations.map((v) => v.id + ' ' + v.nodes.length).join(', ') || 'rien'})`, r.violations.length === 0); };
  const boite = (sel) => p.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null; }, sel);
  const deborde = () => p.evaluate(() => { const c = document.querySelector('.content'); return [...document.querySelectorAll('.tb *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > (c?.getBoundingClientRect().right ?? innerWidth) + 1; }).length; });
  await p.waitForTimeout(400);
  // 1. Par défaut : comptoir et décisions
  t('par défaut : disposition comptoir', await p.locator('.tb.dispo-comptoir').count() === 1 && await p.locator('.tb-duo').count() === 0);
  const j = await boite('.tb-rang .tb-jour'); const d = await boite('.tb-rang .tb-decider'); const c = await boite('.tb-rang .cycle'); const a = await boite('.tb-rang .tb-agenda'); const e = await boite('.tb-rang .tb-echeance'); const r = await boite('.tb-annonces');
  if (MOBILE) {
    t(`téléphone : une colonne, décisions avant le comptoir (${JSON.stringify({ j, d })})`, !!j && !!d && d.y < j.y && Math.abs(j.w - d.w) <= 2);
    t('téléphone : planning avant agenda', !!c && !!a && c.y < a.y);
  } else {
    t(`comptoir à gauche, décisions à droite, même hauteur (${JSON.stringify({ j, d })})`, !!j && !!d && j.x < d.x && Math.abs(j.y - d.y) < 2 && Math.abs(j.h - d.h) <= 2 && j.w > d.w);
    t(`planning à gauche, agenda à droite, sous la première rangée (${JSON.stringify({ c, a })})`, !!c && !!a && c.x < a.x && a.y > j.y + j.h && Math.abs(a.x - d.x) <= 2);
    t('échéance du mois au-dessus du prochain planning', !e || (!!c && e.y < c.y && Math.abs(e.x - c.x) <= 2));
    t('carte du comptoir sans vide : la dernière ligne touche presque le bas', await p.evaluate(() => { const k = document.querySelector('.tb-rang .tb-jour').getBoundingClientRect(); const l = [...document.querySelectorAll('.tb-rang .tb-jour .tbj > *')].pop().getBoundingClientRect(); return k.bottom - l.bottom < 40; }));
  }
  t('décisions récentes en dernier', !!r && !!a && r.y > a.y + a.h - 2);
  t('les blocs gardent leurs repères', await p.locator("[data-focus='priorite']").count() === 1 && await p.locator("[data-focus='cycle']").count() === 1 && await p.locator("[data-focus='mon-agenda']").count() === 1 && await p.locator('.tb-jour .btn').count() >= 1);
  t(`rien ne déborde (${await deborde()})`, await deborde() === 0);
  await axe('comptoir'); await shot(`l20-comptoir${MOBILE ? '-m' : ''}${MODE === 'sombre' ? '-s' : ''}`);
  // 2. Une décision mène à « Résoudre »
  if (await p.locator('.tb-sujet').count()) { await p.locator('.tb-sujet').first().click(); await p.waitForTimeout(500); t('une ligne de décisions ouvre « Résoudre »', await p.locator('[data-tour="nav-resoudre"].on, [data-tour="nav-resoudre"][aria-current]').count() >= 1 || /soudre/.test(await p.title())); await p.locator('[data-tour="nav-tableau"]:visible').first().click().catch(() => {}); await p.waitForTimeout(400); }
  // 3. Mon compte : le choix, avec ses maquettes
  const compte = async () => { await p.locator('[data-tour="compte"]:visible').first().click(); await p.waitForTimeout(250); await p.locator('.menu button', { hasText: 'Mon compte' }).click(); await p.waitForTimeout(500); };
  const tableau = async () => { if (MOBILE) { await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('releve.session') || 'null'); }); } await p.reload(); await p.waitForTimeout(700); if (!(await p.locator('.tb').count())) { await p.locator('[data-tour="nav-tableau"]:visible').first().click().catch(() => {}); await p.waitForTimeout(500); } };
  await compte();
  t('compte : deux dispositions, avec maquette', await p.locator('#choix-disposition .app-carte').count() === 2 && await p.locator('#choix-disposition svg.app-maquette').count() === 2);
  t('compte : « Comptoir et décisions » cochée', await p.locator('#disposition-comptoir').isChecked());
  await p.locator('#choix-disposition').scrollIntoViewIfNeeded(); await axe('compte'); await shot(`l20-compte${MOBILE ? '-m' : ''}${MODE === 'sombre' ? '-s' : ''}`);
  await p.locator('label[for="disposition-classique"]').click(); await p.waitForTimeout(250);
  t('choix enregistré', /"tableau":"classique"/.test(await p.evaluate(() => localStorage.getItem('releve.preferences'))));
  await p.evaluate(() => { const s = localStorage.getItem('releve.session'); sessionStorage.setItem('x', s || ''); });
  await p.reload(); await p.waitForTimeout(700);
  // 4. Priorité d'abord : l'ancienne disposition, intacte
  if (!(await p.locator('.tb').count())) { await p.locator('[data-tour="nav-tableau"]:visible').first().click().catch(() => {}); await p.waitForTimeout(500); }
  t('classique : conservée après rechargement', await p.locator('.tb.dispo-classique').count() === 1 && await p.locator('.tb-duo').count() === 1 && await p.locator('.tb-rang').count() === 0);
  const pa = await boite('.tb-duo .tb-avant'); const ag = await boite('.tb-duo .tb-agenda'); const jj = await boite('.tb-grille .tb-jour');
  t(`classique : priorité et agenda en tête, comptoir dessous (${JSON.stringify({ pa, ag, jj })})`, !!pa && !!ag && !!jj && jj.y > pa.y + pa.h - 2 && (MOBILE ? ag.y > pa.y : Math.abs(pa.y - ag.y) < 2 && Math.abs(pa.h - ag.h) <= 2));
  t(`classique : rien ne déborde (${await deborde()})`, await deborde() === 0);
  await axe('classique'); await shot(`l20-classique${MOBILE ? '-m' : ''}${MODE === 'sombre' ? '-s' : ''}`);
  // 5. Retour au comptoir
  await compte(); await p.locator('label[for="disposition-comptoir"]').click(); await p.waitForTimeout(250);
  await p.reload(); await p.waitForTimeout(700); if (!(await p.locator('.tb').count())) { await p.locator('[data-tour="nav-tableau"]:visible').first().click().catch(() => {}); await p.waitForTimeout(500); }
  t('retour à la disposition comptoir', await p.locator('.tb.dispo-comptoir').count() === 1);
  await b.close();
  // 6. Un préparateur n'a pas ce choix
  const o = await ouvrir({ role: 3, w: 1280, h: 900, mode: MODE });
  await o.p.locator('[data-tour="compte"]:visible').first().click(); await o.p.waitForTimeout(250); await o.p.locator('.menu button', { hasText: 'Mon compte' }).click(); await o.p.waitForTimeout(500);
  t('préparateur : pas de choix de disposition', await o.p.locator('#choix-disposition').count() === 0 && await o.p.locator('[aria-label="Apparence"] .app-carte').count() === 4);
  await o.b.close();
  console.log(ko.length ? `ÉCHECS : ${ko.join(' | ')}` : ''); console.log(`lot20${MOBILE ? ' téléphone' : ''}${MODE ? ' ' + MODE : ''} : ${ok.length}/${ok.length + ko.length}`, [...errs, ...o.errs].join(' ') || 'aucune erreur de page');
})();
