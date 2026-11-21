// Dixième lot : prévenir d’un retard en deux gestes, les titulaires sont notifiés.
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
    if (capture) await p.screenshot({ path: `${__dirname}/shots/l10-${MOBILE ? 'm' : MODE}-${capture}.png`, fullPage: !MOBILE && capture.endsWith('+') });
  };
  const nav = async (v) => { if (MOBILE && !(await p.locator(`[data-tour="nav-${v}"]:visible`).count())) { await p.locator('.burger, [aria-label="Ouvrir le menu"]').first().click().catch(() => {}); await p.waitForTimeout(300); } await p.locator(`[data-tour="nav-${v}"]:visible`).first().click(); await p.waitForTimeout(450); };
  const role = async (nom) => { if (!(await p.locator('.bandeau-test').isVisible())) { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); } await p.locator('.bandeau-test button', { hasText: nom }).first().click(); await p.waitForTimeout(600); };
  const donnees = async (f) => { await p.waitForTimeout(350); return p.evaluate((corps) => { const v = JSON.parse(localStorage.getItem('releve.v3')); return new Function('d', `return (${corps})(d)`)(v.officines[v.courante]); }, f.toString()); };
  const tous = ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste', 'sarah.lemoine', 'manon.girard', 'yanis.morel', 'lea.fontaine'];
  if (process.env.HEURE) { const j = new Date(); const [h, m] = process.env.HEURE.split(':').map(Number); j.setHours(h, m, 0, 0); await p.clock.install({ time: j }); }
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(400); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').first().click(); await p.waitForTimeout(700);
  if (MODE === 'sombre') { await p.evaluate((ids) => { const o = {}; for (const id of ids) o[id] = { mode: 'sombre' }; localStorage.setItem('releve.preferences', JSON.stringify(o)); localStorage.setItem('releve.preferences.version', '2'); }, tous); await p.reload(); await p.waitForTimeout(700); }

  // ---- qui peut prévenir : toute personne qui a un poste aujourd'hui ou demain et un titulaire au-dessus d'elle
  verifie('titulaire principal : pas de bouton (personne à prévenir)', (await p.locator('#ret-prevenir').count()) === 0);
  let qui = null;
  for (const r of ['Préparateur', 'Pharmacien', 'Animateur', 'Apprenti', 'Étudiant']) { await role(r); if (await p.locator('#ret-prevenir').count()) { qui = r; break; } }
  verifie('un salarié en poste aujourd’hui ou demain voit « Prévenir d’un retard » sur son accueil (' + qui + ')', !!qui);
  if (!qui) throw new Error('aucun rôle avec un poste proche');
  await nav('moi');
  verifie('le bouton est aussi dans « Mon planning », sous le prochain poste', (await p.locator('.prochain #ret-prevenir').count()) === 1);
  await nav('espace'); await audit('accueil · bouton de retard', 'bouton');

  // ---- deux gestes : la durée, l'envoi
  await p.locator('#ret-prevenir').click(); await p.waitForTimeout(400);
  const debut = await p.evaluate(() => ({ titre: document.querySelector('.dialog h2')?.textContent, coche: document.querySelector('#ret-durees .comp[aria-pressed="true"]')?.textContent.trim(), arrivee: document.querySelector('#ret-arrivee')?.textContent, qui: document.querySelector('.ret-qui')?.textContent, focus: document.activeElement?.id }));
  verifie('fenêtre : 10 min proposés d’office, arrivée calculée, titulaires nommés, envoi sous le doigt ' + JSON.stringify(debut), /retard/i.test(debut.titre) && debut.coche === '10 min' && /Arrivée prévue vers/.test(debut.arrivee) && /Caroline/.test(debut.qui) && /Pierre/.test(debut.qui) && debut.focus === 'ret-envoyer');
  await audit('fenêtre · prévenir d’un retard', 'fenetre');
  const avant = await p.locator('#ret-arrivee b').textContent();
  await p.locator('#ret-durees .comp', { hasText: '15 min' }).click();
  verifie('toucher « 15 min » recalcule l’arrivée', (await p.locator('#ret-arrivee b').textContent()) !== avant && (await p.locator('#ret-durees .comp[aria-pressed="true"]').count()) === 1);
  await p.locator('#ret-motifs .comp', { hasText: 'Transport' }).click(); await p.fill('#ret-note', 'Train supprimé');
  await p.locator('#ret-envoyer').click(); await p.waitForTimeout(500);
  const d1 = await donnees((d) => ({ retards: (d.retards || []).map((r) => [r.personId, r.minutes, r.motif, r.note]), messages: d.messages.filter((m) => /en retard/.test(m.texte)).map((m) => [m.a, m.texte]), annonce: d.annonces[0], chefs: d.personnes.filter((x) => x.qualification === 'titulaire' && !x.externe).map((x) => x.id) }));
  console.log('   avis :', JSON.stringify(d1.retards), '·', d1.messages[0]?.[1]);
  verifie('l’avis est enregistré : 15 min, transport, le mot', d1.retards.length === 1 && d1.retards[0][1] === 15 && d1.retards[0][2] === 'transport' && d1.retards[0][3] === 'Train supprimé');
  verifie('chaque titulaire reçoit un message avec l’heure d’arrivée', d1.messages.length === d1.chefs.length && d1.chefs.every((c) => d1.messages.some((m) => m[0] === c)) && /Arrivée prévue vers/.test(d1.messages[0][1]) && /Transport/.test(d1.messages[0][1]));
  verifie('une notification part aux titulaires, pas à la personne ' + JSON.stringify([d1.annonce.titre, d1.annonce.effets]), /prévient d’un retard de 15 min/.test(d1.annonce.titre) && d1.chefs.every((c) => d1.annonce.pour.includes(c)) && !d1.annonce.pour.includes(d1.retards[0][0]) && /Arrivée prévue vers/.test(d1.annonce.effets[0]));
  verifie('la personne voit son avis, modifiable et annulable', /Retard annoncé : 15 min/.test(await p.locator('.ret-etat').textContent()) && (await p.locator('#ret-modifier').count()) === 1 && (await p.locator('#ret-annuler').count()) === 1 && (await p.locator('#ret-prevenir').count()) === 0);
  verifie('un message de confirmation nomme les titulaires prévenus', /Caroline/.test(await p.locator('.toast').textContent().catch(() => '')));
  await audit('accueil · retard annoncé', 'annonce');

  // ---- côté titulaire : la cloche, la messagerie, le tableau de bord
  await role('Titulaire 1');
  await p.getByRole('button', { name: /notifications, ouvrir la liste/ }).click(); await p.waitForTimeout(300);
  verifie('titulaire : la cloche annonce le retard et l’heure d’arrivée', /prévient d’un retard de 15 min/.test(await p.locator('.menu.cloche').textContent()) && /Arrivée prévue vers/.test(await p.locator('.menu.cloche').textContent()));
  await audit('titulaire · cloche', 'cloche'); await p.keyboard.press('Escape');
  const aujourdhui = await donnees((d) => (d.retards || []).some((r) => r.date === new Date().toLocaleDateString('sv')));
  if (aujourdhui) { verifie('tableau de bord : « Retard annoncé » à côté de la personne', (await p.locator('.tbj-retard').count()) === 1 && /arrivée/.test(await p.locator('.tbj-retard').textContent())); await p.locator('.tbj-retard').scrollIntoViewIfNeeded(); await audit('titulaire · tableau de bord', 'tableau'); }
  else console.log('   (poste concerné : demain, rien à afficher sur l’équipe du jour)');
  await nav('messages');
  verifie('titulaire : le message est dans sa messagerie', /en retard d’environ 15 min/.test(await p.locator('.content').textContent()) || (await p.locator('.content', { hasText: /retard/ }).count()) > 0);
  await role('Titulaire 2');
  await p.getByRole('button', { name: /notifications, ouvrir la liste/ }).click(); await p.waitForTimeout(300);
  verifie('second titulaire : prévenu lui aussi', /prévient d’un retard/.test(await p.locator('.menu.cloche').textContent())); await p.keyboard.press('Escape');

  // ---- corriger, puis annuler
  await role(qui);
  await p.locator('#ret-modifier').click(); await p.waitForTimeout(300);
  verifie('modifier : la fenêtre reprend l’avis', (await p.locator('#ret-durees .comp[aria-pressed="true"]').textContent()).trim() === '15 min' && (await p.inputValue('#ret-note')) === 'Train supprimé');
  await p.locator('#ret-durees .comp', { hasText: '+ de 20 min' }).click(); await p.fill('#ret-minutes', '25');
  verifie('autre durée : un champ au style de la plateforme', await p.locator('#ret-minutes').evaluate((e) => { const s = getComputedStyle(e); return parseFloat(s.borderTopLeftRadius) >= 6 && s.borderTopStyle === 'solid'; }));
  await audit('fenêtre · autre durée', 'autre');
  await p.locator('#ret-envoyer').click(); await p.waitForTimeout(500);
  const d2 = await donnees((d) => ({ retards: (d.retards || []).map((r) => r.minutes), corrige: d.messages.filter((m) => /^Correction/.test(m.texte)).length, titre: d.annonces[0].titre }));
  verifie('la correction remplace l’avis et repart aux titulaires ' + JSON.stringify(d2), d2.retards.length === 1 && d2.retards[0] === 25 && d2.corrige >= 1 && /25 min/.test(d2.titre));
  await p.locator('#ret-annuler').click(); await p.waitForTimeout(500);
  const d3 = await donnees((d) => ({ retards: (d.retards || []).length, titre: d.annonces[0].titre, message: d.messages[d.messages.length - 1].texte }));
  verifie('« Je serai à l’heure » retire l’avis et prévient les titulaires ' + JSON.stringify(d3), d3.retards === 0 && /finalement à l’heure/.test(d3.titre) && /à l’heure/.test(d3.message) && (await p.locator('#ret-prevenir').count()) === 1);

  // ---- l'aide
  await nav('aide'); await p.fill('#aide-recherche', 'retard'); await p.waitForTimeout(300);
  verifie('aide : « Prévenir que je serai en retard », avec son tutoriel', (await p.locator('.ad-fiche[data-fiche="retard-prevenir"]').count()) === 1 && (await p.locator('.ad-fiche[data-fiche="retard-prevenir"] .btn.primary').count()) === 1);

  console.log(`\n${MOBILE ? 'téléphone' : MODE} : ${controles - ko.length}/${controles} contrôles, ${defauts} défaut(s) d’accessibilité sur ${ecrans} écrans`);
  if (ko.length) console.log('ÉCHECS :\n - ' + ko.join('\n - '));
  console.log(errs.length ? 'ERREURS :\n' + [...new Set(errs)].join('\n') : 'aucune erreur de page');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
