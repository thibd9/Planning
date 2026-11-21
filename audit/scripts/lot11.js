// Onzième lot : publication au mois, rappel, relais par Solvéa ; coûts masqués ; formation interne ou externe.
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
    if (capture) await p.screenshot({ path: `${__dirname}/shots/l11-${MOBILE ? 'm' : MODE}-${capture}.png`, fullPage: !MOBILE && capture.endsWith('+') });
  };
  const nav = async (v) => { if (MOBILE && !(await p.locator(`[data-tour="nav-${v}"]:visible`).count())) { await p.locator('.burger, [aria-label="Ouvrir le menu"]').first().click().catch(() => {}); await p.waitForTimeout(300); } await p.locator(`[data-tour="nav-${v}"]:visible`).first().click(); await p.waitForTimeout(450); };  const role = async (nom) => { if (!(await p.locator('.bandeau-test').isVisible())) { await p.locator('#bt-ouvrir').click(); await p.waitForTimeout(250); } await p.locator('.bandeau-test button', { hasText: nom }).first().click(); await p.waitForTimeout(600); };
  const donnees = async (f) => { await p.waitForTimeout(350); return p.evaluate((corps) => { const v = JSON.parse(localStorage.getItem('releve.v3')); return new Function('d', `return (${corps})(d)`)(v.officines[v.courante]); }, f.toString()); };
  const tous = ['caroline.tellier', 'pierre.fiandino', 'igor.lerusse', 'nicolas.lesyndicaliste', 'sarah.lemoine', 'manon.girard', 'yanis.morel', 'lea.fontaine'];
  // Le 18 novembre : l'échéance de décembre (14 jours avant le 1er) est passée la veille.
  const jour = new Date(2026, 10, 18, 9, 0, 0); await p.clock.install({ time: jour });
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Comment ça marche/ }).click(); await p.waitForTimeout(400); await p.locator('#dc-onglet-libre').click(); await p.locator('.dc-role').first().click(); await p.waitForTimeout(700);
  if (MODE === 'sombre') { await p.evaluate((ids) => { const o = {}; for (const id of ids) o[id] = { mode: 'sombre' }; localStorage.setItem('releve.preferences', JSON.stringify(o)); localStorage.setItem('releve.preferences.version', '2'); }, tous); await p.reload(); await p.waitForTimeout(700); }

  // ---- le bandeau de l'échéance
  const b1 = await p.evaluate(() => ({ la: !!document.querySelector('.tb-echeance'), classe: document.querySelector('.tb-echeance')?.className, titre: document.querySelector('.tb-echeance h3')?.textContent, texte: document.querySelector('.tb-echeance p')?.textContent, bouton: document.querySelector('#echeance-preparer')?.textContent.trim() }));
  verifie('tableau de bord : l’échéance de décembre est dépassée, Solvéa propose de préparer ' + JSON.stringify(b1), b1.la && /depasse/.test(b1.classe) && /En retard depuis le mar\. 17 novembre/.test(b1.titre) && /habitudes/.test(b1.texte) && /Préparer décembre/.test(b1.bouton));
  await p.locator('.tb-echeance').scrollIntoViewIfNeeded(); await audit('tableau de bord · échéance dépassée', 'echeance');
  const avant = await donnees((d) => ({ vides: ['2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28'].filter((l) => !d.shifts.some((s) => s.date >= l && s.date < new Date(new Date(l).getTime() + 7 * 864e5).toISOString().slice(0, 10))), postes: d.shifts.length }));
  // Une semaine commencée à la main : elle ne doit pas être touchée.
  await nav('construire'); await p.waitForTimeout(400);
  for (let i = 0; i < 4; i++) { await p.locator('.plan-bar button[aria-label*="suivante"], .plan button[aria-label*="Semaine suivante"]').first().click(); await p.waitForTimeout(300); }
  await p.locator('.plan-grid .add').first().click(); await p.waitForTimeout(400); await p.locator('.ptc').first().click(); await p.locator('.dialog-foot .btn.primary').click(); await p.waitForTimeout(500);
  const main = await donnees((d) => d.shifts.filter((s) => s.date >= '2026-12-21' && s.date <= '2026-12-27').map((s) => [s.personId, s.date, s.start, s.end]));
  verifie('une semaine de décembre commencée à la main (un poste posé le ' + (main[0] && main[0][1]) + ')', main.length === 1);
  await nav('tableau'); await p.waitForTimeout(300);
  await p.locator('#echeance-preparer').click(); await p.waitForTimeout(900);
  const apres = await donnees((d) => ({ semaines: Object.entries(d.semaines).filter(([, s]) => s.auto).map(([l, s]) => [l, s.statut]), main: d.shifts.filter((s) => s.date >= '2026-12-21' && s.date <= '2026-12-27').length, habitude: d.shifts.filter((s) => /habitudes/.test(s.explication || '')).length, annonce: d.annonces[0].titre, effets: d.annonces[0].effets, publiees: Object.entries(d.semaines).filter(([l, s]) => l >= '2026-12-07' && s.statut === 'publie').length }));
  console.log('   préparées :', JSON.stringify(apres.semaines), '· postes repris des habitudes :', apres.habitude);
  verifie('Solvéa prépare les semaines vides en brouillon, d’après les habitudes', apres.semaines.length >= 2 && apres.semaines.every((x) => x[1] === 'brouillon') && apres.habitude > 20);
  verifie('la semaine commencée à la main n’est pas touchée', apres.main === 1 && !apres.semaines.some((x) => x[0] === '2026-12-21'));
  verifie('rien n’est publié, et les titulaires sont prévenus ' + JSON.stringify(apres.annonce), apres.publiees === 0 && /Solvéa a préparé le planning de décembre/.test(apres.annonce) && /à relire/.test(apres.effets[0]));
  verifie('on arrive sur le mois de décembre, prêt à relire', (await p.locator('#mois-publier').count()) === 1 && /décembre/i.test(await p.locator('.plan .label').first().textContent()));
  await audit('vue mois · préparée par Solvéa', 'mois+');

  // ---- publier le mois
  await p.locator('#mois-publier').click(); await p.waitForTimeout(900);
  const pub = await donnees((d) => ({ publiees: Object.entries(d.semaines).filter(([l, s]) => l >= '2026-11-30' && l <= '2026-12-28' && s.statut === 'publie').map(([l]) => l), brouillons: ['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28'].filter((l) => (d.semaines[l] || {}).statut !== 'publie') }));
  const toast = await p.locator('.toast').textContent().catch(() => '');
  console.log('   publiées :', pub.publiees.join(', '), '· restent :', pub.brouillons.join(', ') || 'aucune', '·', toast.slice(0, 160));
  verifie('« Publier le mois » publie les semaines prêtes et dit celle qui reste à corriger', pub.publiees.length >= 3 && /publiée/.test(toast) && pub.brouillons.join() === '2026-12-21' && /À corriger avant de publier : la semaine du 21/.test(toast));
  await nav('tableau'); await p.waitForTimeout(400);
  const b2 = await p.evaluate(() => ({ la: !!document.querySelector('.tb-echeance'), titre: document.querySelector('.tb-echeance h3')?.textContent, bouton: document.querySelector('#echeance-ouvrir')?.textContent.trim() }));
  verifie('le bandeau suit : ' + JSON.stringify(b2), pub.brouillons.length ? b2.la && /Relire et publier|Construire/.test(b2.bouton || '') : !b2.la);

  // ---- le réglage, et le rappel avant l'échéance
  await nav('officine'); await p.waitForTimeout(400);
  const r = await p.evaluate(() => ({ delai: document.querySelector('#pub-delai')?.value, rappel: document.querySelector('#pub-rappel')?.value, relais: document.querySelector('#pub-relais')?.checked, exemple: document.querySelector('.pub-exemple')?.textContent }));
  verifie('réglages : 14 jours avant le 1er, rappel 7 jours avant, relais activé ' + JSON.stringify(r.exemple), r.delai === '14' && r.rappel === '7' && r.relais && /rappel à partir du mar\. 10 novembre.*au plus tard le mar\. 17 novembre/.test(r.exemple));
  await p.locator('[data-focus="publication"]').scrollIntoViewIfNeeded(); await audit('réglages · publication au mois', 'reglage');
  await p.fill('#pub-delai', '5'); await p.waitForTimeout(300);
  verifie('changer le délai déplace l’échéance', /au plus tard le jeu\. 26 novembre/.test(await p.locator('.pub-exemple').textContent()));
  await p.locator('#pub-relais').uncheck(); await p.waitForTimeout(200);

  // ---- les coûts : aucun chiffre sans l'option
  verifie('coûts : l’option est décochée par défaut', !(await p.locator('#couts-afficher').isChecked()));
  await nav('construire'); await p.getByRole('button', { name: 'Semaine', exact: true }).click().catch(() => {}); await p.waitForTimeout(300);
  verifie('sans l’option : pas de lecture « Coût », aucun montant dans la page', (await p.locator('.plan-bar .seg button', { hasText: 'Coût' }).count()) === 0 && !/€/.test(await p.locator('.content').innerText()));
  await nav('officine'); await p.locator('#couts-afficher').check(); await p.waitForTimeout(200); await p.locator('#couts-afficher').scrollIntoViewIfNeeded(); await audit('réglages · coûts', 'couts');
  await nav('construire'); await p.waitForTimeout(300);
  verifie('avec l’option : la lecture « Coût » revient', (await p.locator('.plan-bar .seg button', { hasText: 'Coût' }).count()) === 1);

  // ---- formation : interne ou externe, et le lieu
  await p.locator('.top-creer').click(); await p.waitForTimeout(200); await p.locator('.menu button', { hasText: 'Une formation' }).click(); await p.waitForTimeout(400);
  await p.fill('#formation-intitule', 'Vaccination'); await p.locator('#formation-p_thomas').check();
  verifie('formation : il faut dire interne ou externe, et le lieu', await p.locator('.dialog-foot .btn.primary').isDisabled());
  await p.locator('label[for="formation-interne"]').click(); await p.waitForTimeout(200);
  verifie('interne : la pharmacie est proposée comme lieu', /À la pharmacie/.test(await p.inputValue('#formation-lieu')) && !(await p.locator('.dialog-foot .btn.primary').isDisabled()));
  await p.locator('label[for="formation-externe"]').click(); await p.waitForTimeout(200);
  verifie('externe : le lieu est à donner', (await p.inputValue('#formation-lieu')) === '' && await p.locator('.dialog-foot .btn.primary').isDisabled());
  await p.fill('#formation-lieu', 'Organisme de formation, Lyon'); await audit('fenêtre · formation', 'formation');
  await p.locator('.dialog-foot .btn.primary').click(); await p.waitForTimeout(500);
  const f = await donnees((d) => { const a = d.absences.filter((x) => x.type === 'formation').pop(); return [a.cadre, a.lieu, d.notifications[0].apres]; });
  verifie('la formation garde son cadre et son lieu, le participant les lit ' + JSON.stringify(f), f[0] === 'externe' && f[1] === 'Organisme de formation, Lyon' && /Formation externe « Vaccination ».*Lieu : Organisme de formation, Lyon/.test(f[2]));

  // ---- gardes : une ligne lisible
  await nav('gardes'); await p.waitForTimeout(500);
  const g = await p.evaluate(() => { const e = document.querySelector('.g-item'); return { quand: e?.querySelector('.g-quand')?.textContent, forme: e?.querySelector('.g-forme')?.textContent, qui: e?.querySelector('.g-qui')?.textContent.trim(), coupe: [...document.querySelectorAll('.g-quand')].some((x) => x.getClientRects().length > 1 || x.scrollWidth > x.clientWidth + 1) }; });
  verifie('gardes : le jour et les heures sur une ligne, la forme et la personne dessous ' + JSON.stringify(g), /·.*→/.test(g.quand) && !!g.forme && !!g.qui && !g.coupe);
  await audit('gardes · liste', 'gardes');

  console.log(`\n${MOBILE ? 'téléphone' : MODE} : ${controles - ko.length}/${controles} contrôles, ${defauts} défaut(s) d’accessibilité sur ${ecrans} écrans`);
  if (ko.length) console.log('ÉCHECS :\n - ' + ko.join('\n - '));
  console.log(errs.length ? 'ERREURS :\n' + [...new Set(errs)].join('\n') : 'aucune erreur de page');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
