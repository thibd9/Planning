// Septième lot : régulariser un compteur à un moment choisi (rattrapage, récupération), avec message.
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
    if (capture) await p.screenshot({ path: `${__dirname}/shots/l7-${MOBILE ? 'm' : MODE}-${capture}.png`, fullPage: !MOBILE && capture.endsWith('+') });
  };
  const nav = async (v) => { if (MOBILE && !(await p.locator(`[data-tour="nav-${v}"]:visible`).count())) { await p.locator('.burger, [aria-label="Ouvrir le menu"]').first().click().catch(() => {}); await p.waitForTimeout(300); } await p.locator(`[data-tour="nav-${v}"]:visible`).first().click(); await p.waitForTimeout(450); };
  const role = async (nom) => { if (!(await p.locator('.bandeau-test').isVisible())) { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); } await p.locator('.bandeau-test button', { hasText: nom }).first().click(); await p.waitForTimeout(600); };
  const txt = (sel) => p.locator(sel).allTextContents();
  const donnees = async (f) => { await p.waitForTimeout(350); return p.evaluate((corps) => { const v = JSON.parse(localStorage.getItem('releve.v3')); return new Function('d', `return (${corps})(d)`)(v.officines[v.courante]); }, f.toString()); };
  const cloche = () => p.getByRole('button', { name: /notifications, ouvrir la liste|Aucune notification/ });

  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(400); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').first().click(); await p.waitForTimeout(700);
  if (MODE === 'sombre') { await p.evaluate(() => { const o = {}; for (const id of ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste']) o[id] = { theme: 'ciel', texte: 'normal', mode: 'sombre' }; localStorage.setItem('releve.preferences', JSON.stringify(o)); }); await p.reload(); await p.waitForTimeout(700); }


  await nav('heures');
  const etat0 = await donnees((d) => ({ regs: (d.regularisations || []).length, msgs: d.messages.length, annonces: (d.annonces || []).length }));
  const boutons = await p.locator('[data-regul="rattrapage"]').count();
  verifie('heures : au moins un compteur à faire rattraper', boutons >= 1);
  const ligne = p.locator('.hc', { has: p.locator('[data-regul="rattrapage"]') }).first();
  const nomLigne = (await ligne.locator('.hc-nom b').innerText()).trim(); const prenom = nomLigne.split(' ')[0];
  await ligne.locator('[data-regul="rattrapage"]').click(); await p.waitForTimeout(700);
  verifie('fenêtre : « Faire rattraper des heures à … »', new RegExp(`Faire rattraper des heures à ${prenom}`).test(await p.locator('.dialog h2').innerText()));
  const cartes = await p.locator('.rat-carte').count();
  verifie('fenêtre : des créneaux proposés et la semaine à construire', cartes >= 2 && (await p.locator('.rat-tag.conseille').count()) === 1);
  verifie('le créneau conseillé est retenu d’emblée, sans règle enfreinte', (await p.locator('.rat-carte').first().getAttribute('aria-pressed')) === 'true' && !(await p.locator('#rat-controle').getAttribute('class')).includes('ko'));
  const pl = await p.evaluate(() => ({ lignes: document.querySelectorAll('.rat-pl-ligne:not(.tete)').length, cases: document.querySelectorAll('.rat-pl-case').length, choisi: document.querySelectorAll('.rat-pl-choisi').length, postes: document.querySelectorAll('.rat-pl-poste').length, date: document.querySelector('#rat-date').value }));
  verifie('planning : sept jours, les postes de la personne, des plages cliquables et le créneau retenu', pl.lignes === 7 && pl.cases > 10 && pl.choisi === 1 && pl.postes >= 1 && !!pl.date);
  const avantDuree = await p.locator('#rat-minutes').innerText();
  await p.getByRole('button', { name: 'Une demi-heure de moins' }).click(); await p.waitForTimeout(400);
  verifie('durée : réglable par demi-heures', (await p.locator('#rat-minutes').innerText()) !== avantDuree);
  verifie('message : proposé, au prénom de la personne, avec l’horaire', new RegExp(`Bonjour ${prenom}.*compteur.*rattraper.* de \\d+ h`).test(await p.locator('#rat-texte').inputValue()));
  await audit('heures · fenêtre de rattrapage', 'rattrapage');
  // Un clic dans le planning : le créneau se déplace, les champs suivent, Solvéa ne choisit plus.
  const avantClic = await p.evaluate(() => ({ date: document.querySelector('#rat-date').value, debut: document.querySelector('#rat-debut').value }));
  const autre = p.locator('.rat-pl-ligne:not(.vise):not(.passe) .rat-pl-case').first();
  await autre.click({ force: true }); await p.waitForTimeout(500);
  const apresClic = await p.evaluate(() => ({ date: document.querySelector('#rat-date').value, debut: document.querySelector('#rat-debut').value, auto: document.querySelector('#rat-auto').getAttribute('aria-pressed'), choisi: document.querySelectorAll('.rat-pl-ligne.vise .rat-pl-choisi').length }));
  verifie('planning : un clic place le créneau, les champs suivent', apresClic.date !== avantClic.date && apresClic.choisi === 1 && apresClic.auto === 'false');
  await audit('heures · créneau placé dans le planning', 'place');
  await p.getByRole('button', { name: 'Semaine suivante' }).click(); await p.waitForTimeout(400);
  verifie('planning : on change de semaine', (await p.locator('.rat-pl-semaine b').innerText()) !== '' && (await p.locator('.rat-pl-ligne.vise').count()) === 0);
  // Saisie au clavier : un dimanche est refusé, avec la raison ; le bouton se ferme.
  const dimanche = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  await p.locator('#rat-date').fill(dimanche); await p.waitForTimeout(500);
  verifie('saisie au clavier : un jour fermé est refusé, avec la raison, et le bouton se ferme', /fermée/.test(await p.locator('#rat-controle').innerText()) && (await p.locator('#rat-valider').isDisabled()));
  await audit('heures · créneau refusé', 'refuse');
  // Retour à la proposition, message retouché, puis on planifie.
  await p.locator('#rat-auto').click(); await p.waitForTimeout(500);
  verifie('« Laisser Solvéa choisir » : retour au créneau conseillé', (await p.locator('.rat-carte').first().getAttribute('aria-pressed')) === 'true' && !(await p.locator('#rat-valider').isDisabled()));
  const libelle = (await p.locator('.rat-carte').first().locator('b').innerText()).trim();
  await p.locator('#rat-texte').fill(`Bonjour ${prenom}, on en parle demain ?`); await p.waitForTimeout(200);
  verifie('message : modifiable, avec retour au texte proposé', (await p.getByRole('button', { name: 'Revenir au texte proposé' }).count()) === 1);
  await p.locator('#rat-valider').click(); await p.waitForTimeout(800);
  const apres = await donnees((d) => { const r = d.regularisations[d.regularisations.length - 1]; const lundi = r.semaine; const s = d.semaines[lundi]; const poste = d.shifts.find((x) => x.personId === r.personId && x.date === r.date && x.start <= r.start && r.end <= x.end); const vu = (s && s.snapshot || []).find((x) => x.personId === r.personId && x.date === r.date && x.start <= r.start && r.end <= x.end); const m = d.messages[d.messages.length - 1]; return { regs: d.regularisations.length, r, poste: !!poste, publie: !!(s && s.statut === 'publie'), vu: !!vu, msg: m.texte, a: m.a, msgs: d.messages.length, annonce: d.annonces[0], notif: d.notifications[0] }; });
  verifie('planifié : la régularisation porte le jour et l’horaire', apres.regs === etat0.regs + 1 && !!apres.r.date && apres.r.end > apres.r.start && apres.r.minutes > 0 && apres.r.type === 'rattrapage');
  verifie('planifié : le poste est dans le planning (et dans la version communiquée si elle existe)', apres.poste && (!apres.publie || apres.vu));
  verifie('planifié : le message retouché part à la personne', apres.msgs === etat0.msgs + 1 && apres.a === apres.r.personId && /on en parle demain/.test(apres.msg));
  verifie('planifié : annonce sous la cloche, avec l’avant et l’après', apres.annonce.pour.includes(apres.r.personId) && /→/.test(apres.annonce.effets.join(' ')) && (!apres.publie || apres.notif.personId === apres.r.personId));
  verifie('heures : le rattrapage prévu est écrit avec son jour', /prévu .*\d+ h/.test((await p.locator('.hc', { hasText: nomLigne }).locator('.prevu').allInnerTexts()).join(' ')) || !(await p.locator('.hc', { hasText: nomLigne }).locator('[data-regul]').count()));
  await audit('heures · après le rattrapage', 'apres');
  console.log('   créneau retenu :', libelle, '·', JSON.stringify(apres.r));
  // Sans date précise : la semaine à construire.
  if (await p.locator('[data-regul="rattrapage"]').count()) {
    await p.locator('[data-regul="rattrapage"]').first().click(); await p.waitForTimeout(600);
    await p.locator('#rat-sans-date').click(); await p.waitForTimeout(300);
    await p.locator('#rat-prevenir').uncheck(); await p.waitForTimeout(200);
    const n = await donnees((d) => ({ regs: d.regularisations.length, msgs: d.messages.length }));
    await p.locator('#rat-valider').click(); await p.waitForTimeout(700);
    const s = await donnees((d) => ({ regs: d.regularisations.length, msgs: d.messages.length, r: d.regularisations[d.regularisations.length - 1] }));
    verifie('sans date précise : ajouté à la semaine à construire, sans message', s.regs === n.regs + 1 && s.msgs === n.msgs && !s.r.date && !!s.r.semaine);
  } else console.log('   (plus de compteur négatif : essai « sans date » sauté)');
  // Récupération : on crée un compteur en plus (quatre heures déjà rattrapées en trop) pour une personne à jour.
  await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('releve.v3')); const d = v.officines[v.courante]; const lea = d.personnes.find((x) => x.prenom === 'Léa'); d.regularisations = (d.regularisations || []).concat({ id: 'reg_essai', personId: lea.id, minutes: 240, type: 'rattrapage', at: new Date().toISOString() }); localStorage.setItem('releve.v3', JSON.stringify(v)); });
  await p.reload(); await p.waitForTimeout(900); await nav('heures');
  if (await p.locator('[data-regul="recuperation"]').count()) {
    const l2 = p.locator('.hc', { has: p.locator('[data-regul="recuperation"]') }).first();
    await l2.locator('[data-regul="recuperation"]').click(); await p.waitForTimeout(700);
    verifie('récupération : la fenêtre propose des créneaux', /Faire récupérer/.test(await p.locator('.dialog h2').innerText()) && (await p.locator('.rat-carte').count()) >= 2);
    await audit('heures · fenêtre de récupération', 'recuperation');
    const prop = await p.locator('.rat-tag.conseille').count();
    if (prop) {
      const n = await donnees((d) => d.shifts.reduce((t, x) => t + (x.end - x.start), 0));
      await p.locator('#rat-valider').click(); await p.waitForTimeout(700);
      const s = await donnees((d) => ({ total: d.shifts.reduce((t, x) => t + (x.end - x.start), 0), r: d.regularisations[d.regularisations.length - 1] }));
      verifie('récupération : des heures sont retirées du planning, la régularisation est négative', s.total < n && s.r.minutes < 0 && s.r.type === 'recuperation' && !!s.r.date);
    } else { await p.keyboard.press('Escape'); console.log('   (aucun créneau de récupération proposé)'); }
  } else console.log('   (aucun compteur en plus : récupération non essayée)');

  console.log(`\n${MOBILE ? 'téléphone' : MODE} : ${controles - ko.length}/${controles} contrôles, ${defauts} défaut(s) d’accessibilité sur ${ecrans} écrans`);
  if (ko.length) console.log('ÉCHECS :\n - ' + ko.join('\n - '));
  console.log(errs.length ? 'ERREURS :\n' + [...new Set(errs)].join('\n') : 'aucune erreur de page');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
