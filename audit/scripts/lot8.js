// Huitième lot : marques des animateurs, accueil par profil, rendez-vous demandés dans la messagerie et fixés dans l'agenda.
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
    if (capture) await p.screenshot({ path: `${__dirname}/shots/l8-${MOBILE ? 'm' : MODE}-${capture}.png`, fullPage: !MOBILE && capture.endsWith('+') });
  };
  const nav = async (v) => { if (MOBILE && !(await p.locator(`[data-tour="nav-${v}"]:visible`).count())) { await p.locator('.burger, [aria-label="Ouvrir le menu"]').first().click().catch(() => {}); await p.waitForTimeout(300); } await p.locator(`[data-tour="nav-${v}"]:visible`).first().click(); await p.waitForTimeout(450); };
  const role = async (nom) => { if (!(await p.locator('.bandeau-test').isVisible())) { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); } await p.locator('.bandeau-test button', { hasText: nom }).first().click(); await p.waitForTimeout(600); };
  const txt = (sel) => p.locator(sel).allTextContents();
  const donnees = async (f) => { await p.waitForTimeout(350); return p.evaluate((corps) => { const v = JSON.parse(localStorage.getItem('releve.v3')); return new Function('d', `return (${corps})(d)`)(v.officines[v.courante]); }, f.toString()); };
  const cloche = () => p.getByRole('button', { name: /notifications, ouvrir la liste|Aucune notification/ });

  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(400); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').first().click(); await p.waitForTimeout(700);
  if (MODE === 'sombre') { await p.evaluate(() => { const o = {}; for (const id of ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste']) o[id] = { theme: 'ciel', texte: 'normal', mode: 'sombre' }; localStorage.setItem('releve.preferences', JSON.stringify(o)); }); await p.reload(); await p.waitForTimeout(700); }


  // ---------- Le titulaire choisit les marques d'une animatrice, par familles de produits
  await nav('equipe');
  await p.locator('.content button, .content [role="button"]', { hasText: 'Sarah' }).first().click(); await p.waitForTimeout(600);
  verifie('fiche d’un animateur : « Marques présentées », trois marques d’exemple', (await p.locator('[data-focus="marques"] .mq').count()) === 3);
  verifie('ajouter une marque : le bouton attend un nom', await p.locator('#mq-ajouter').isDisabled());
  await p.fill('#mq-nom', 'verdéa'); verifie('une marque déjà présentée n’est pas ajoutée deux fois', (await p.locator('#mq-ajouter').isDisabled()) && (await p.locator('#mq-deja').count()) === 1);
  await p.fill('#mq-nom', 'Essai Marque'); await p.locator('#mq-ajouter').click(); await p.waitForTimeout(400);
  const neuve = p.locator('[data-focus="marques"] .mq').last();
  verifie('marque absente du répertoire : son nom suffit, elle rejoint le répertoire de la pharmacie', (await neuve.locator('input').inputValue()) === 'Essai Marque' && await donnees((d) => (d.officine.marques || []).includes('Essai Marque')));
  await neuve.locator('.comp', { hasText: 'Bucco-dentaire' }).click(); await p.waitForTimeout(400);
  verifie('marque ajoutée, avec sa famille de produits', await donnees((d) => { const s = d.personnes.find((x) => x.id === 'p_sarah'); const m = s.marques[s.marques.length - 1]; return s.marques.length === 4 && m.marque === 'Essai Marque' && m.types.join() === 'bucco'; }));
  await audit('équipe · marques d’un animateur', 'marques');
  await p.locator('[data-focus="marques"] .mq').nth(2).getByRole('button', { name: /Retirer la marque/ }).click(); await p.waitForTimeout(300);
  verifie('une marque retirée reste proposée dans le répertoire', (await p.locator('.mq-repertoire .comp', { hasText: 'Verdéa' }).count()) === 1);
  await p.locator('.mq-repertoire .comp', { hasText: 'Verdéa' }).click(); await p.waitForTimeout(300);
  verifie('un geste la reprend dans le répertoire', await donnees((d) => d.personnes.find((x) => x.id === 'p_sarah').marques.some((m) => m.marque === 'Verdéa')) && (await p.locator('.mq-repertoire .comp', { hasText: 'Verdéa' }).count()) === 0);

  // ---------- L'accueil de l'animatrice : ses marques, ses jours, ses rendez-vous
  await role('Animateur');
  const acc = await p.evaluate(() => ({ sur: document.querySelector('.tb-role')?.textContent, h1: document.querySelector('h1')?.textContent, marques: [...document.querySelectorAll('.esp-marques li')].map((x) => x.textContent), nav: document.querySelector('[data-tour="nav-espace"]')?.getAttribute('aria-current') }));
  verifie('animateur : arrive sur son accueil, « Espace animateur »', /Espace animateur/.test(acc.sur) && /Bon(jour|soir) Sarah/.test(acc.h1));
  verifie('animateur : ses marques rangées par famille de produits', acc.marques.length >= 4 && acc.marques.some((t) => /Essai Marque.*Bucco-dentaire/.test(t)) && acc.marques.some((t) => /Lumaderm.*Solaire/.test(t)));
  await audit('accueil · animateur', 'animateur+');

  // ---------- Demande de rendez-vous : sujet du profil, moments proposés, envoi
  await p.locator('#esp-rdv-demander').click(); await p.waitForTimeout(600);
  const dlg = await p.evaluate(() => ({ avec: document.querySelector('#rdv-avec').selectedOptions[0].textContent, sujets: [...document.querySelectorAll('#rdv-sujet option')].map((o) => o.textContent), idees: document.querySelectorAll('.rdv-idees .comp').length, avis: document.querySelector('#rdv-avis').className }));
  verifie('rendez-vous : adressé au titulaire, sujets du profil', /Caroline/.test(dlg.avec) && dlg.sujets.includes('Bilan d’animation') && dlg.sujets.includes('Autre sujet'));
  verifie('rendez-vous : Solvéa propose des moments en poste commun, sans empêchement', dlg.idees >= 1 && !/ko/.test(dlg.avis));
  await p.locator('#rdv-note').fill('Pour faire le point sur les ventes du mois.');
  await audit('rendez-vous · demande', 'demande');
  await p.locator('#rdv-envoyer').click(); await p.waitForTimeout(700);
  const d1 = await donnees((d) => { const r = (d.rendezVous || [])[0]; const m = d.messages[d.messages.length - 1]; return { n: (d.rendezVous || []).length, r, msg: m }; });
  verifie('rendez-vous : enregistré en attente, le message porte la demande', d1.n === 1 && d1.r.statut === 'propose' && d1.r.attend === 'p_helene' && d1.msg.rdvId === d1.r.id && /Demande de rendez-vous : Bilan d’animation.*ventes du mois/.test(d1.msg.texte));
  verifie('accueil : le rendez-vous apparaît « En attente »', /En attente/.test((await txt('.rdv-ligne')).join(' ')));

  // ---------- La titulaire répond dans la conversation : accepté, donc fixé dans les deux agendas
  await role('Titulaire 1');
  await p.getByRole('button', { name: /notifications, ouvrir la liste/ }).click(); await p.waitForTimeout(400);
  const cl = await p.locator('body').innerText();
  verifie('cloche de la titulaire : une demande de rendez-vous à laquelle répondre', /rendez-vous à laquelle répondre/i.test(cl));
  await p.getByRole('button', { name: /rendez-vous à laquelle répondre/i }).first().click().catch(async () => { await p.keyboard.press('Escape'); await nav('messages'); }); await p.waitForTimeout(700);
  verifie('messagerie : la conversation s’ouvre sur la carte du rendez-vous', (await p.locator('.rdv-carte.propose').count()) === 1 && /Sarah/.test(await p.locator('.card .card-head h2').first().innerText()));
  await audit('messages · carte de rendez-vous', 'carte');
  await p.locator('.rdv-carte.propose').getByRole('button', { name: 'Accepter' }).click(); await p.waitForTimeout(700);
  const d2 = await donnees((d) => ({ r: d.rendezVous[0], a: d.annonces[0], msg: d.messages[d.messages.length - 1].texte }));
  verifie('accepté : fixé, annoncé aux deux, confirmé par message', d2.r.statut === 'fixe' && /Rendez-vous fixé/.test(d2.a.titre) && d2.a.pour.includes('p_sarah') && d2.a.pour.includes('p_helene') && /Rendez-vous fixé/.test(d2.msg));
  verifie('la carte passe à « Fixé dans l’agenda »', (await p.locator('.rdv-carte.fixe').count()) === 1);

  // ---------- Dans l'agenda de l'animatrice
  await role('Animateur');
  verifie('accueil : rendez-vous « Fixé »', /Fixé/.test((await txt('.rdv-ligne.fixe')).join(' ')));
  await nav('moi');
  await p.getByRole('button', { name: /Calendrier|Mois/ }).first().click().catch(() => {}); await p.waitForTimeout(600);
  const ag = await p.evaluate(() => ({ cal: document.querySelectorAll('.cal-poste.rdv').length, puce: document.querySelectorAll('.rdv-puce').length }));
  verifie('agenda : le rendez-vous est dans « Mon planning »', ag.cal + ag.puce >= 1);
  await audit('mon planning · rendez-vous', 'agenda');

  // ---------- Autre horaire proposé : c'est au demandeur de répondre
  await nav('messages');
  await p.locator('#rdv-demander').click(); await p.waitForTimeout(500);
  await p.locator('#rdv-sujet').selectOption('Autre sujet'); await p.locator('#rdv-sujet-libre').fill('Vitrine de Noël'); await p.waitForTimeout(300);
  await p.locator('#rdv-envoyer').click(); await p.waitForTimeout(600);
  await role('Titulaire 1'); await nav('messages'); await p.waitForTimeout(400);
  await p.locator('.msg-fil', { hasText: 'Sarah' }).click(); await p.waitForTimeout(400);
  await p.locator('.rdv-carte.propose').getByRole('button', { name: 'Proposer un autre horaire' }).click(); await p.waitForTimeout(500);
  const heure = await p.locator('#rdv-debut').inputValue(); const [hh, mm] = heure.split(':').map(Number); const plus = hh * 60 + mm + 30;
  await p.locator('#rdv-debut').fill(`${String(Math.floor(plus / 60)).padStart(2, '0')}:${String(plus % 60).padStart(2, '0')}`); await p.waitForTimeout(400);
  await audit('rendez-vous · autre horaire', 'autre');
  await p.locator('#rdv-envoyer').click(); await p.waitForTimeout(600);
  const d3 = await donnees((d) => { const r = d.rendezVous[1]; return { r, msg: d.messages[d.messages.length - 1].texte }; });
  verifie('autre horaire : la demande revient au demandeur', d3.r.statut === 'propose' && d3.r.attend === 'p_sarah' && d3.r.sujet === 'Vitrine de Noël' && /Autre horaire proposé/.test(d3.msg));
  await role('Animateur'); await nav('messages'); await p.waitForTimeout(400);
  await p.locator('.msg-fil', { hasText: 'Caroline' }).click(); await p.waitForTimeout(400);
  await p.locator('.rdv-carte.propose').getByRole('button', { name: 'Accepter' }).click(); await p.waitForTimeout(600);
  verifie('le demandeur accepte : deux rendez-vous fixés', await donnees((d) => d.rendezVous.filter((r) => r.statut === 'fixe').length === 2));
  await p.locator('.rdv-carte.fixe').last().getByRole('button', { name: 'Annuler le rendez-vous' }).click(); await p.waitForTimeout(500);
  verifie('annuler : le rendez-vous sort de l’agenda, l’autre est prévenu', await donnees((d) => d.rendezVous.filter((r) => r.statut === 'annule').length === 1 && /Rendez-vous annulé/.test(d.messages[d.messages.length - 1].texte)));

  // ---------- Chaque profil a son accueil
  for (const [bouton, sur, titre] of [['Apprenti', 'Espace apprenti', 'Mon alternance'], ['Étudiant', 'Espace étudiant', 'Mes études et mes horaires'], ['Pharmacien', 'Espace pharmacien', 'Mes gardes et mes missions'], ['Préparateur', 'Espace préparateur', 'Mes compétences et mes postes']]) {
    await role(bouton);
    const e = await p.evaluate(() => ({ sur: document.querySelector('.tb-role')?.textContent, titre: document.querySelector('#esp-metier')?.textContent, badge: document.querySelector('.espace-badge')?.textContent }));
    verifie(`${bouton.toLowerCase()} : « ${sur} », bloc « ${titre} »`, (e.sur ?? "").startsWith(sur) && e.titre === titre);
    await audit(`accueil · ${bouton.toLowerCase()}`, bouton === 'Apprenti' ? 'apprenti+' : bouton.toLowerCase());
  }

  console.log(`\n${MOBILE ? 'téléphone' : MODE} : ${controles - ko.length}/${controles} contrôles, ${defauts} défaut(s) d’accessibilité sur ${ecrans} écrans`);
  if (ko.length) console.log('ÉCHECS :\n - ' + ko.join('\n - '));
  console.log(errs.length ? 'ERREURS :\n' + [...new Set(errs)].join('\n') : 'aucune erreur de page');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
