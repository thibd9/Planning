// Second lot : réglages, contrôles, gardes de nuit, demande à un collègue, refus motivés. Audit axe sur les nouveaux écrans.
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
  const audit = async (nom, capture) => {
    await p.waitForTimeout(700); await p.evaluate(axeSrc);
    const r = await p.evaluate(async () => await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }));
    defauts += r.violations.length; ecrans++;
    for (const x of r.violations) { console.log(`== ${nom} [${x.id}] (${x.nodes.length})`); for (const n of x.nodes.slice(0, 4)) console.log('     ', n.target.join(' ').slice(0, 100), '|', (n.any[0]?.message || n.failureSummary || '').slice(0, 140)); }
    if (capture) await p.screenshot({ path: `${__dirname}/shots/l2-${MODE}-${capture}.png` });
  };
  const nav = async (v) => { await p.locator(`[data-tour="nav-${v}"]`).click(); await p.waitForTimeout(450); };
  const role = async (nom) => { if (!(await p.locator('.bandeau-test').isVisible())) { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); } await p.locator('.bandeau-test button', { hasText: nom }).first().click(); await p.waitForTimeout(600); };
  const txt = (sel) => p.locator(sel).allTextContents();
  // Les données sont lues là où l'application les enregistre, pas dans une copie du module.
  const donnees = async (f) => { await p.waitForTimeout(350); return p.evaluate((corps) => { const v = JSON.parse(localStorage.getItem('releve.v3')); return new Function('d', `return (${corps})(d)`)(v.officines[v.courante]); }, f.toString()); };

  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(400); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').first().click(); await p.waitForTimeout(700);
  if (MODE === 'sombre') { await p.evaluate(() => { const o = {}; for (const id of ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste']) o[id] = { theme: 'ciel', texte: 'normal', mode: 'sombre' }; localStorage.setItem('releve.preferences', JSON.stringify(o)); }); await p.reload(); await p.waitForTimeout(700); }

  // ---------- Réglages : le minimum se comprend sans visite guidée
  await nav('officine');
  const eff = await p.evaluate(() => { const c = document.querySelector('#acc-effectif'); return { titre: c?.querySelector('summary b')?.textContent, entetes: [...(c?.querySelectorAll('th') ?? [])].map((t) => t.textContent), unite: c?.querySelector('.eff-min span')?.textContent, nom: c?.querySelector('input')?.getAttribute('aria-label') }; });
  verifie('réglages : « Personnes au minimum », avec l’unité à côté du nombre', eff.entetes.includes('Personnes au minimum') && /personne/.test(eff.unite || '') && /Nombre minimum de personnes/.test(eff.nom || ''));
  await audit('réglages', 'reglages');

  // ---------- Contrôles : des tuiles rangées par gravité
  await nav('construire'); await p.waitForTimeout(400);
  const ctl = await p.evaluate(() => ({ groupes: [...document.querySelectorAll('.issues-titre')].map((t) => t.textContent.replace(/\d+/g, '').trim()), tuiles: document.querySelectorAll('.issue').length, parties: [...document.querySelectorAll('.issue')].every((i) => i.querySelector('.issue-nature') && i.querySelector('.issue-message')), colle: [...document.querySelectorAll('.issue-detail')].some((d) => getComputedStyle(d).display === 'inline') }));
  verifie('contrôles : tuiles groupées par gravité, message et détail sur des lignes séparées', ctl.tuiles > 0 && ctl.groupes.length >= 1 && ctl.parties && !ctl.colle);
  await p.locator('.issues').scrollIntoViewIfNeeded(); await audit('contrôles', 'controles');

  // ---------- Vue mois : semaines passées rangées, cases plus grandes
  await p.getByRole('button', { name: 'Mois', exact: true }).click(); await p.waitForTimeout(700);
  const mois = await p.evaluate(() => { const t = document.querySelector('table.mo'); const z = t.closest('.plan-scroll'); return { jours: [...document.querySelectorAll('.mo-jours th b')].map((x) => Number(x.textContent)), police: parseFloat(getComputedStyle(document.querySelector('table.mo button.mo-c:not(.mo-poser)')).fontSize), defile: t.offsetWidth > z.clientWidth + 2, bouton: document.querySelector('.mo-anciennes')?.textContent.trim() }; });
  verifie('mois : les semaines passées sont rangées, la grille tient sans défiler, texte plus grand', mois.jours[0] >= 16 && !mois.defile && mois.police >= 12.5 && /Semaines passées \(3\)/.test(mois.bouton || ''));
  await p.locator('.mo-anciennes').click(); await p.waitForTimeout(400);
  verifie('mois : « Semaines passées » les ramène, en grisé', (await p.locator('.mo-jours th').count()) >= 28 && (await p.locator('.mo-jours th.passe').count()) >= 12);
  await audit('mois, semaines passées', 'mois-passees'); await p.locator('.mo-anciennes').click();
  await p.getByRole('button', { name: 'Mois suivant' }).click(); await p.waitForTimeout(500);
  // Les préférences s'affichent d'office et déplient les semaines : on les masque pour retrouver la colonne repliée.
  await p.locator('.mo-pref input').uncheck().catch(() => {}); await p.waitForTimeout(300);
  verifie('mois : une semaine sans planning tient en une colonne « À construire »', (await p.locator('th.replie').count()) >= 3 && /À construire/.test((await txt('th.replie'))[0]));
  await audit('mois suivant', 'mois-suivant'); await p.getByRole('button', { name: 'Semaine', exact: true }).click();

  // ---------- Gardes : de nuit, de jour, de 24 heures
  await nav('gardes');
  const noms = await txt('.g-nom');
  verifie('gardes : chaque garde dit si elle est de nuit ou de jour', noms.length >= 3 && noms.every((n) => /(Garde|Astreinte) de (nuit|jour|24 h)/.test(n)) && noms.some((n) => /de nuit/.test(n)) && noms.some((n) => /de jour/.test(n)));
  await audit('gardes', 'gardes');
  await p.locator('.top-creer').click(); await p.locator('.menu button', { hasText: 'Une garde' }).click(); await p.waitForTimeout(400);
  const quand = async () => p.evaluate(() => ({ choix: [...document.querySelectorAll('.moment-garde label')].map((l) => l.textContent.trim().slice(0, 9)), coche: [...document.querySelectorAll('.moment-garde input')].findIndex((i) => i.checked), debut: document.getElementById('garde-debut').value, fin: document.getElementById('garde-fin').value }));
  const q0 = await quand();
  verifie('nouvelle garde : « Quand ? » propose nuit, jour, 24 heures ; nuit par défaut', q0.choix.length === 3 && q0.coche === 0 && q0.debut === '19:30' && q0.fin === '08:30');
  await p.locator('.moment-garde label', { hasText: 'Jour' }).first().click(); const q1 = await quand();
  verifie('nouvelle garde : « Jour » règle les horaires', q1.coche === 1 && q1.debut === '09:00' && q1.fin === '19:30');
  await p.locator('.moment-garde label', { hasText: '24 heures' }).click(); const q2 = await quand();
  verifie('nouvelle garde : « 24 heures » aussi', q2.coche === 2 && q2.debut === q2.fin);
  await audit('fenêtre garde', 'garde-nouvelle'); await p.keyboard.press('Escape');

  // ---------- Demander à un collègue précis, avec calcul des heures
  await role('Préparateur'); await nav('demandes'); await p.locator('.voie', { hasText: 'Me faire remplacer' }).click(); await p.waitForTimeout(400);
  await p.locator('.dm .btn', { hasText: 'Me faire remplacer' }).first().click(); await p.waitForTimeout(500);
  const col = await p.evaluate(() => ({ choix: [...document.querySelectorAll('.choix.collegues label')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()), non: [...document.querySelectorAll('.col-non li')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()), resume: document.querySelector('.col-non summary')?.textContent.trim() ?? '', urgence: (() => { const u = document.querySelector('.choix.urgence legend')?.getBoundingClientRect(); const c = document.querySelector('.choix.collegues').getBoundingClientRect(); return !!u && u.top >= c.bottom - 1; })() }));
  verifie('remplacement : « Toute l’équipe » ou un collègue possible, chacun avec ses heures calculées', col.choix.length >= 2 && /Toute l’équipe/.test(col.choix[0]) && col.choix.slice(1).every((c) => /Possible$/.test(c)) && col.choix.slice(1).some((c) => /\d+ h.*→.*\d+ h.*contrat/.test(c)));
  verifie('remplacement : ceux qui ne peuvent pas sont listés à part, avec la raison', col.non.length >= 1 && /ne peu(t|vent) pas/.test(col.resume) && col.non.every((c) => c.length > 20));
  verifie('remplacement : la liste ne recouvre pas le niveau d’urgence', col.urgence);
  await audit('fenêtre : à qui demander', 'collegues');
  const karimOk = true;
  const cible = p.locator('.choix.collegues label').nth(1);
  const prenom = (await cible.locator('.grow').evaluate((e) => e.firstChild.textContent)).trim().split(' ')[0];
  console.log('   [collègues possibles]', JSON.stringify(col.choix.slice(0, 5)), '→', prenom);
  await cible.click();
  verifie('remplacement : sans motif, la demande ne peut pas partir', await p.locator('.dialog-foot .btn.primary').isDisabled());
  await p.selectOption('#rempl-motif', 'famille'); await p.fill('#rempl-precision', 'Rendez-vous à l’école');
  await p.locator('.dialog-foot .btn.primary').click(); await p.waitForTimeout(600);
  verifie(`ma demande : « Demandé à ${prenom} », en attente de sa réponse`, new RegExp(`Demandé à ${prenom}`).test(await p.locator('.dm.actif .etapes').innerText()) && /n’a pas encore répondu/.test(await p.locator('.dm.actif .dm-etat').innerText()));
  verifie('le collègue reçoit le message', await donnees((d) => { const r = d.remplacements.find((x) => x.destinataire); return !!r && d.messages.some((m) => m.a === r.destinataire && /Pouvez-vous me remplacer/.test(m.texte)); }));
  await audit('mes demandes, demande adressée', 'demande-adressee');

  // Le titulaire voit à qui la demande est adressée
  await role('Titulaire 1'); await nav('resoudre'); await p.locator('.content .onglet', { hasText: 'Remplacements' }).click(); await p.waitForTimeout(400);
  verifie('résoudre : le motif et le nombre de demandes sont affichés au titulaire', /Motif : Obligation familiale - « Rendez-vous à l’école »/.test(await p.locator('.demande-r', { hasText: 'Nicolas' }).first().innerText()) && /demande en 3 mois/.test(await p.locator('.demande-r', { hasText: 'Nicolas' }).first().innerText()));
  verifie('résoudre : « demande à … de le remplacer », réponse du collègue affichée', new RegExp(`demande à ${prenom}`).test(await p.locator('.demande-r', { hasText: 'Nicolas' }).first().innerText()) && /pas encore répondu/.test(await p.locator('.demande-r', { hasText: 'Nicolas' }).first().innerText()));
  await audit('résoudre, demande adressée', 'resoudre-adressee');

  if (karimOk) {
    // Karim répond non, avec une raison
    const identifiant = await donnees((d) => d.personnes.find((x) => x.id === d.remplacements.find((r) => r.destinataire).destinataire).identifiant);
    await p.locator('[data-tour="compte"]').click(); await p.locator('.menu button', { hasText: /déconnecter/i }).click(); await p.waitForTimeout(500);
    if (await p.getByRole('button', { name: /Me déconnecter quand même/ }).count()) { await p.getByRole('button', { name: /Me déconnecter quand même/ }).click(); await p.waitForTimeout(500); }
    await p.fill('#cx-identifiant', identifiant); await p.fill('#cx-mdp', 'demo'); await p.getByRole('button', { name: 'Se connecter' }).click(); await p.waitForTimeout(800);
    console.log('   [priorité]', await p.locator('[data-focus="priorite"]').innerText().catch(() => 'absente'), '|', await p.locator('.page-head .eyebrow').first().innerText().catch(() => '?'));
    verifie('accueil du collègue : la demande passe en premier', /vous demande de le remplacer/.test(await p.locator('[data-focus="priorite"]').innerText().catch(() => '')));
    await p.locator('[data-focus="priorite"] .btn.primary').click().catch(() => nav('moi')); await p.waitForTimeout(500);
    console.log('   [écran du collègue]', await p.locator('h1').first().innerText().catch(() => '?'), '|', await p.locator('.espace-badge, .espace-qui').first().innerText().catch(() => '?')); await p.screenshot({ path: __dirname + '/shots/l2-collegue.png' });
    verifie('le collègue voit la demande qui lui est adressée', /vous demande de le remplacer|vous le demande, à vous/.test(await p.locator('[data-focus="aider"]').innerText()) && (await p.getByRole('button', { name: 'J’accepte' }).count()) === 1);
    await audit('collègue, demande reçue', 'demande-recue');
    await p.getByRole('button', { name: 'Je ne peux pas' }).click(); await p.waitForTimeout(400);
    await p.selectOption('#refus-raison', 'Déjà beaucoup d’heures cette semaine'); await p.fill('#refus-mot', 'Je peux un autre jour');
    const ap = await p.locator('.refus-apercu p').innerText();
    verifie('répondre non : l’aperçu reprend la raison et le mot', /Je ne peux pas reprendre le poste/.test(ap) && /Raison : déjà beaucoup d’heures cette semaine\./.test(ap) && /Je peux un autre jour\./.test(ap));
    await audit('fenêtre : répondre non', 'repondre-non');
    await p.locator('.dialog-foot .btn.danger').click(); await p.waitForTimeout(500);
    verifie('le demandeur reçoit ce message', await donnees((d) => d.messages.some((m) => m.a === 'p_camille' && /Raison : déjà beaucoup d’heures/.test(m.texte) && /toute l’équipe/.test(m.texte))));
    await role('Préparateur'); await nav('demandes'); await p.locator('.voie', { hasText: 'Me faire remplacer' }).click(); await p.waitForTimeout(400);
    verifie('ma demande : le collègue ne peut pas, je peux l’ouvrir à toute l’équipe', /ne peut pas/.test(await p.locator('.dm.actif .dm-etat').innerText()) && (await p.getByRole('button', { name: 'Demander à toute l’équipe' }).count()) === 1);
    await p.getByRole('button', { name: 'Demander à toute l’équipe' }).click(); await p.waitForTimeout(400);
    verifie('demande ouverte à toute l’équipe', await donnees((d) => d.remplacements.some((r) => r.demandeur === 'p_camille' && r.statut === 'ouverte' && !r.destinataire)));
  }

  // ---------- Le titulaire refuse une demande, avec une raison
  await role('Titulaire 1'); await nav('resoudre'); await p.locator('.content .onglet', { hasText: 'Demandes' }).click(); await p.waitForTimeout(400);
  const avant = await donnees((d) => ({ messages: d.messages.length, attente: d.absences.filter((a) => a.statut === 'demandee').length }));
  await p.locator('.panneau .decision [data-decider]').first().click(); await p.waitForTimeout(400);
  verifie('décider : la fenêtre dit ce que la demande implique, aucune décision n’est choisie d’avance', (await p.locator('#dc-implications').count()) === 1 && (await p.locator('#dc-confirmer').isDisabled()) && (await p.locator('#dc-ecrire').count()) === 1);
  await p.locator('label[for="dc-refuser"]').click(); await p.waitForTimeout(200);
  verifie('refus : une fenêtre s’ouvre, rien n’est refusé d’un clic', (await p.locator('.dialog').count()) === 1 && (await donnees((d) => d.absences.filter((a) => a.statut === 'demandee').length)) === avant.attente);
  const taille = await p.evaluate(() => { const d = document.querySelector('.dialog').getBoundingClientRect(); return { w: d.width, h: d.height, racine: document.querySelector('.overlay').parentElement === document.body }; });
  verifie('refus : la fenêtre est grande, entière, posée à la racine de la page', taille.w >= 700 && taille.h >= 420 && taille.racine);
  const options = await txt('#dc-raison option');
  verifie('refus : liste de raisons, « Ne pas préciser » en tête', options.length >= 6 && options[0] === 'Ne pas préciser');
  await p.selectOption('#dc-raison', { index: 2 }); await p.fill('#dc-mot', 'La semaine suivante serait possible');
  const texte = await p.locator('.refus-apercu p').innerText();
  verifie('refus : aperçu du message complet', /^Votre demande .* n’est pas acceptée\. Raison : .*\. La semaine suivante serait possible\.$/.test(texte));
  await audit('fenêtre : refuser', 'refuser');
  await p.locator('#dc-confirmer').click(); await p.waitForTimeout(500);
  const apres = await donnees((d) => ({ messages: d.messages.length, dernier: d.messages[d.messages.length - 1].texte, journal: d.journal[0].detail || '' }));
  console.log('   [refus]', JSON.stringify({ texte, apres, avant }).slice(0, 700));
  verifie('refus : le message part tel qu’annoncé, et la raison est au journal', apres.messages === avant.messages + 1 && apres.dernier === texte && /Raison :/.test(apres.journal));
  // Régler une absence : la solution se voit et se choisit, y compris « je prends ce poste moi-même »
  await p.locator('.content .onglet', { hasText: 'Absences' }).click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /Voir et choisir la solution/ }).first().click(); await p.waitForTimeout(700);
  const rg = await p.evaluate(() => { const d = document.querySelector('.dialog').getBoundingClientRect(); return { jours: document.querySelectorAll('.rs-jour').length, options: [...document.querySelectorAll('.rs-jour:first-of-type .rs-option b')].map((b) => b.textContent), plus: Math.max(...[...document.querySelectorAll('.rs-jour')].map((j) => j.querySelectorAll('.rs-option').length)), conseille: !!document.querySelector('.rs-option.on .rs-conseil'), largeur: d.width, hauteur: d.height, padding: parseFloat(getComputedStyle(document.querySelector('.rs-option')).paddingTop) }; });
  verifie('régler une absence : chaque jour montre ses options, la conseillée cochée, et « à la main » reste possible', rg.jours >= 1 && rg.conseille && rg.options.includes('Je règle ce jour à la main') && rg.plus >= 3);
  verifie('régler une absence : grande fenêtre, options aérées', rg.largeur >= 900 && rg.padding >= 16);
  await audit('fenêtre : régler une absence', 'regler');
  // « Je prends ce poste moi-même » n'est proposé que les jours où la titulaire est libre.
  const moiMeme = p.locator('.rs-option', { hasText: 'Je prends ce poste moi-même' });
  const possible = await moiMeme.count();
  const autre = possible ? moiMeme.first() : p.locator('.rs-jour .rs-option:not(.on):not(.libre)').first();
  const titreChoisi = (await autre.locator('b').first().innerText()).trim();
  await autre.click(); await p.waitForTimeout(400);
  verifie('régler une absence : l’option que je choisis reste cochée', (await txt('.rs-option.on b')).map((t) => t.trim()).includes(titreChoisi));
  const trousAvant = await donnees((d) => d.trous.filter((t) => t.statut === 'ouvert').length);
  await p.locator('.dialog-foot .btn.primary').click(); await p.waitForTimeout(700);
  const resolutions = await donnees((d) => d.trous.filter((t) => t.statut === 'resolu').map((t) => t.resolution));
  verifie('régler une absence : c’est bien mon choix qui est appliqué, pas l’option conseillée', resolutions.includes(titreChoisi));
  verifie('régler une absence : mes choix sont appliqués', (await donnees((d) => d.trous.filter((t) => t.statut === 'ouvert').length)) < trousAvant && (!possible || await donnees((d) => d.shifts.some((x) => /repris par/.test(x.explication || '')))));
  console.log('   [moi-même proposé]', possible);
  await p.locator('.content .onglet', { hasText: 'Demandes' }).click(); await p.waitForTimeout(300);
  // En parler d'abord : la demande reste à décider, la conversation s'ouvre.
  const reste = await p.locator('.panneau .decision [data-decider]').count();
  if (reste) { const attente = await donnees((d) => d.absences.filter((a) => a.statut === 'demandee').length + d.besoins.filter((b) => b.decision === 'attente').length); await p.locator('.panneau .decision [data-decider]').first().click(); await p.waitForTimeout(300); await p.locator('#dc-ecrire').click(); await p.waitForTimeout(600); verifie('« En parler d’abord » ouvre la conversation, sans rien décider', (await p.locator('.fil, #msg-texte').count()) >= 1 && (await donnees((d) => d.absences.filter((a) => a.statut === 'demandee').length + d.besoins.filter((b) => b.decision === 'attente').length)) === attente); }

  console.log(`\n${MODE} : ${controles - ko.length}/${controles} contrôles, ${defauts} défaut(s) d’accessibilité sur ${ecrans} écrans`);
  if (ko.length) console.log('ÉCHECS :\n - ' + ko.join('\n - '));
  console.log(errs.length ? 'ERREURS :\n' + [...new Set(errs)].join('\n') : 'aucune erreur de page');
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
