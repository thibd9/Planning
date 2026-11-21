// Parcours de bout en bout de la livraison : connexion, menu titulaire, vue mois, fiche équipe, journal, fiche navette,
// mes demandes, remplacement urgent jusqu'à l'accord, assistant, impression. Audit axe sur chaque écran.
const { chromium } = require('playwright');
const fs = require('fs');
const axeSrc = fs.readFileSync(__dirname + '/axe/node_modules/axe-core/axe.min.js', 'utf8');
const URL = process.env.URL || 'http://localhost:5180/';
const MODE = process.env.MODE || 'clair';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', timezoneId: 'Europe/Paris', deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = []; const ko = []; let defauts = 0, ecrans = 0, controles = 0;
  p.on('pageerror', (e) => errs.push('PAGE ' + e.message)); p.on('console', (m) => (m.type() === 'error' || /same key/.test(m.text())) && errs.push(m.text().slice(0, 300)));
  const verifie = (nom, cond) => { controles++; if (!cond) { ko.push(nom); console.log('  ÉCHEC', nom); } };
  const audit = async (nom) => {
    await p.waitForTimeout(700); await p.evaluate(axeSrc);
    const r = await p.evaluate(async () => await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }));
    defauts += r.violations.length; ecrans++;
    for (const x of r.violations) { console.log(`== ${nom} [${x.id}] (${x.nodes.length})`); for (const n of x.nodes.slice(0, 4)) console.log('     ', n.target.join(' ').slice(0, 100), '|', (n.any[0]?.message || n.failureSummary || '').slice(0, 140)); }
  };
  const nav = async (v) => { await p.locator(`[data-tour="nav-${v}"]`).click(); await p.waitForTimeout(450); };
  const role = async (nom) => { if (!(await p.locator('.bandeau-test').isVisible())) { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); } await p.locator('.bandeau-test button', { hasText: nom }).first().click(); await p.waitForTimeout(600); };
  const txt = (sel) => p.locator(sel).allTextContents();

  // ---------- Connexion
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(900);
  const cx = await p.evaluate(() => {
    const carte = document.querySelector('.cx-carte, .connexion form, form').getBoundingClientRect(); const marque = document.querySelector('.cx-marque').getBoundingClientRect();
    return { h1: document.querySelector('h1').textContent, texte: document.body.innerText, centre: Math.abs(marque.left + marque.width / 2 - (carte.left + carte.width / 2)), taches: [...document.querySelectorAll('.cx-tache')].map((e) => getComputedStyle(e).animationName), flottants: document.querySelectorAll('.cx-logo-flottant, .cx-etapes, .cx-pas').length };
  });
  verifie('connexion : titre « Connexion », plus de « Bon retour »', cx.h1 === 'Connexion' && !/Bon retour/.test(cx.texte));
  verifie('connexion : logo centré sur la carte', cx.centre < 3);
  verifie('connexion : formes fixes, aucune animation, aucun logo flottant ni étapes 1-2-3', cx.taches.length >= 3 && cx.taches.every((a) => a === 'none') && cx.flottants === 0);
  verifie('connexion : « Créer ma pharmacie » et « Comment ça marche ? » visibles', await p.getByRole('button', { name: /Créer ma pharmacie/ }).isVisible() && await p.getByRole('button', { name: /Comment ça marche/ }).isVisible());
  await audit('connexion');
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(600);
  { const titre = () => p.locator('.dc-diapo h3').innerText(); const t1 = await titre(); await p.locator('.dc-point[data-nom="Titulaire"]').click(); await p.waitForTimeout(700); const t2 = await titre(); await p.locator('.dc-carrousel').press('ArrowLeft'); await p.waitForTimeout(700); const t3 = await titre();
    verifie(`découvrir : une visite à la fois, on passe de l’une à l’autre par son nom ou au clavier (${t1} → ${t2} → ${t3})`, (await p.locator('.dc-diapo').count()) === 1 && t1 === 'Tout Solvéa, de zéro' && t2 === 'Gérer la pharmacie' && t3 === t1 && (await p.locator('.dc-onglet').count()) === 5 && (await p.locator('.dc-point').count()) === 4 && (await p.locator('.dc-fleche').count()) === 0 && (await p.locator('.dc-chapitres li').count()) >= 6);
    await audit('découvrir · carrousel');
    await p.locator('#dc-onglet-libre').click(); await p.waitForTimeout(300);
    verifie('découvrir : entrée libre en testeur, sept profils', (await p.locator('.dc-role').count()) >= 7 && /en testeur/.test(await p.locator('.dc-libre').innerText()));
    await p.locator('#dc-onglet-parcours').click(); await p.waitForTimeout(300); }
  await audit('découvrir');
  await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').first().click(); await p.waitForTimeout(700);
  if (MODE === 'sombre') { await p.evaluate(() => { const o = {}; for (const id of ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste']) o[id] = { theme: 'ciel', texte: 'normal', mode: 'sombre' }; localStorage.setItem('releve.preferences', JSON.stringify(o)); }); await p.reload(); await p.waitForTimeout(700); }

  // ---------- Titulaire : un menu dans l'ordre du travail, sans espace personnel
  const groupes = (await txt('.side .nav-label')).map((t) => t.replace(/, étape.*$/s, '').replace(/\d/g, '').trim());
  verifie('menu titulaire : Préparer, Planifier, Suivre, Bilan, dans cet ordre', ['Préparer', 'Planifier', 'Suivre', 'Bilan'].every((g, i, l) => groupes.indexOf(g) >= 0 && (i === 0 || groupes.indexOf(g) > groupes.indexOf(l[i - 1]))));
  verifie('menu titulaire : « Mon planning » y est, pas « Mes demandes » ni « Mon suivi »', (await txt('.side a, .side button')).some((t) => /Mon planning/.test(t)) && !(await txt('.side a, .side button')).some((t) => /Mes demandes|Mon suivi/.test(t)));
  verifie('tableau de bord : où en est le planning, et l’équipe aujourd’hui', await p.locator('[data-focus="cycle"]').count() === 1 && await p.locator('.tb-auj').count() === 1);
  await audit('tableau');

  // Vue mois
  await nav('construire'); await audit('construire, semaine');
  verifie('construire : bouton d’impression', await p.getByRole('button', { name: 'Imprimer le planning' }).count() === 1);
  await p.getByRole('button', { name: 'Mois', exact: true }).click(); await p.waitForTimeout(700);
  const mois = await p.evaluate(() => {
    const cases = [...document.querySelectorAll('table.mo button.mo-c:not(.mo-poser)')]; const leg = document.querySelector('.mo-legende'); const table = document.querySelector('table.mo');
    return { cases: cases.length, horaires: cases.every((c) => /^\d{1,2}h(\d\d)?\d{1,2}h(\d\d)?/.test(c.textContent)), legendeAvant: !!(leg.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING), legende: leg.innerText, effectif: [...document.querySelectorAll('.mo-effectif .mo-obj')].map((e) => e.textContent.trim()), groupes: [...document.querySelectorAll('.mo-groupe')].map((e) => e.textContent.trim()), texte: table.innerText, jours: document.querySelectorAll('.mo-jours th').length, auj: (() => { const a = document.querySelector('th.auj'); const z = document.querySelector('.mois .plan-scroll'); if (!a) return true; const r = a.getBoundingClientRect(), s = z.getBoundingClientRect(); return r.left >= s.left && r.right <= s.right; })() };
  });
  verifie('mois : l’horaire est écrit dans chaque case', mois.cases > 40 && mois.horaires);
  verifie('mois : légende en mots, au-dessus de la grille', mois.legendeAvant && /Matin/.test(mois.legende) && /Congé/.test(mois.legende));
  verifie('mois : par jour, une coche ou le manque, jamais « 2/2 »', mois.effectif.length > 8 && mois.effectif.every((e) => /^(Complet|−\d+ au comptoir)$/.test(e)));
  verifie('mois : lignes rangées par poste, heures « x h sur y h », sans pourcentage', mois.groupes.some((g) => /^Pharmaciens/.test(g)) && mois.groupes.includes('Préparateurs') && /\d+ h sur \d+ h/.test(mois.texte) && !/%/.test(mois.texte));
  verifie('mois : seuls les jours du mois, et aujourd’hui visible sans défiler', mois.jours >= 7 && mois.jours <= 31 && mois.auj);
  await audit('construire, mois');
  await p.getByLabel('Afficher les préférences').check(); await p.waitForTimeout(300); await audit('construire, mois avec préférences');
  await p.locator('table.mo button.mo-c').first().click(); await p.waitForTimeout(500);
  verifie('mois : un clic sur une case ouvre la semaine', await p.locator('table.mo').count() === 0 && await p.locator('.plan-bar').count() >= 1);

  // Fiche d'une personne
  await nav('equipe');
  const fiche = await p.evaluate(() => ({ comp: document.querySelectorAll('.comp').length, icones: [...document.querySelectorAll('.comp')].every((c) => c.querySelector('svg')), familles: document.querySelectorAll('.comp-famille').length, titres: document.querySelectorAll('.fiche > details.acc > summary .acc-ico svg').length, ecart: (() => { const l = [...document.querySelectorAll('.comp-famille:first-child .comp')]; return l.length > 1 ? l[1].getBoundingClientRect().left - l[0].getBoundingClientRect().right : 0; })(), groupes: [...document.querySelectorAll('.poste-titre')].map((e) => e.textContent.replace(/·.*/, '').trim()) }));
  verifie('fiche : 22 compétences, chacune avec son icône, en trois familles', fiche.comp === 22 && fiche.icones && fiche.familles === 3);
  verifie('fiche : compétences espacées, rubriques titrées avec icône', fiche.ecart >= 9 && fiche.titres >= 5);
  verifie('équipe : animateurs, apprentis et étudiants dans des groupes séparés', ['Animateurs', 'Apprentis', 'Étudiants'].every((g) => fiche.groupes.includes(g)));
  const avant = await p.locator('.comp.on').count(); await p.locator('.comp:not(.on)').first().click(); await p.waitForTimeout(200);
  verifie('fiche : toucher une compétence l’ajoute', await p.locator('.comp.on').count() === avant + 1);
  await p.locator('.comp.on').last().click();
  await audit('équipe');
  const coche = await p.evaluate(() => { const c = document.querySelector('.fiche input[type="checkbox"]'); return c ? getComputedStyle(c).appearance : 'absent'; });
  verifie('cases à cocher au style de l’application', coche === 'none');

  // Formation nommée
  await p.locator('.top-creer').click(); await p.locator('.menu button', { hasText: 'Une formation' }).click(); await p.waitForTimeout(400);
  verifie('formation : on peut la nommer', await p.locator('#formation-intitule').count() === 1);
  await audit('fenêtre formation'); await p.keyboard.press('Escape');

  // Journal et fiche navette
  await nav('journal');
  const jr = await p.evaluate(() => ({ jours: document.querySelectorAll('.jr-jour').length, natures: [...document.querySelectorAll('.jr-nature')].map((e) => e.textContent), filtres: document.querySelectorAll('.jr-filtre').length, chiffres: document.querySelectorAll('.chiffre').length, entrees: document.querySelectorAll('.jr').length }));
  verifie('journal : rangé par jour, chaque événement avec sa nature, chiffres en tête', jr.jours >= 2 && jr.natures.length === jr.entrees && jr.chiffres === 3);
  await p.locator('.jr-filtre', { hasText: 'Absences' }).click(); await p.waitForTimeout(250);
  verifie('journal : le filtre ne garde que la nature choisie', (await txt('.jr-nature')).every((t) => t === 'Absence') && (await p.locator('.jr').count()) >= 1 && (await p.locator('.jr').count()) < jr.entrees);
  await audit('journal');
  await p.getByRole('button', { name: 'Fiche navette', exact: true }).click(); await p.waitForTimeout(400);
  const nv = await p.evaluate(() => ({ lignes: document.querySelectorAll('table.nv tbody tr').length, total: document.querySelector('table.nv tfoot')?.innerText ?? '', heures: [...document.querySelectorAll('table.nv tbody .nv-heures')].map((e) => parseFloat(e.textContent.replace(',', '.'))), chiffres: [...document.querySelectorAll('.chiffre b')].map((e) => e.textContent), titre: document.querySelector('.nv-barre .label').textContent.trim(), majuscules: [...document.querySelectorAll('.nv-qui b')].some((e) => getComputedStyle(e).textTransform === 'uppercase') }));
  const somme = Math.round(nv.heures.reduce((a, x) => a + x, 0) * 10) / 10;
  verifie('fiche navette : une ligne par salarié, total du mois juste', nv.lignes >= 8 && nv.total.includes(String(somme).replace('.', ',')) && nv.chiffres[1].startsWith(String(somme).replace('.', ',')));
  verifie('fiche navette : noms lisibles, mois en toutes lettres', !nv.majuscules && /^Novembre 2026/.test(nv.titre));
  await audit('fiche navette');
  await p.getByRole('button', { name: 'Mois suivant' }).click(); await p.waitForTimeout(300);
  verifie('fiche navette : on change de mois avec les flèches', /^Décembre 2026/.test((await p.locator('.nv-barre .label').textContent()).trim()));

  for (const v of ['officine', 'regles', 'gardes', 'messages', 'heures', 'equite']) { await nav(v); await audit(v); }
  await nav('resoudre'); await audit('résoudre');
  for (const o of await txt('.content .onglet')) { await p.locator('.content .onglet', { hasText: o.replace(/\d.*$/, '').trim() }).first().click(); await audit('résoudre · ' + o.replace(/\d.*$/, '').trim()); }

  // Assistant : une vraie question, une réponse lue dans le planning
  await nav('tableau'); await p.locator('.aide-fab').click(); await p.waitForTimeout(300);
  await p.fill('#aide-question', 'Qui travaille demain ?'); await p.locator('.aide-envoyer').click(); await p.waitForTimeout(900);
  verifie('assistant : répond « qui travaille demain » avec les personnes et leurs horaires', (await p.locator('.aide-bulle.bot li').count()) >= 4 && /\d+ h/.test((await txt('.aide-bulle.bot li'))[0]));
  await p.fill('#aide-question', 'Que dois-je décider ?'); await p.locator('.aide-envoyer').click(); await p.waitForTimeout(900);
  verifie('assistant : compte les décisions en attente', /décision|Rien n’attend/.test((await txt('.aide-bulle.bot p')).pop()));
  await audit('assistant'); await p.keyboard.press('Escape');
  verifie('les aides sous les champs restent à leur place (plus de collision de style)', await p.evaluate(() => [...document.querySelectorAll('.aide')].every((e) => getComputedStyle(e).position !== 'fixed')));

  // ---------- Préparatrice : mon planning, mes demandes, un remplacement urgent
  await role('Préparateur'); await nav('moi');
  verifie('équipe : menu personnel', (await txt('.side a, .side button')).some((t) => /Mes demandes/.test(t)));
  const seg = await txt('.page-head .seg button, .content .seg button');
  verifie('mon planning : Semaine ou Calendrier, sans « Toute l’équipe »', seg.includes('Semaine') && seg.includes('Calendrier') && !seg.some((t) => /équipe/i.test(t)));
  verifie('mon planning : chacun peut imprimer', await p.getByRole('button', { name: /Imprimer/ }).count() >= 1);
  await audit('mon planning');
  await nav('demandes');
  verifie('mes demandes : trois cartes pour trois choses', (await p.locator('.voie').count()) === 3 && (await txt('.voie-texte b')).join('|') === 'Mes préférences|Absence ou horaire|Me faire remplacer');
  await p.locator('.voie', { hasText: 'Mes préférences' }).click(); await p.waitForTimeout(400);
  verifie('préférences : plus de codes « M 5/3 » dans le calendrier', !/[MA] \d\/\d/.test(await p.locator('.sh-mois').innerText()));
  await audit('mes demandes · préférences');
  await p.locator('.voie', { hasText: 'Absence ou horaire' }).click(); await p.waitForTimeout(400);
  verifie('absences : chaque demande montre ses trois étapes', (await p.locator('.dm').count()) >= 1 && (await p.locator('.dm .etapes').count()) === (await p.locator('.dm').count()) && (await txt('.dm .etapes li')).slice(0, 3).map((t) => t.split(' :')[0]).join('|') === 'Envoyée|Réponse du titulaire|Au planning');
  await audit('mes demandes · absences');
  await p.getByRole('button', { name: /Nouvelle demande/ }).click(); await p.waitForTimeout(400); verifie('absences : « Nouvelle demande » ouvre la fenêtre', await p.locator('.dialog').count() === 1); await audit('fenêtre de demande'); await p.keyboard.press('Escape');
  await p.locator('.voie', { hasText: 'Me faire remplacer' }).click(); await p.waitForTimeout(400);
  verifie('remplacements : le délai est expliqué, urgent puis normal', (await txt('.dm-groupe')).length === 2 && /moins de 7 jours/.test((await txt('.dm-groupe'))[0]));
  await audit('mes demandes · remplacements');
  await p.locator('.dm .btn', { hasText: 'Demande urgente' }).nth(2).click(); await p.waitForTimeout(400);
  const radios = await p.evaluate(() => { const l = [...document.querySelectorAll('.dialog .choix.urgence label')].map((e) => e.getBoundingClientRect()); return { n: l.length, empiles: l.every((r, i) => i === 0 || r.top > l[i - 1].top), delai: !!document.querySelector('.dialog .delai-info') }; });
  verifie('demande de remplacement : délai rappelé, niveaux d’urgence lisibles', radios.n >= 2 && radios.empiles && radios.delai);
  await p.locator('.dialog .choix.urgence label', { hasText: 'Urgence médicale' }).click(); await p.waitForTimeout(200);
  verifie('urgence médicale : justificatif proposé', await p.locator('.dialog .piece').count() === 1);
  await audit('fenêtre de remplacement');
  await p.locator('.dialog-foot .btn.primary').click(); await p.waitForTimeout(500);
  verifie('ma demande : étape 1 faite, réponse du titulaire en cours', (await txt('.dm.actif .etapes li.fait')).length === 1 && (await p.locator('.dm.actif .etapes li.cours').count()) === 1 && /pas encore répondu/.test(await p.locator('.dm.actif .dm-etat').innerText()));
  await p.locator('.aide-fab').click(); await p.fill('#aide-question', 'Mon prochain poste ?'); await p.locator('.aide-envoyer').click(); await p.waitForTimeout(900);
  verifie('assistant, côté équipe : mon prochain poste', /^Votre prochain poste|^Vous êtes en poste/.test((await txt('.aide-bulle.bot p')).pop())); await p.keyboard.press('Escape');
  await nav('suivi'); await audit('mon suivi'); await nav('equipe-planning').catch(() => {});

  // ---------- Titulaire : la demande médicale arrive en tête, elle l'accepte
  await role('Titulaire 1'); await nav('resoudre'); await p.locator('.content .onglet', { hasText: 'Remplacements' }).click(); await p.waitForTimeout(400);
  verifie('résoudre : l’urgence médicale est en tête, avec sa pastille', await p.locator('.demande-r').first().evaluate((e) => e.classList.contains('u-medical') && /Urgence médicale/.test(e.textContent)));
  await audit('résoudre · demande médicale');
  await p.locator('.demande-r.u-medical button', { hasText: 'Décider' }).click(); await p.waitForTimeout(500);
  verifie('décider : la fenêtre montre qui peut reprendre le poste et ce qui se passe sinon', (await p.locator('.dialog .dr-bloc').count()) === 4 && await p.locator('#dr-confirmer').isDisabled());
  await audit('fenêtre · décider d’un remplacement');
  await p.locator('label[for="dr-confier"]').click().catch(() => {}); await p.waitForTimeout(300); await p.locator('.dialog').screenshot({ path: __dirname + '/shots/decision.png' });
  await p.locator('label[for="dr-equipe"]').click(); await p.locator('#dr-confirmer').click(); await p.waitForTimeout(500);
  await role('Préparateur'); await nav('demandes'); await p.locator('.voie', { hasText: 'Me faire remplacer' }).click(); await p.waitForTimeout(400);
  verifie('ma demande : accord donné, étape 2 faite', (await p.locator('.dm.actif .etapes li.fait').count()) >= 2);

  // ---------- Pharmacienne : ses gardes, imprimables
  await role('Pharmacien'); await audit('pharmacien · mon planning');
  await nav('mesgardes'); verifie('mes gardes : bouton d’impression', await p.getByRole('button', { name: /Imprimer/ }).count() >= 1); await audit('mes gardes');
  await nav('demandes'); await audit('pharmacien · mes demandes');

  console.log(`\n${MODE} : ${controles - ko.length}/${controles} contrôles, ${defauts} défaut(s) d’accessibilité sur ${ecrans} écrans`);
  if (ko.length) console.log('ÉCHECS :\n - ' + ko.join('\n - '));
  console.log(errs.length ? 'ERREURS :\n' + [...new Set(errs)].join('\n') : 'aucune erreur de page');
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
