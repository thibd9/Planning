// Neuvième lot : Solvi dans l’aide seulement, horaires en icônes, une couleur par profil, visite racontée en chapitres, vol de Solvi.
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
    if (capture) await p.screenshot({ path: `${__dirname}/shots/l9-${MOBILE ? 'm' : MODE}-${capture}.png`, fullPage: !MOBILE && capture.endsWith('+') });
  };
  const nav = async (v) => { if (MOBILE && !(await p.locator(`[data-tour="nav-${v}"]:visible`).count())) { await p.locator('.burger, [aria-label="Ouvrir le menu"]').first().click().catch(() => {}); await p.waitForTimeout(300); } await p.locator(`[data-tour="nav-${v}"]:visible`).first().click(); await p.waitForTimeout(450); };
  const role = async (nom) => { if (!(await p.locator('.bandeau-test').isVisible())) { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); } await p.locator('.bandeau-test button', { hasText: nom }).first().click(); await p.waitForTimeout(600); };
  const theme = () => p.evaluate(() => document.documentElement.dataset.theme);
  const compte = async () => { await p.locator('[data-tour="compte"]:visible').first().click(); await p.waitForTimeout(250); await p.locator('.menu button', { hasText: 'Mon compte' }).click(); await p.waitForTimeout(500); };
  const tous = ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste', 'sarah.lemoine', 'manon.girard', 'yanis.morel', 'lea.fontaine'];
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(400);
  verifie('fenêtre des visites : quatre familles (4, 3, 3, 3 visites) et l’entrée libre, chacune annoncée comme une histoire', (await p.locator('.dc-onglet').count()) === 5 && (await p.locator('.dc-onglet-nb').allInnerTexts()).join('') === '4333' && (await p.locator('.dc-diapo').count()) === 1 && /histoire/.test(await p.locator('.dc-tete p').textContent()));
  await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').first().click(); await p.waitForTimeout(700);
  if (MODE === 'sombre') { await p.evaluate((ids) => { const o = {}; for (const id of ids) o[id] = { mode: 'sombre' }; localStorage.setItem('releve.preferences', JSON.stringify(o)); localStorage.setItem('releve.preferences.version', '2'); }, tous); await p.reload(); await p.waitForTimeout(700); }

  // ---- Solvi : dans l'aide et la visite seulement
  verifie('tableau de bord sans mascotte', (await p.locator('.content .solvi, .tb .solvi').count()) === 0 && (await p.locator('.aide-fab .solvi').count()) === 1);

  // ---- une couleur par profil
  const attendues = { 'Titulaire 1': 'ciel', 'Titulaire 2': 'bleu', Pharmacien: 'sarcelle', 'Préparateur': 'indigo', Animateur: 'rose', Apprenti: 'emeraude', 'Étudiant': 'ambre' };
  const vues = {};
  for (const r of Object.keys(attendues)) { await role(r); vues[r] = await theme(); if (!MOBILE && (r === 'Pharmacien' || r === 'Animateur')) await audit(`couleur de profil · ${r}`, `profil-${attendues[r]}`); }
  verifie('chaque profil a sa couleur de base : ' + Object.values(vues).join(', '), Object.keys(attendues).every((r) => vues[r] === attendues[r]));
  // La couleur de l'espace est celle du profil ; seul le titulaire principal peut changer la sienne.
  await role('Préparateur'); await compte();
  verifie('préparateur : pas de choix de couleur, la couleur du profil est indiquée', (await p.locator('input[name="theme"]').count()) === 0 && /Indigo/.test(await p.locator('#couleur-profil').innerText()));
  await audit('compte · préparateur', 'compte');
  await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('releve.preferences') || '{}'); o['nicolas.lesyndicaliste'] = { ...(o['nicolas.lesyndicaliste'] || {}), theme: 'corail' }; localStorage.setItem('releve.preferences', JSON.stringify(o)); });
  await p.reload(); await p.waitForTimeout(700);
  verifie('une couleur enregistrée auparavant par un préparateur ne s’applique plus', (await theme()) === 'indigo');
  await role('Titulaire 2'); await compte();
  verifie('titulaire secondaire : pas de choix de couleur non plus', (await p.locator('input[name="theme"]').count()) === 0 && /Bleu marine/.test(await p.locator('#couleur-profil').innerText()));
  await role('Titulaire 1'); await compte();
  verifie('titulaire principal : dix couleurs au choix, la sienne cochée', (await p.locator('input[name="theme"]').count()) === 10 && (await p.locator('#theme-ciel').isChecked()));
  await p.locator('label[for="theme-emeraude"]').click(); await p.waitForTimeout(300);
  verifie('titulaire principal : la couleur choisie s’applique', (await theme()) === 'emeraude');
  await role('Animateur'); const anim = await theme(); await role('Titulaire 1');
  verifie('ce choix ne change que son compte', anim === 'rose' && (await theme()) === 'emeraude');
  await compte(); await p.locator('label[for="theme-ciel"]').click(); await p.waitForTimeout(200);

  // ---- horaires d'ouverture : deux boutons à icône, avec leur bulle
  await role('Titulaire 1'); await nav('officine');
  const h = await p.evaluate(() => { const l = [...document.querySelectorAll('.jour-ligne')]; const b = l[0].querySelectorAll('.jl-action'); return { lignes: l.length, boutons: b.length, noms: [...b].map((x) => x.getAttribute('aria-label') || x.textContent.trim()), titre: b[0]?.getAttribute('title'), haut: Math.round(b[0]?.getBoundingClientRect().height), chevauche: l.filter((x) => { const a = x.querySelector('.jl-actions').getBoundingClientRect(); return [...x.querySelectorAll('input')].some((i) => { const r = i.getBoundingClientRect(); return r.right > a.left + 1 && r.left < a.right - 1 && r.bottom > a.top + 1 && r.top < a.bottom - 1; }); }).length }; });
  verifie('horaires : trois actions nommées par jour (coupure, recopier, fermer), sans chevauchement ' + JSON.stringify(h), h.lignes === 7 && h.boutons === 3 && /Coupure le midi : lundi/i.test(h.noms[0]) && /Recopier/i.test(h.noms[1]) && /Fermer ce jour/i.test(h.noms[2]) && !!h.titre && h.chevauche === 0);
  await p.locator('.jl-action').first().focus(); await audit('réglages · horaires', 'horaires');
  await p.locator('.jl-action').first().click(); await p.waitForTimeout(300);
  verifie('« coupure le midi » pose deux plages, le bouton devient « retirer la coupure »', (await p.locator('.jour-ligne').first().locator('input[type=time]').count()) === 4 && /Retirer la coupure/.test(await p.locator('.jour-ligne').first().locator('.jl-action').first().getAttribute('aria-label')));
  await p.locator('.jour-ligne').first().locator('.jl-action').first().click(); await p.waitForTimeout(200);
  // « Recopier » : les horaires du samedi (différents) appliqués aux autres jours ouverts, puis annulés.
  const avantCopie = await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('releve.v3')).officines[JSON.parse(localStorage.getItem('releve.v3')).courante].officine.horaires));
  await p.locator('#jl-recopier-5').click(); await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'Appliquer ces horaires aux autres jours ouverts' }).click(); await p.waitForTimeout(500);
  const apresCopie = await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('releve.v3')); const h = v.officines[v.courante].officine.horaires; return { tout: JSON.stringify(h), lundi: JSON.stringify(h[0]), samedi: JSON.stringify(h[5]), dimanche: JSON.stringify(h[6]) }; });
  verifie('« recopier » applique le samedi aux autres jours ouverts, le dimanche reste fermé', apresCopie.tout !== avantCopie && apresCopie.lundi === apresCopie.samedi && apresCopie.dimanche !== apresCopie.samedi);
  await p.locator('.toast button', { hasText: 'Annuler' }).click().catch(() => {}); await p.waitForTimeout(400);
  verifie('« annuler » rétablit les horaires', (await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('releve.v3')); return JSON.stringify(v.officines[v.courante].officine.horaires); })) === avantCopie);

  // ---- la visite : des chapitres annoncés, une couleur par personne
  await p.evaluate(() => localStorage.setItem('releve.visite.rythme', 'vif'));
  await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); await p.locator('.bandeau-test button', { hasText: 'Tutoriels' }).click(); await p.waitForTimeout(500);
  await p.locator('#dc-onglet-journees').click(); await p.waitForTimeout(300); await p.locator('.dc-point[data-nom="Journée ordinaire"]').click(); await p.waitForTimeout(300); await p.locator('.dc-diapo .btn.primary').click(); await p.waitForTimeout(1200);
  const acte = () => p.evaluate(() => { const a = document.querySelector('.pt-acte'); return a ? { n: a.querySelector('.eyebrow')?.textContent, titre: a.querySelector('h2')?.textContent, fil: !!a.querySelector('.pt-acte-fil'), but: a.querySelector('.pt-acte-but')?.textContent, plan: a.querySelectorAll('.pt-acte-plan li').length, ici: a.querySelector('.pt-acte-plan li.on')?.textContent, faits: a.querySelectorAll('.pt-acte-plan li.fait').length, bouton: a.querySelector('[data-acte]')?.textContent.trim(), fiche: !document.querySelector('.parcours-test.ferme') } : null; });
  const a1 = await acte();
  verifie('la visite s’ouvre sur l’annonce du premier chapitre ' + JSON.stringify(a1), !!a1 && /chapitre 1 sur 4/.test(a1.n) && a1.fil && a1.but.length > 30 && a1.plan === 4 && a1.bouton === 'Commencer' && !a1.fiche);
  verifie('le bouton de l’annonce a le focus', await p.evaluate(() => document.activeElement?.getAttribute('data-acte') === 'go'));
  await audit('visite · annonce de chapitre', 'acte');
  await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  verifie('« Commencer » ouvre la première fiche', (await acte()) === null && (await p.locator('.parcours-test:not(.ferme) h2').textContent()) === 'Le tableau de bord');
  const suivante = async () => { await p.locator('.parcours-test:not(.ferme) .pt-passer, .parcours-test:not(.ferme) [data-suite="etape"]').first().click(); await p.waitForTimeout(1300); };
  await suivante(); await suivante(); await suivante();
  const a2 = await acte();
  verifie('chapitre 2 : annoncé, dans la couleur du préparateur ' + JSON.stringify(a2), !!a2 && /chapitre 2 sur 4/.test(a2.n) && !a2.fil && a2.faits === 1 && a2.bouton === 'Continuer' && (await theme()) === 'indigo');
  await audit('visite · chapitre 2, couleur du préparateur', 'acte-2');
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(700);
  verifie('la flèche droite entre dans le chapitre', (await acte()) === null && (await p.locator('.parcours-test:not(.ferme) h2').textContent()) === 'Ses horaires');
  await suivante();
  const regard = await p.evaluate(() => ({ texte: document.querySelector('.pt-regard b')?.textContent, rideau: !!document.querySelector('.pt-rideau'), theme: document.documentElement.dataset.theme }));
  verifie('changement de personne : un bandeau le dit, l’interface change de couleur ' + JSON.stringify(regard), !!regard.texte && regard.rideau && regard.theme !== 'ciel');
  await audit('visite · changement de regard', 'regard');
  await suivante();
  verifie('retour chez la titulaire : bleu ciel, bandeau à son nom', (await theme()) === 'ciel' && /Caroline/.test((await p.locator('.pt-regard b').textContent().catch(() => '')) || ''));
  await p.waitForTimeout(3600);
  verifie('le bandeau s’efface de lui-même', (await p.locator('.pt-regard').count()) === 0);
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(900); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(1200);
  verifie('revenir en arrière ne ré-annonce pas le chapitre', (await acte()) === null && (await p.locator('.parcours-test:not(.ferme) h2').textContent()) === 'Ses horaires');
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(1300);

  // ---- la démonstration : Solvi part de la fiche, vole bulle rangée, parle, puis le pointeur part de lui
  verifie('étape à démonstration : « Pauses et retards »', (await p.locator('.parcours-test:not(.ferme) h2').textContent()) === 'Pauses et retards');
  const ficheSolvi = await p.locator('.parcours-test .pt-solvi').boundingBox();
  await p.locator('.parcours-test [data-suite="geste"]').click();
  const etat = () => p.evaluate(() => { const g = document.querySelector('.solvi-guide'); const r = g?.getBoundingClientRect(); const q = g?.querySelector('.solvi-guide-qui')?.getBoundingClientRect(); const pt = document.querySelector('.pointe-parcours'); const pr = pt?.getBoundingClientRect(); const c = document.querySelector('.solvi-continuer'); const s = g ? getComputedStyle(g) : null; return { la: !!g, vol: !!g?.classList.contains('en-vol'), x: q ? Math.round(q.left) : null, y: q ? Math.round(q.top) : null, dedans: r ? r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 : null, attend: !!c && !c.disabled, pt: pt && !pt.classList.contains('efface') ? [Math.round(pr.left), Math.round(pr.top)] : null, pose: s ? [s.left, s.top, s.bottom] : null, bulle: g ? getComputedStyle(g.querySelector('.solvi-bulle')).opacity : null, dit: g?.querySelector('.solvi-bulle b')?.textContent }; });
  await p.waitForTimeout(160);
  const depart = await etat();
  verifie('Solvi apparaît là où il se tenait sur la fiche, bulle rangée ' + JSON.stringify([depart.x, depart.y, ficheSolvi && Math.round(ficheSolvi.x), ficheSolvi && Math.round(ficheSolvi.y)]), depart.la && depart.vol && (MOBILE || (!!ficheSolvi && Math.abs(depart.x - ficheSolvi.x) < 30 && Math.abs(depart.y - ficheSolvi.y) < 40)));
  verifie('il est placé par un déplacement, jamais par un bord de l’écran', depart.pose && depart.pose[0] === '0px' && depart.pose[1] === '0px');
  let pose = null; let trajet = 0; let avant = depart;
  for (let k = 0; k < 40; k++) { await p.waitForTimeout(100); const e = await etat(); if (e.x !== null && avant.x !== null) trajet = Math.max(trajet, Math.hypot(e.x - avant.x, e.y - avant.y)); avant = e; if (e.attend && !e.vol) { pose = e; break; } }
  verifie('il vole sans saut (au plus ' + Math.round(trajet) + ' px par dixième de seconde), puis ouvre sa bulle et laisse lire', !!pose && pose.bulle === '1' && pose.dedans && trajet < 330 && !pose.pt);
  await audit('visite · Solvi parle', 'demo');
  // La pause : plus rien n'avance tant qu'on ne reprend pas.
  await p.locator('.solvi-pause').click(); await p.waitForTimeout(6500);
  const fige = await etat();
  verifie('pause : la démonstration attend, même au-delà du temps de lecture', (await p.locator('.solvi-guide.pause').count()) === 1 && fige.attend && !fige.pt && (await p.locator('.solvi-pause').textContent()).trim() === 'Reprendre' && (await p.locator('.overlay .dialog').count()) === 0);
  await audit('visite · démonstration en pause', 'pause');
  await p.locator('.solvi-pause').click(); await p.waitForTimeout(200);
  verifie('reprendre : la démonstration repart', (await p.locator('.solvi-guide.pause').count()) === 0 && (await p.locator('.solvi-pause').textContent()).trim() === 'Pause');
  const t0 = Date.now(); await p.locator('.solvi-continuer').click(); await p.waitForTimeout(130);
  const parti = await etat();
  verifie('« Continuer » n’attend pas : le pointeur part de Solvi ' + JSON.stringify([parti.pt, pose && [pose.x, pose.y]]), !!parti.pt && !!pose && Math.abs(parti.pt[0] - (pose.x + (MOBILE ? 24 : 32))) < 140 && Math.abs(parti.pt[1] - (pose.y + (MOBILE ? 24 : 32))) < 140);
  let ouverte = false; for (let k = 0; k < 40 && !ouverte; k++) { await p.waitForTimeout(100); ouverte = (await p.locator('.overlay .dialog').count()) > 0; }
  verifie('le pointeur glisse, clique, la journée s’ouvre (' + (Date.now() - t0) + ' ms)', ouverte);
  await p.waitForTimeout(1500); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400); await p.keyboard.press('ArrowRight');
  let finie = false; for (let k = 0; k < 60 && !finie; k++) { await p.waitForTimeout(150); finie = (await p.locator('.solvi-guide').count()) === 0; }
  verifie('la flèche droite écourte l’attente : la démonstration se termine', finie);

  console.log(`\n${MOBILE ? 'téléphone' : MODE} : ${controles - ko.length}/${controles} contrôles, ${defauts} défaut(s) d’accessibilité sur ${ecrans} écrans`);
  if (ko.length) console.log('ÉCHECS :\n - ' + ko.join('\n - '));
  console.log(errs.length ? 'ERREURS :\n' + [...new Set(errs)].join('\n') : 'aucune erreur de page');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
