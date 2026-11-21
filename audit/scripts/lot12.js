// Douzième lot : signaler retard ou absence, bannière d'accueil, navigation mobile, décisions.
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
    if (capture) await p.screenshot({ path: `${__dirname}/shots/l12-${MOBILE ? 'm' : MODE}-${capture}.png`, fullPage: !MOBILE && capture.endsWith('+') });
  };
  const nav = async (v) => { if (MOBILE && !(await p.locator(`[data-tour="nav-${v}"]:visible`).count())) { await p.locator('.burger, [aria-label="Ouvrir le menu"]').first().click().catch(() => {}); await p.waitForTimeout(300); } await p.locator(`[data-tour="nav-${v}"]:visible`).first().click(); await p.waitForTimeout(450); };  const role = async (nom) => { if (MOBILE) { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); await p.locator('.bandeau-test button', { hasText: nom }).first().click(); } else { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); await p.locator('.bandeau-test button', { hasText: nom }).first().click(); } await p.waitForTimeout(600); };
  const donnees = async (f) => { await p.waitForTimeout(350); return p.evaluate((corps) => { const v = JSON.parse(localStorage.getItem('releve.v3')); return new Function('d', `return (${corps})(d)`)(v.officines[v.courante]); }, f.toString()); };
  const tous = ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste', 'sarah.lemoine', 'manon.girard', 'yanis.morel', 'lea.fontaine'];
  const jour = new Date(2026, 10, 18, 7, 30, 0); await p.clock.install({ time: jour });
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(400); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').first().click(); await p.waitForTimeout(700);
  if (MODE === 'sombre') { await p.evaluate((ids) => { const o = {}; for (const id of ids) o[id] = { mode: 'sombre' }; localStorage.setItem('releve.preferences', JSON.stringify(o)); localStorage.setItem('releve.preferences.version', '2'); }, tous); await p.reload(); await p.waitForTimeout(700); }

  // ---- tableau de bord : une bannière, un seul bloc dominant
  const tb = await p.evaluate(() => { const b = document.querySelector('.tb-banniere'); const pr = document.querySelector('.tb-priorite'); const pleins = [...document.querySelectorAll('.content .btn.primary')].filter((e) => e.getBoundingClientRect().width > 0).length; const r = (e) => e?.getBoundingClientRect(); return { banniere: !!b, portrait: !!b?.querySelector('.tb-portrait .avatar'), role: b?.querySelector('.tb-role')?.textContent, h1: document.querySelectorAll('h1').length, chiffres: b?.querySelectorAll('.tb-chiffre').length, ordre: r(b).top < r(pr).top && (!document.querySelector('.tb-echeance') || r(pr).top < r(document.querySelector('.tb-echeance')).top), pleins, deborde: document.documentElement.scrollWidth > innerWidth + 1 }; });
  verifie('tableau de bord : bannière d’accueil (portrait, rôle, repères), puis le bloc à faire en premier ' + JSON.stringify(tb), tb.banniere && tb.portrait && /Titulaire/.test(tb.role) && tb.h1 === 1 && tb.chiffres === 5 && tb.ordre && !tb.deborde);
  verifie('un seul bouton plein dans la page : celui de la priorité', tb.pleins === 1);
  await audit('tableau de bord · bannière', 'tableau');

  // ---- signaler : pour quelqu'un d'autre, puis pour soi
  await p.locator('#top-signaler').click(); await p.waitForTimeout(400);
  verifie('« Retard ou absence » ouvre une fenêtre : pour qui, puis quoi', (await p.locator('#sg-qui').count()) === 1 && (await p.locator('label[for="sg-retard"]').count()) === 1 && await p.locator('#sg-confirmer').isDisabled());
  await audit('fenêtre · signaler', 'signaler');
  await p.selectOption('#sg-qui', 'p_camille'); await p.locator('label[for="sg-retard"]').click(); await p.waitForTimeout(200);
  await p.locator('#sg-durees .comp', { hasText: '20 min' }).click(); await audit('fenêtre · signaler un retard', 'retard'); await p.locator('#sg-confirmer').click(); await p.waitForTimeout(500);
  const r1 = await donnees((d) => ({ avis: (d.retards || []).map((r) => [r.personId, r.minutes, r.par]), messages: d.messages.filter((m) => /en retard/.test(m.texte)).length, titre: d.annonces[0].titre }));
  verifie('titulaire : note le retard d’un préparateur en trois gestes ' + JSON.stringify(r1), r1.avis.length === 1 && r1.avis[0][0] === 'p_camille' && r1.avis[0][1] === 20 && r1.avis[0][2] === 'p_helene' && r1.messages === 0 && /Retard de Nicolas L\. noté : 20 min/.test(r1.titre));
  verifie('le tableau de bord le montre à côté de la personne', (await p.locator('.tbj-retard').count()) === 1);
  await p.locator('#top-signaler').click(); await p.waitForTimeout(300); await p.selectOption('#sg-qui', 'p_thomas'); await p.locator('label[for="sg-absence"]').click(); await p.waitForTimeout(200);
  verifie('absence : la fenêtre dit combien de postes sont concernés', /poste/.test(await p.locator('#sg-postes').textContent()));
  await audit('fenêtre · signaler une absence', 'absence'); await p.locator('#sg-confirmer').click(); await p.waitForTimeout(600);
  const a1 = await donnees((d) => { const a = d.absences[d.absences.length - 1]; return { qui: a.personId, statut: a.statut, type: a.type, trous: d.trous.filter((t) => t.shift.personId === 'p_thomas' && t.statut === 'ouvert').length }; });
  verifie('titulaire : l’absence d’un autre est enregistrée, ses postes sont à couvrir ' + JSON.stringify(a1), a1.qui === 'p_thomas' && a1.statut === 'approuvee' && a1.type === 'maladie');
  await role('Préparateur');
  verifie('salarié : le même bouton est là', (await p.locator('#top-signaler').count()) === 1);
  await p.locator('#top-signaler').click(); await p.waitForTimeout(300);
  verifie('salarié : pas de « pour qui », seulement pour lui', (await p.locator('#sg-qui').count()) === 0);
  await p.locator('label[for="sg-absence"]').click(); await p.fill('#sg-note', 'Je vous rappelle demain'); await p.locator('#sg-confirmer').click(); await p.waitForTimeout(600);
  const a2 = await donnees((d) => { const a = d.absences[d.absences.length - 1]; return { qui: a.personId, statut: a.statut, imprevue: a.imprevue, messages: d.messages.filter((m) => /Je ne pourrai pas venir/.test(m.texte)).map((m) => m.a), titre: d.annonces[0].titre, pour: d.annonces[0].pour }; });
  verifie('salarié : son absence part en demande imprévue, les titulaires sont prévenus ' + JSON.stringify(a2), a2.qui === 'p_camille' && a2.statut === 'demandee' && a2.imprevue === true && a2.messages.length === 2 && /signale une absence aujourd’hui/.test(a2.titre) && !a2.pour.includes('p_camille'));
  await role('Titulaire 1');
  if (MOBILE) { await p.locator('.tab[data-tab="resoudre"]').click(); } else await nav('resoudre');
  await p.waitForTimeout(400); await p.locator('.content .onglet', { hasText: 'Demandes' }).click(); await p.waitForTimeout(400);
  verifie('titulaire : la demande imprévue est signalée comme telle, et s’ouvre par « Décider »', (await p.locator('.decision', { hasText: 'Imprévue' }).count()) === 1 && (await p.locator('.decision', { hasText: 'Imprévue' }).locator('[data-decider]').count()) === 1);
  await p.locator('.decision', { hasText: 'Imprévue' }).locator('[data-decider]').click(); await p.waitForTimeout(400);
  verifie('décider d’une absence : ce qu’elle implique, trois issues (accepter, refuser, en parler)', (await p.locator('#dc-implications').count()) === 1 && (await p.locator('.dr-carte').count()) === 2 && (await p.locator('#dc-ecrire').count()) === 1 && await p.locator('#dc-confirmer').isDisabled());
  await audit('fenêtre · décider d’une absence', 'decider');
  await p.locator('label[for="dc-accepter"]').click(); await p.locator('#dc-confirmer').click(); await p.waitForTimeout(500);
  verifie('accepter : l’absence est acquise', await donnees((d) => d.absences.some((a) => a.personId === 'p_camille' && a.imprevue && a.statut === 'approuvee')));

  // ---- téléphone : onglets et menu
  if (MOBILE) {
    const t = await p.evaluate(() => ({ onglets: [...document.querySelectorAll('.tabbar .tab')].map((e) => e.textContent.replace(/\d.*$/, '').trim()), side: getComputedStyle(document.querySelector('.side')).visibility, defile: [...document.querySelectorAll('.tabbar, .bandeau-test')].some((e) => e.scrollWidth > e.clientWidth + 2), page: document.documentElement.scrollWidth > innerWidth + 1 }));
    verifie('téléphone : quatre onglets et « Menu », rien ne défile ' + JSON.stringify(t.onglets), t.onglets.length === 5 && t.onglets[4] === 'Menu' && t.side === 'hidden' && !t.defile && !t.page);
    await p.locator('.burger').click(); await p.waitForTimeout(450);
    verifie('« Menu » ouvre toutes les rubriques', (await p.locator('.side.ouvert .nav-item').count()) >= 10); await audit('téléphone · menu', 'menu');
    await p.locator('.side [data-tour="nav-heures"]').click(); await p.waitForTimeout(500);
    verifie('une rubrique choisie ferme le menu', (await p.locator('.side.ouvert').count()) === 0 && /Heures|heures/.test(await p.locator('h1').first().textContent()));
  }

  console.log(`\n${MOBILE ? 'téléphone' : MODE} : ${controles - ko.length}/${controles} contrôles, ${defauts} défaut(s) d’accessibilité sur ${ecrans} écrans`);
  if (ko.length) console.log('ÉCHECS :\n - ' + ko.join('\n - '));
  console.log(errs.length ? 'ERREURS :\n' + [...new Set(errs)].join('\n') : 'aucune erreur de page');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
