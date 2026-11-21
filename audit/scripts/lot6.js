// Sixième lot : menu, Solvi, cartes de remplacement, raison obligatoire, demandes simultanées, frise des absences.
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
    if (capture) await p.screenshot({ path: `${__dirname}/shots/l6-${MOBILE ? 'm' : MODE}-${capture}.png`, fullPage: !MOBILE && capture.endsWith('+') });
  };
  const nav = async (v) => { if (MOBILE && !(await p.locator(`[data-tour="nav-${v}"]:visible`).count())) { await p.locator('.burger, [aria-label="Ouvrir le menu"]').first().click().catch(() => {}); await p.waitForTimeout(300); } await p.locator(`[data-tour="nav-${v}"]:visible`).first().click(); await p.waitForTimeout(450); };
  const role = async (nom) => { if (!(await p.locator('.bandeau-test').isVisible())) { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); } await p.locator('.bandeau-test button', { hasText: nom }).first().click(); await p.waitForTimeout(600); };
  const txt = (sel) => p.locator(sel).allTextContents();
  const donnees = async (f) => { await p.waitForTimeout(350); return p.evaluate((corps) => { const v = JSON.parse(localStorage.getItem('releve.v3')); return new Function('d', `return (${corps})(d)`)(v.officines[v.courante]); }, f.toString()); };
  const cloche = () => p.getByRole('button', { name: /notifications, ouvrir la liste|Aucune notification/ });

  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(400); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').first().click(); await p.waitForTimeout(700);
  if (MODE === 'sombre') { await p.evaluate(() => { const o = {}; for (const id of ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste']) o[id] = { theme: 'ciel', texte: 'normal', mode: 'sombre' }; localStorage.setItem('releve.preferences', JSON.stringify(o)); }); await p.reload(); await p.waitForTimeout(700); }

  // ---------- Menu : plus de numéros, un fil dans l'ordre du travail
  if (!MOBILE) {
    const menu = await p.evaluate(() => ({ visibles: [...document.querySelectorAll('.side .nav-etape')].filter((e) => getComputedStyle(e).display !== 'none').length, groupes: document.querySelectorAll('.side .nav-groupe.ordre').length, chiffres: [...document.querySelectorAll('.side .nav-label')].map((e) => e.innerText).filter((t) => /\d/.test(t.replace(/étape \d sur \d/gi, ''))).length, filet: getComputedStyle(document.querySelector('.side .nav-groupe.ordre .nav-label'), '::after').height, fil: getComputedStyle(document.querySelector('.nav-groupe.ordre'), '::before').display, actif: getComputedStyle(document.querySelector('.side .nav-item.on')).backgroundImage }));
    verifie('menu : quatre groupes, un filet après chaque intitulé, sans numéro ni fil, rubrique ouverte en aplat', menu.groupes === 4 && menu.visibles === 0 && menu.chiffres === 0 && menu.filet === '1px' && menu.fil === 'none' && /gradient/.test(menu.actif));
  }
  // ---------- Solvi : dans le bouton d'aide, puis dans l'assistant, avec son humeur
  verifie('Solvi tient le bouton d’aide', (await p.locator('.aide-fab .solvi svg').count()) === 1);
  await p.locator('.aide-fab').click(); await p.waitForTimeout(500);
  verifie('assistant : Solvi accueille, heureux', (await p.locator('.aide-tete .solvi.h-heureux').count()) === 1 && (await p.locator('.aide-tete h2 [role="img"][aria-label="Solvi"]').count()) === 1);
  await p.fill('#aide-question', 'xyzzy plugh'); await p.locator('.aide-envoyer').click(); await p.waitForTimeout(1400);
  verifie('assistant : Solvi est perplexe quand il ne sait pas, et renvoie vers une personne', (await p.locator('.aide-tete .solvi.h-confus').count()) === 1 && (await p.locator('.aide-support .btn').count()) >= 1);
  await p.fill('#aide-question', 'Qui travaille demain ?'); await p.locator('.aide-envoyer').click(); await p.waitForTimeout(1400);
  verifie('assistant : Solvi est content quand il a répondu', (await p.locator('.aide-tete .solvi.h-content').count()) === 1);
  await audit('assistant · Solvi', 'solvi-assistant');
  await p.locator('.aide-fab').click(); await p.waitForTimeout(300);

  // ---------- Remplacements : une carte par demande, entourée
  await nav('resoudre'); await p.locator('.content .onglet', { hasText: 'Remplacements' }).click(); await p.waitForTimeout(400);
  const cartes = await p.evaluate(() => [...document.querySelectorAll('.demandes-pile .demande-r')].map((e) => { const c = getComputedStyle(e); return { bord: c.borderTopWidth, fond: c.backgroundColor }; }));
  verifie('remplacements : des cartes séparées, sur fond blanc, entourées', cartes.length >= 1 && cartes.every((c) => c.bord === '2px') && new Set(cartes.map((c) => c.fond)).size === 1);
  await audit('résoudre · remplacements', 'remplacements');

  // ---------- Une demande porte toujours sa raison
  await role('Pharmacien'); await nav('demandes'); await p.locator('.voie', { hasText: 'Absence' }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /Nouvelle demande/ }).click(); await p.waitForTimeout(400);
  verifie('demande : la raison est obligatoire', /donnez sa raison/.test(await p.locator('.dialog').innerText()) && await p.locator('.dialog-foot .btn.primary').isDisabled());
  await p.locator('.dialog button', { hasText: 'Sortie d’école' }).click(); await p.waitForTimeout(200);
  verifie('demande : un raccourci présélectionne la raison', (await p.locator('#demande-motif').inputValue()) === 'famille');
  await p.locator('.dialog button', { hasText: 'Sortie d’école' }).click(); await p.waitForTimeout(200);
  // Un congé sur les dates déjà demandées par Nicolas
  const conge = await donnees((d) => { const a = d.absences.find((x) => x.personId === 'p_camille' && x.statut === 'demandee'); return { from: a.from, to: a.to }; });
  await p.locator('.dialog select').nth(1).selectOption('absence'); await p.waitForTimeout(200);
  const dates = p.locator('.dialog input[type=date]'); await dates.nth(0).fill(conge.from); await dates.nth(1).fill(conge.to); await p.waitForTimeout(300);
  verifie('demande : « un collègue a déjà demandé ces dates », sans nom', /Un collègue est déjà absent ou a demandé ces dates/.test(await p.locator('.dialog').innerText()) && !/Nicolas/.test(await p.locator('.dialog .notice.info').innerText()));
  await p.selectOption('#demande-motif', 'repos'); await p.fill('#demande-precision', 'Vacances en famille');
  await audit('fenêtre de demande · raison', 'demande');
  await p.locator('.dialog-foot .btn.primary').click(); await p.waitForTimeout(500);
  verifie('demande : la raison part avec la demande', await donnees((d) => d.absences.some((a) => a.personId === 'p_karim' && a.statut === 'demandee' && a.motif === 'repos' && a.precision === 'Vacances en famille')));
  verifie('équipe : la frise des absences est discrète (ni nature, ni demandes des autres)', (await p.locator('.fc .fc-barre.attente').count()) === 0 && (await p.locator('.fc-legende').count()) === 0);

  // ---------- Deux demandes sur les mêmes dates : le titulaire les voit ensemble
  await role('Titulaire 1'); await nav('resoudre'); await p.locator('.content .onglet', { hasText: 'Demandes' }).click(); await p.waitForTimeout(500);
  const dem = await p.evaluate(() => ({ pastilles: [...document.querySelectorAll('.decision .pill.warn')].filter((e) => /demandes sur ces dates/.test(e.textContent)).length, meme: [...document.querySelectorAll('.meme-temps')].map((e) => e.innerText), raisons: [...document.querySelectorAll('.demande-motif')].map((e) => e.innerText.replace(/\n/g, ' ')), frise: document.querySelectorAll('.fc .fc-ligne').length, attente: document.querySelectorAll('.fc .fc-barre.attente').length }));
  verifie('deux demandes sur les mêmes dates : signalées sur chacune, dans l’ordre d’arrivée', dem.pastilles === 2 && dem.meme.length >= 2 && dem.meme.some((t) => /Igor L\. demande aussi[\s\S]*arrivée après/.test(t)) && dem.meme.some((t) => /Nicolas L\. demande aussi[\s\S]*arrivée avant/.test(t)));
  verifie('titulaire : la raison de chaque demande est affichée', dem.raisons.some((t) => /Congés, repos.*Vacances en famille/.test(t)));
  verifie('frise des absences : une ligne par personne, demandes en pointillés', dem.frise >= 2 && dem.attente >= 2);
  await audit('résoudre · demandes simultanées', 'simultanees+');
  await p.locator('.panneau .decision', { hasText: 'Nicolas' }).locator('[data-decider]').first().click(); await p.waitForTimeout(400); await p.locator('label[for="dc-accepter"], label[for="dc-preference"]').first().click(); await p.locator('#dc-confirmer').click(); await p.waitForTimeout(600);
  verifie('décision : l’annonce rappelle la demande restée en attente', await donnees((d) => /Reste à trancher sur ces dates : la demande de Igor L\./.test(d.annonces[0].effets.join(' '))));
  verifie('après la décision : « Nicolas est déjà absent » sur la demande d’Igor', /Nicolas L\. est déjà absent/.test((await txt('.meme-temps')).join(' ')));

  console.log(`\n${MOBILE ? 'téléphone' : MODE} : ${controles - ko.length}/${controles} contrôles, ${defauts} défaut(s) d’accessibilité sur ${ecrans} écrans`);
  if (ko.length) console.log('ÉCHECS :\n - ' + ko.join('\n - '));
  console.log(errs.length ? 'ERREURS :\n' + [...new Set(errs)].join('\n') : 'aucune erreur de page');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
