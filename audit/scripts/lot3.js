// Troisième lot : messages non lus, équité, documents, déconnexion sans perte. Audit axe, clair ou sombre, bureau ou téléphone.
const { chromium } = require('playwright');
const fs = require('fs');
const axeSrc = fs.readFileSync(__dirname + '/axe/node_modules/axe-core/axe.min.js', 'utf8');
const URL = process.env.URL || 'http://localhost:5180/';
const MODE = process.env.MODE || 'clair';
const MOBILE = !!process.env.MOBILE;
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
    if (capture) await p.screenshot({ path: `${__dirname}/shots/l3-${MOBILE ? 'm' : MODE}-${capture}.png` });
  };
  const nav = async (v) => { await p.locator(`[data-tour="nav-${v}"]:visible`).first().click(); await p.waitForTimeout(450); };
  const role = async (nom) => { if (!(await p.locator('.bandeau-test').isVisible())) { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); } await p.locator('.bandeau-test button', { hasText: nom }).first().click(); await p.waitForTimeout(600); };
  const txt = (sel) => p.locator(sel).allTextContents();
  const donnees = async (f) => { await p.waitForTimeout(350); return p.evaluate((corps) => { const v = JSON.parse(localStorage.getItem('releve.v3')); return new Function('d', `return (${corps})(d)`)(v.officines[v.courante]); }, f.toString()); };

  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(400); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').first().click(); await p.waitForTimeout(700);
  if (MODE === 'sombre') { await p.evaluate(() => { const o = {}; for (const id of ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste']) o[id] = { theme: 'ciel', texte: 'normal', mode: 'sombre' }; localStorage.setItem('releve.preferences', JSON.stringify(o)); }); await p.reload(); await p.waitForTimeout(700); }
  verifie('exemple : Grande Pharmacie de la Pinède, Caroline Tellier', /Pinède/.test(await p.locator('body').innerText()) && await donnees((d) => d.personnes.some((x) => x.prenom === 'Caroline' && x.nom === 'Tellier') && d.personnes.some((x) => x.nom === 'Le Syndicaliste') && d.personnes.some((x) => x.nom === 'Le Russe') && d.personnes.some((x) => x.nom === 'Fiandino')));

  // ---------- Messages : on arrive sur ce qui est nouveau
  await nav('messages');
  const msg = await p.evaluate(() => ({ titre: document.querySelector('.split section h2')?.textContent, separateur: !!document.querySelector('.msg-separateur'), nouveaux: document.querySelectorAll('.bulle.nouveau').length, apercus: document.querySelectorAll('.msg-apercu').length }));
  verifie('messages : la conversation non lue s’ouvre d’abord, le nouveau message est signalé', /Nicolas/.test(msg.titre || '') && msg.separateur && msg.nouveaux >= 1 && msg.apercus >= 8);
  await audit('messages', 'messages');
  await role('Préparateur'); await nav('messages'); await p.locator('.msg-fil', { hasText: 'Caroline' }).click(); await p.fill('#msg-texte', 'Bien reçu, merci.'); await p.getByRole('button', { name: 'Envoyer' }).click(); await p.waitForTimeout(400);
  await role('Titulaire 1');
  verifie('messages : le menu annonce un non-lu', (await p.locator('[data-tour="nav-messages"]:visible .nav-badge').first().innerText().catch(() => '0')) !== '0');
  await nav('messages'); await p.locator('.msg-fil').nth(0).waitFor();
  await p.locator('.msg-fil', { hasText: 'Toute l’équipe' }).click(); await p.waitForTimeout(300);

  // ---------- Équité
  await nav('equite');
  const eq = await p.evaluate(() => ({ h1: document.querySelector('h1').textContent, chiffres: document.querySelectorAll('.chiffre').length, filtres: document.querySelectorAll('.jr-filtre').length, lignes: document.querySelectorAll('.eq-ligne').length, mots: [...document.querySelectorAll('.eq-mot')].map((e) => e.textContent), tableau: !!document.querySelector('table') }));
  verifie('équité : une réponse d’abord, un compteur à la fois, une ligne par personne', /bien répartie/.test(eq.h1) && eq.chiffres === 3 && eq.filtres === 6 && eq.lignes >= 8 && !eq.tableau && eq.mots.every((m) => /équilibre|de plus|de moins/.test(m)));
  await audit('équité', 'equite');
  await p.locator('.jr-filtre', { hasText: 'Gardes' }).click(); await p.waitForTimeout(300);
  verifie('équité : les non concernés sont cités à part', /Non concernés/.test(await p.locator('.eq-hors').innerText().catch(() => '')) && /gardes/.test((await p.locator('.card h2').first().innerText()).toLowerCase()));
  await audit('équité, gardes');

  // ---------- Documents
  await role('Préparateur'); await nav('documents');
  verifie('documents : mes plannings publiés, rangés par mois', (await p.locator('.doc').count()) >= 3 && (await p.locator('.jr-date').count()) >= 1 && /h/.test((await txt('.doc .small'))[0]));
  await audit('documents, plannings', 'documents');
  await p.locator('.jr-filtre', { hasText: 'absences' }).click(); await p.waitForTimeout(300);
  verifie('documents : mes absences avec leur état', (await p.locator('.doc').count()) >= 1 && /Acceptée|Refusée|En attente/.test(await p.locator('.doc').first().innerText()));
  await audit('documents, absences');
  await p.locator('.jr-filtre', { hasText: 'Mes fichiers' }).click(); await p.waitForTimeout(300);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC', 'base64');
  await p.selectOption('#doc-categorie', 'arret'); await p.locator('.doc-bouton input[type=file]').setInputFiles({ name: 'arret-novembre.png', mimeType: 'image/png', buffer: png }); await p.waitForTimeout(900);
  verifie('documents : un fichier déposé apparaît, rangé comme arrêt de travail', (await p.locator('.doc').count()) === 1 && /Arrêt de travail/.test(await p.locator('.doc').first().innerText()) && await donnees((d) => (d.documents || []).length === 1 && d.documents[0].personId === 'p_camille' && d.documents[0].partage === true));
  await audit('documents, fichiers', 'fichiers');
  await p.locator('.doc-bouton input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }); await p.waitForTimeout(400);
  verifie('documents : un fichier qui n’est ni photo ni PDF est refusé, avec un message', /photo ou un PDF/.test(await p.locator('.doc-depot [role=alert]').innerText().catch(() => '')));
  await role('Titulaire 1'); await nav('documents'); await p.locator('.jr-filtre', { hasText: 'Reçus' }).click(); await p.waitForTimeout(300);
  verifie('documents : le titulaire voit le document partagé, avec le nom de la personne', /arret-novembre/.test(await p.locator('.doc-liste').innerText()) && /Nicolas/.test(await p.locator('.doc-liste').innerText()));
  await audit('documents, reçus de l’équipe');

  // ---------- Déconnexion : rien n'est perdu, ce qui reste en cours est rappelé
  await p.locator('[data-tour="compte"]:visible').first().click(); await p.locator('.menu button', { hasText: /déconnecter/i }).click(); await p.waitForTimeout(500);
  const dx = await p.evaluate(() => ({ dialogue: !!document.querySelector('.dialog'), sujets: document.querySelectorAll('.dx-liste li').length, rassure: /Rien ne sera perdu/.test(document.querySelector('.dialog')?.textContent || ''), connecte: !document.getElementById('cx-identifiant') }));
  verifie('déconnexion : les sujets en cours sont listés avant de partir, la session reste ouverte', dx.dialogue && dx.sujets >= 1 && dx.rassure && dx.connecte);
  await audit('fenêtre : avant de se déconnecter', 'deconnexion');
  await p.locator('.dx-liste .btn').first().click(); await p.waitForTimeout(500);
  verifie('déconnexion : « Traiter » mène au sujet, sans déconnecter', !(await p.locator('#cx-identifiant').count()) && !(await p.locator('.dialog').count()));
  await p.locator('[data-tour="compte"]:visible').first().click(); await p.locator('.menu button', { hasText: /déconnecter/i }).click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /Me déconnecter quand même/ }).click(); await p.waitForTimeout(600);
  verifie('déconnexion : confirmée, on revient à la connexion et rien n’a disparu', (await p.locator('#cx-identifiant').count()) === 1 && await donnees((d) => (d.documents || []).length === 1 && d.messages.some((m) => m.texte === 'Bien reçu, merci.')));

  console.log(`\n${MOBILE ? 'téléphone' : MODE} : ${controles - ko.length}/${controles} contrôles, ${defauts} défaut(s) sur ${ecrans} écrans`);
  if (ko.length) console.log('ÉCHECS :\n - ' + ko.join('\n - '));
  console.log(errs.length ? 'ERREURS :\n' + [...new Set(errs)].join('\n') : 'aucune erreur de page');
  await b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
