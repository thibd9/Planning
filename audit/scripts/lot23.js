// Lot 23 : onglets (réglages, statistiques), carrousel des visites, dernier recours du titulaire.
const fs = require('fs');
const { ouvrir } = require('./lib.js');
const axeSrc = fs.readFileSync(__dirname + '/axe/node_modules/axe-core/axe.min.js', 'utf8');
(async () => {
  const ok = []; const ko = []; const t = (nom, c) => (c ? ok : ko).push(nom);
  const { b, p, errs, nav, shot } = await ouvrir({ role: 0, w: 1280, h: 760 });
  const axe = async (nom) => { await p.evaluate(axeSrc); const r = await p.evaluate(async () => await window.axe.run(document.querySelector('.content') || document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })); t(`accessibilité : ${nom} (${r.violations.map((v) => v.id + ' ' + v.nodes.length).join(', ') || 'rien'})`, r.violations.length === 0); };
  // 1. Réglages : cinq onglets, un seul panneau visible
  await nav('officine'); await p.waitForTimeout(400);
  const onglets = await p.locator('#reglages .ong-onglet').allInnerTexts();
  t(`réglages : cinq onglets (${onglets.join(', ')})`, onglets.join('|') === 'Pharmacie|Horaires|Comptoir|Planning|Paramètres');
  t('réglages : un seul panneau à la fois', await p.locator('#reglages > .ong-panneau:visible').count() === 1 && await p.locator('#acc-identite').isVisible() && !(await p.locator('#acc-horaires').isVisible()));
  await p.locator('#reglages-onglet-horaires').click(); await p.waitForTimeout(250);
  t('onglet Horaires : horaires et jours fériés', await p.locator('#acc-horaires').isVisible() && await p.locator('#acc-feries').isVisible() && !(await p.locator('#acc-identite').isVisible()));
  await p.locator('#reglages-onglet-horaires').press('ArrowRight'); await p.waitForTimeout(250);
  t('au clavier, la flèche passe à « Comptoir »', await p.locator('#acc-effectif').isVisible() && await p.evaluate(() => document.activeElement?.id === 'reglages-onglet-comptoir') && await p.locator('#dimensionnement').count() === 1);
  await axe('réglages en onglets'); await shot('l23-reglages');
  await p.locator('#reglages-onglet-planning').click(); await p.waitForTimeout(250);
  t('onglet Planning : qui prépare, publication, postes types', await p.locator('#acc-modele').isVisible() && await p.locator('#acc-publication').isVisible() && await p.locator('#acc-postes').isVisible());
  t('la hauteur de page reste raisonnable', await p.evaluate(() => (document.querySelector('.content')?.scrollHeight ?? 0) < 2200));
  // 2. Statistiques : quatre onglets, personnes alignées
  await nav('stats'); await p.waitForTimeout(400);
  t('statistiques : quatre onglets', (await p.locator('#stats .ong-onglet').count()) === 4 && await p.locator('#stats-composition').isVisible() && !(await p.locator('#stats-competences').isVisible()));
  await p.locator('#stats-onglet-competences').click(); await p.waitForTimeout(250);
  const gauches = await p.evaluate(() => [...document.querySelectorAll('#stats-competences .st-fragiles > li > .st-qui')].map((e) => Math.round(e.getBoundingClientRect().left)));
  t(`compétences fragiles : les personnes sont au même niveau (${gauches.join(', ')})`, gauches.length >= 2 && new Set(gauches).size === 1);
  await axe('statistiques en onglets'); await shot('l23-stats');
  // 3. Dernier recours : urgence médicale, personne ne peut reprendre, un titulaire assure
  const id = await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('releve.v3')); const d = v.officines[v.courante]; const t = new Date(); const auj = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; const s = d.shifts.filter((x) => x.personId === 'p_thomas' && x.date > auj).sort((a, b) => a.date.localeCompare(b.date))[0]; const r = { id: 'r_test', shiftId: s.id, demandeur: 'p_thomas', date: s.date, start: s.start, end: s.end, creeLe: new Date().toISOString(), volontaires: [], statut: 'ouverte', accord: 'attente', urgence: 'medical', motif: 'sante' }; d.remplacements.push(r); localStorage.setItem('releve.v3', JSON.stringify(v)); return s.id; });
  await p.reload(); await p.waitForTimeout(800); await nav('resoudre'); await p.locator('#onglet-remplacements').click().catch(() => {}); await p.waitForTimeout(400);
  await p.locator('.demande-r.u-medical button', { hasText: 'Décider' }).first().click(); await p.waitForSelector('.dialog .dr', { timeout: 10000 }); await p.waitForTimeout(300);
  t('urgence médicale : « un titulaire assure le poste » est proposé', await p.locator('#dr-titulaire').count() === 1 && /titulaire/i.test(await p.locator('label[for="dr-titulaire"]').innerText()));
  await p.locator('label[for="dr-titulaire"]').click(); await p.waitForTimeout(300);
  t('le message dit que le poste quitte son planning', /assure votre poste, qui ne figure plus à votre planning/.test(await p.locator('#dr-message').innerText()));
  await axe('décision · dernier recours'); await shot('l23-recours');
  await p.locator('#dr-confirmer').click(); await p.waitForTimeout(800);
  const apres = await p.evaluate((sid) => { const v = JSON.parse(localStorage.getItem('releve.v3')); const d = v.officines[v.courante]; const r = d.remplacements.find((x) => x.id === 'r_test'); const s = d.shifts.find((x) => x.id === sid); const titu = d.personnes.filter((x) => x.qualification === 'titulaire').map((x) => x.id); return { statut: r.statut, par: r.remplacantId, titulaire: titu.includes(r.remplacantId), poste: s ? s.personId : 'retiré', thomas: d.shifts.some((x) => x.personId === 'p_thomas' && x.date === r.date && x.start === r.start), annonce: d.annonces[0].titre }; }, id);
  t(`décision appliquée (${JSON.stringify(apres)})`, apres.statut === 'acceptee' && apres.titulaire && !apres.thomas && /titulaire, assure le poste/.test(apres.annonce));
  // 4. Messagerie : toujours le même ordre
  await nav('messages'); await p.waitForTimeout(400);
  const ordre = await p.evaluate(() => ({ noms: [...document.querySelectorAll('.msg-fil b')].map((e) => e.textContent), rubriques: [...document.querySelectorAll('.msg-rubrique')].map((e) => e.textContent) }));
  t(`messagerie : équipe, titulaires, pharmaciens, préparateurs, autres (${ordre.noms.slice(0, 5).join(', ')}… | ${ordre.rubriques.join(', ')})`, ordre.noms[0] === 'Toute l’équipe' && /Pierre/.test(ordre.noms[1]) && /Igor|Léa/.test(ordre.noms[2]) && ordre.rubriques.join('|') === 'Titulaires|Pharmaciens|Préparateurs|Autres postes');
  // 5. Aide : un onglet par thème, une recherche montre tout
  await nav('aide'); await p.waitForTimeout(400);
  const themes = await p.locator('#aide-themes .ong-onglet').count();
  t(`aide : un onglet par thème (${themes}), un seul thème affiché`, themes >= 6 && await p.locator('#aide-themes > .ong-panneau:visible').count() === 1);
  await p.locator('#aide-themes .ong-onglet').nth(2).click(); await p.waitForTimeout(250);
  t('aide : changer d’onglet change de thème', await p.locator('#aide-themes > .ong-panneau:visible').count() === 1 && await p.locator('#aide-themes .ong-onglet.on').count() === 1);
  await axe('aide en onglets'); await shot('l23-aide');
  await p.fill('#aide-recherche', 'garde'); await p.waitForTimeout(400);
  t('aide : une recherche montre les fiches trouvées, sans onglets', await p.locator('#aide-themes').count() === 0 && await p.locator('.ad-fiche').count() >= 1);
  await b.close();
  const o = await ouvrir({ role: 3, w: 1280, h: 760 });
  await o.p.evaluate(() => document.querySelector('[data-tour="nav-messages"]')?.click()); await o.p.waitForTimeout(500);
  const ordre2 = await o.p.evaluate(() => [...document.querySelectorAll('.msg-fil b')].map((e) => e.textContent));
  t(`messagerie d’un préparateur : équipe, Caroline, Pierre, puis les pharmaciens (${ordre2.slice(0, 5).join(', ')})`, ordre2[0] === 'Toute l’équipe' && /Caroline/.test(ordre2[1]) && /Pierre/.test(ordre2[2]) && /Igor|Léa/.test(ordre2[3]));
  await o.b.close();
  console.log(ko.length ? `ÉCHECS : ${ko.join(' | ')}` : ''); console.log(`lot23 : ${ok.length}/${ok.length + ko.length}`, errs.join(' ') || 'aucune erreur de page');
})();
