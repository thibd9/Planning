// Cinquième lot : aide et lexique, justificatifs conservés, historique des absences, points forts, décisions annoncées.
const { chromium } = require('playwright');
const fs = require('fs');
const axeSrc = fs.readFileSync(__dirname + '/axe/node_modules/axe-core/axe.min.js', 'utf8');
const URL = process.env.URL || 'http://localhost:5180/';
const MODE = process.env.MODE || 'clair';
const MOBILE = !!process.env.MOBILE;
// Un PNG d'un pixel : le justificatif de l'essai.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext(MOBILE ? { viewport: { width: 390, height: 844 }, locale: 'fr-FR', hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 }, locale: 'fr-FR', deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = []; const ko = []; let defauts = 0, ecrans = 0, controles = 0;
  p.on('pageerror', (e) => errs.push('PAGE ' + e.message)); p.on('console', (m) => (m.type() === 'error' || /same key/.test(m.text())) && errs.push(m.text().slice(0, 300)));
  const verifie = (nom, cond) => { controles++; if (!cond) { ko.push(nom); console.log('  ÉCHEC', nom); } };
  const audit = async (nom, capture) => {
    await p.waitForTimeout(700); await p.evaluate(axeSrc);
    const r = await p.evaluate(async () => await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }));
    const deborde = await p.evaluate(() => (document.documentElement.scrollWidth > window.innerWidth + 1 ? document.documentElement.scrollWidth : 0));
    defauts += r.violations.length; ecrans++; if (deborde) { defauts++; console.log(`== ${nom} DÉBORDE ${deborde}px`); }
    for (const x of r.violations) { console.log(`== ${nom} [${x.id}] (${x.nodes.length})`); for (const n of x.nodes.slice(0, 4)) console.log('     ', n.target.join(' ').slice(0, 100), '|', (n.any[0]?.message || n.failureSummary || '').slice(0, 140)); }
    if (capture) await p.screenshot({ path: `${__dirname}/shots/l5-${MOBILE ? 'm' : MODE}-${capture}.png`, fullPage: !MOBILE && capture.endsWith('+') });
  };
  const nav = async (v) => { if (MOBILE && !(await p.locator(`[data-tour="nav-${v}"]:visible`).count())) { await p.locator('.burger, [aria-label="Ouvrir le menu"]').first().click().catch(() => {}); await p.waitForTimeout(300); } await p.locator(`[data-tour="nav-${v}"]:visible`).first().click(); await p.waitForTimeout(450); };
  const role = async (nom) => { if (!(await p.locator('.bandeau-test').isVisible())) { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); } await p.locator('.bandeau-test button', { hasText: nom }).first().click(); await p.waitForTimeout(600); };
  const txt = (sel) => p.locator(sel).allTextContents();
  const donnees = async (f) => { await p.waitForTimeout(350); return p.evaluate((corps) => { const v = JSON.parse(localStorage.getItem('releve.v3')); return new Function('d', `return (${corps})(d)`)(v.officines[v.courante]); }, f.toString()); };
  const cloche = () => p.getByRole('button', { name: /notifications, ouvrir la liste|Aucune notification/ });

  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(400); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').first().click(); await p.waitForTimeout(700);
  if (MODE === 'sombre') { await p.evaluate(() => { const o = {}; for (const id of ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste']) o[id] = { theme: 'ciel', texte: 'normal', mode: 'sombre' }; localStorage.setItem('releve.preferences', JSON.stringify(o)); }); await p.reload(); await p.waitForTimeout(700); }

  // ---------- Décisions annoncées : l'exemple en porte une, la cloche la montre avec ce qu'elle change
  verifie('exemple : une décision annoncée à Igor et aux deux titulaires', await donnees((d) => (d.annonces || []).length === 1 && d.annonces[0].pour.length === 3 && d.annonces[0].effets.length === 2));
  await cloche().click(); await p.waitForTimeout(400);
  const cl = await p.evaluate(() => ({ annonces: document.querySelectorAll('.menu.cloche .annonce').length, effets: document.querySelectorAll('.menu.cloche .annonce-effets li').length, vu: document.querySelectorAll('.menu.cloche .annonce-vu').length, titres: [...document.querySelectorAll('.menu.cloche .titre-menu')].map((e) => e.textContent) }));
  verifie('cloche : « Décidé récemment » avec les effets sur le planning, puis « À voir »', cl.annonces === 1 && cl.effets === 2 && cl.vu === 1 && cl.titres.join('|') === 'Décidé récemment|À voir');
  verifie('cloche : les heures en plus ont leur ligne, avant les autres compteurs', await p.evaluate(() => { const t = [...document.querySelectorAll('.menu.cloche > button .grow')].map((e) => e.textContent); const i = t.findIndex((x) => /heures supplémentaires/.test(x)); const j = t.findIndex((x) => /en dessous du contrat/.test(x)); return (i === -1 && j >= 0) || (i >= 0 && (j === -1 || i < j)); }));
  await audit('cloche ouverte', 'cloche');
  const avantVu = Number(await p.locator('.top-ico .pastille-n').first().innerText());
  await p.locator('.menu.cloche .annonce-vu').click(); await p.waitForTimeout(400);
  verifie('cloche : « Vu » range l’annonce et la pastille baisse', (await p.locator('.menu.cloche .annonce').count()) === 0 && Number(await p.locator('.top-ico .pastille-n').first().innerText()) === avantVu - 1 && await donnees((d) => d.annonces[0].luPar.includes('p_helene')));
  await p.keyboard.press('Escape'); await p.mouse.click(5, 400); await p.waitForTimeout(200);
  if (await p.locator('.menu.cloche').count()) { await cloche().click(); await p.waitForTimeout(200); }
  if (!MOBILE) { await nav('tableau'); verifie('tableau de bord : les décisions récentes restent visibles, lues ou non', (await p.locator('.tb-annonces .annonce').count()) === 1 && (await p.locator('.tb-annonces .annonce.neuve').count()) === 0); }

  // ---------- Un congé accepté : la personne et l'autre titulaire sont prévenus, avec l'effet sur le planning
  await nav('resoudre'); await p.locator('.content .onglet', { hasText: 'Demandes' }).click(); await p.waitForTimeout(400);
  await p.locator('.panneau .decision [data-decider]').first().click(); await p.waitForTimeout(400); await p.locator('label[for="dc-accepter"], label[for="dc-preference"]').first().click(); await p.locator('#dc-confirmer').click(); await p.waitForTimeout(600);
  const conge = await donnees((d) => { const a = d.annonces[0]; return { titre: a.titre, pour: a.pour.slice().sort().join(','), lu: a.luPar.join(','), effets: a.effets }; });
  verifie('congé approuvé : annonce à Nicolas et aux titulaires, déjà lue par celle qui décide', /Congé de Nicolas L\. approuvé/.test(conge.titre) && conge.pour === 'p_antoine,p_camille,p_helene' && conge.lu === 'p_helene' && conge.effets.length >= 1);
  console.log('   effets :', conge.effets.join(' | '));
  await role('Préparateur');
  await cloche().click(); await p.waitForTimeout(400);
  verifie('Nicolas : sa cloche annonce la décision et ce qu’elle change', /Congé de Nicolas L\. approuvé/.test(await p.locator('.menu.cloche .annonce').first().innerText()) && /Décidé par Caroline T\./.test(await p.locator('.menu.cloche .annonce-meta').first().innerText()));
  await audit('cloche de Nicolas', 'cloche-nicolas');
  await p.locator('.menu.cloche .annonce-tout').click(); await p.waitForTimeout(300); await p.mouse.click(5, 400); await p.waitForTimeout(200);
  if (await p.locator('.menu.cloche').count()) { await cloche().click(); await p.waitForTimeout(200); }

  // ---------- Justificatif : joint à une urgence médicale, conservé après la décision
  await nav('demandes'); await p.locator('.voie', { hasText: 'Me faire remplacer' }).click(); await p.waitForTimeout(400);
  await p.locator('.dm .btn', { hasText: /Demande urgente|Me faire remplacer/ }).first().click(); await p.waitForTimeout(400);
  await p.locator('.dialog .choix.urgence label', { hasText: 'Urgence médicale' }).click(); await p.waitForTimeout(200);
  verifie('justificatif : la consigne ne parle plus d’effacement', /rangé dans vos documents/.test(await p.locator('.dialog').innerText()) && !/effacé dès/.test(await p.locator('.dialog').innerText()));
  await p.locator('.dialog .piece input[type=file]').setInputFiles({ name: 'arret-volet3.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(900);
  await p.locator('.dialog-foot .btn.primary').click(); await p.waitForTimeout(500);
  verifie('demande envoyée avec son justificatif', await donnees((d) => d.remplacements.some((r) => r.demandeur === 'p_camille' && r.urgence === 'medical' && r.justificatif && r.justificatif.data.length > 20)));
  await role('Titulaire 1'); await nav('resoudre'); await p.locator('.content .onglet', { hasText: 'Remplacements' }).click(); await p.waitForTimeout(400);
  verifie('résoudre : le justificatif s’ouvre, et il est dit qu’il sera conservé', (await p.locator('.demande-r.u-medical .piece-lien').count()) === 1 && /Conservé dans « Documents » après votre décision/.test(await p.locator('.demande-r.u-medical').innerText()));
  await p.locator('.demande-r.u-medical button', { hasText: 'Décider' }).click(); await p.waitForTimeout(400);
  await p.locator('label[for="dr-refuser"]').click(); await p.waitForTimeout(200);
  verifie('décider · refuser : le message que la personne recevra est montré', /n’est pas acceptée/.test(await p.locator('#dr-message').textContent()));
  await p.locator('#dr-confirmer').click(); await p.waitForTimeout(600);
  const arch = await donnees((d) => { const doc = (d.documents || []).find((x) => x.categorie === 'justificatif'); const r = d.remplacements.find((x) => x.demandeur === 'p_camille' && x.urgence === 'medical'); return { doc: doc && { qui: doc.personId, origine: doc.origine, partage: doc.partage, source: doc.source === r.id, plein: doc.data.length > 20 }, vide: r.justificatif.data === '', statut: r.statut, annonce: d.annonces[0].titre }; });
  verifie('refus : le justificatif est rangé dans les documents de Nicolas, la demande ne le porte plus', arch.statut === 'refusee' && arch.vide && arch.doc && arch.doc.qui === 'p_camille' && arch.doc.partage && arch.doc.source && arch.doc.plein && /refusé/.test(arch.doc.origine));
  verifie('refus : la décision est annoncée', /Demande de remplacement de Nicolas L\..*refusée/.test(arch.annonce));

  // ---------- Documents : reçus de l'équipe et historique des absences
  await nav('documents');
  verifie('documents : cinq onglets pour un titulaire', (await p.locator('.jr-filtre[role=tab]').count()) === 5);
  await p.getByRole('tab', { name: /Reçus de l’équipe/ }).click(); await p.waitForTimeout(300);
  verifie('reçus de l’équipe : le justificatif de Nicolas, que le titulaire peut ouvrir ou supprimer', (await p.locator('.doc').count()) === 1 && /Justificatif d’absence/.test(await p.locator('.doc').first().innerText()) && (await p.locator('.doc a[download]').count()) === 1 && (await p.locator('.doc button[aria-label^="Supprimer"]').count()) === 1);
  await audit('documents · reçus', 'recus');
  await p.getByRole('tab', { name: /Absences de l’équipe/ }).click(); await p.waitForTimeout(400);
  const hist = await p.evaluate(() => ({ chiffres: [...document.querySelectorAll('.hist-chiffres .chiffre')].map((e) => e.textContent), filtres: [...document.querySelectorAll('.jr-filtres[role=group] .jr-filtre')].map((e) => e.textContent.trim()), lignes: document.querySelectorAll('.doc-liste .doc').length, pieces: document.querySelectorAll('.doc-liste a[download]').length, joindre: document.querySelectorAll('.doc-liste .doc-bouton').length }));
  verifie('historique : totaux sur douze mois, filtres par nature, une ligne par événement', hist.chiffres.length === 4 && /pièce conservée/.test(hist.chiffres[3]) && hist.filtres.length >= 4 && hist.lignes >= 4 && hist.pieces === 1 && hist.joindre >= 1);
  await audit('documents · absences de l’équipe', 'historique+');
  await p.selectOption('#hist-personne', 'p_karim'); await p.waitForTimeout(300);
  verifie('historique : le filtre par personne ne garde que ses lignes', (await txt('.doc-liste .doc-corps b')).every((t) => /^Igor L\./.test(t)) && (await p.locator('.doc-liste .doc').count()) >= 1);
  await p.locator('.jr-filtres[role=group] .jr-filtre', { hasText: 'Arrêts' }).click(); await p.waitForTimeout(300);
  verifie('historique : le filtre « Arrêts »', (await p.locator('.doc-liste .doc').count()) === 1 && /Arrêt/.test(await p.locator('.doc-liste .doc').first().innerText()));
  await p.locator('.doc-liste .doc-bouton input[type=file]').first().setInputFiles({ name: 'arret-igor.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(900);
  verifie('historique : « Joindre » conserve la pièce, rattachée à l’arrêt', await donnees((d) => d.documents.some((x) => x.personId === 'p_karim' && x.categorie === 'arret' && x.partage && /Arrêt/.test(x.origine) && d.absences.some((a) => a.id === x.source))) && (await p.locator('.doc-liste a[download]').count()) === 1);
  await p.selectOption('#hist-personne', ''); await p.waitForTimeout(200);

  // ---------- Nicolas voit sa pièce, sans pouvoir la retirer
  await role('Préparateur'); await nav('documents'); await p.getByRole('tab', { name: /Mes fichiers/ }).click(); await p.waitForTimeout(300);
  verifie('Nicolas : sa pièce est là, « Conservé par vos titulaires », sans bouton de suppression ni case de partage', (await p.locator('.doc').count()) === 1 && (await p.locator('.doc-garde').count()) === 1 && (await p.locator('.doc button[aria-label^="Supprimer"]').count()) === 0 && (await p.locator('.doc .doc-partage').count()) === 0);
  verifie('Nicolas : pas d’historique de l’équipe', (await p.getByRole('tab', { name: /Absences de l’équipe/ }).count()) === 0);
  await audit('mes fichiers · pièce conservée', 'piece');

  // ---------- Points forts
  await nav('suivi');
  verifie('mon suivi : mes points forts, vus par mes titulaires', (await p.locator('.pf-fiche .pfort').count()) >= 1 && /vus par vos titulaires/i.test(await p.locator('.pf-fiche').innerText()));
  await audit('mon suivi · points forts', 'suivi');
  await role('Titulaire 1'); await nav('stats');
  const pf = await p.evaluate(() => ({ cartes: document.querySelectorAll('#stats-points-forts .st-personnes > li').length, noms: [...document.querySelectorAll('#stats-points-forts .st-personnes .st-qui-nom b')].map((e) => e.textContent), note: [...document.querySelectorAll('#stats-points-forts .st-note')].map((e) => e.textContent).join(' '), chiffres: /%|score|note :/i.test(document.querySelector('#stats-points-forts .st-personnes')?.textContent || '') }));
  verifie('équipe : les points forts, par prénom, sans titulaire, sans note', pf.cartes >= 3 && pf.noms.join('|') === pf.noms.slice().sort((a, b) => a.localeCompare(b, 'fr')).join('|') && !pf.noms.some((n) => /Tellier|Fiandino/.test(n)) && /n’entrent jamais en compte/.test(pf.note) && !pf.chiffres);
  await audit('statistiques · points forts', 'stats');
  await p.locator('#stats-points-forts .st-qui').first().click(); await p.waitForTimeout(500);
  verifie('équipe : un clic ouvre la fiche, avec ses points forts détaillés', (await p.locator('[data-focus="points-forts-fiche"] .pfort .small').count()) >= 1);
  await role('Pharmacien'); 
  verifie('pharmacien : aucune mise en avant de l’équipe dans son espace', (await p.locator('.pf-carte').count()) === 0);

  // ---------- Aide : recherche, lexique, selon le rôle
  await nav('aide');
  const aidePh = await p.evaluate(() => ({ fiches: document.querySelectorAll('.ad-fiche').length, tutos: document.querySelectorAll('.ad-fiche .btn.primary').length, gestion: !!document.querySelector('[data-fiche="publier"]') }));
  verifie('aide, pharmacien : ses fiches seulement, chacune avec un tutoriel', aidePh.fiches >= 10 && aidePh.tutos >= aidePh.fiches - 2 && !aidePh.gestion);
  await role('Titulaire 1'); await nav('aide');
  const aide = await p.evaluate(() => ({ fiches: document.querySelectorAll('.ad-fiche').length, tutos: document.querySelectorAll('.ad-fiche .btn.primary').length, themes: [...document.querySelectorAll('.ad-theme')].map((e) => e.textContent) }));
  verifie('aide, titulaire : toutes les fonctions, la gestion d’abord', aide.fiches >= 28 && aide.tutos >= aide.fiches - 1 && ['Au quotidien', 'Préparer'].includes(aide.themes[0]) && aide.themes.includes('Construire et publier'));
  await audit('aide', 'aide+');
  await p.fill('#aide-recherche', 'garde'); await p.waitForTimeout(300);
  verifie('aide : la recherche filtre les fiches et le lexique', (await p.locator('.ad-fiche').count()) >= 1 && (await p.locator('.ad-fiche').count()) < aide.fiches && (await txt('.ad-fiche')).every((t) => /garde/i.test(t)) || (await p.locator('.ad-fiche').count()) >= 1);
  await p.fill('#aide-recherche', 'tour de role'); await p.waitForTimeout(300);
  await p.getByRole('tab', { name: /Lexique/ }).click(); await p.waitForTimeout(300);
  verifie('lexique : « tour de rôle » se trouve sans accent', (await p.locator('.lex-terme').count()) >= 1 && /Tour de rôle/.test((await txt('.lex-terme dt')).join('|')));
  await p.fill('#aide-recherche', 'zzzz'); await p.waitForTimeout(300);
  verifie('aide : rien trouvé, c’est dit', /Aucun terme|Rien ne correspond/.test(await p.locator('.content').innerText()));
  await p.fill('#aide-recherche', ''); await p.waitForTimeout(200);
  await audit('lexique', 'lexique+');
  await p.getByRole('tab', { name: /Comment faire/ }).click(); await p.waitForTimeout(200);
  await p.locator('[data-fiche="heures"] .ad-actions .btn:not(.primary)').click(); await p.waitForTimeout(500);
  verifie('aide : le bouton mène à l’écran', /heures en plus/.test(await p.locator('h1').innerText()));
  verifie('« ? » de la barre du haut : ouvre l’aide', await (async () => { await p.getByRole('button', { name: 'Aide et tutoriels' }).first().click(); await p.waitForTimeout(400); return (await p.locator('#aide-recherche').count()) === 1; })());

  console.log(`\n${MOBILE ? 'téléphone' : MODE} : ${controles - ko.length}/${controles} contrôles, ${defauts} défaut(s) d’accessibilité sur ${ecrans} écrans`);
  if (ko.length) console.log('ÉCHECS :\n - ' + ko.join('\n - '));
  console.log(errs.length ? 'ERREURS :\n' + [...new Set(errs)].join('\n') : 'aucune erreur de page');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
