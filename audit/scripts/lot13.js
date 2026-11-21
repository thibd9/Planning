// Lot 13 : tableau de bord en deux blocs égaux, accident du travail, Solvi, surface, groupes d'équipe, flèche du tutoriel.
const { ouvrir } = require('./lib');
const MOBILE = !!process.env.MOBILE; const MODE = process.env.MODE;
const W = MOBILE ? 390 : 1440, H = MOBILE ? 844 : 900;
let ok = 0, ko = 0; const verifie = (nom, cond) => { cond ? ok++ : ko++; console.log(`${cond ? '✓' : '✗'} ${nom}`); };
(async () => {
  const { b, p, errs, shot } = await ouvrir({ role: 0, w: W, h: H, mode: MODE });
  const suf = `${MOBILE ? '-m' : ''}${MODE === 'sombre' ? '-s' : ''}`;
  const donnees = async (f) => { await p.waitForTimeout(350); return p.evaluate((corps) => { const v = JSON.parse(localStorage.getItem('releve.v3')); return new Function('d', `return (${corps})(d)`)(v.officines[v.courante]); }, f.toString()); };
  // ---- Tableau de bord : deux blocs de même taille
  await p.waitForTimeout(400);
  const duo = await p.evaluate(() => { const a = document.querySelector('.tb-rang .tb-jour')?.getBoundingClientRect(); const c = document.querySelector('.tb-rang .tb-decider')?.getBoundingClientRect(); return a && c ? { ha: Math.round(a.height), hc: Math.round(c.height), wa: Math.round(a.width), wc: Math.round(c.width), cote: Math.abs(a.top - c.top) < 2, avant: c.top < a.top } : null; });
  verifie(`tableau de bord : comptoir et décisions ${MOBILE ? 'empilés, décisions d’abord, même largeur' : 'côte à côte, même hauteur'} (${JSON.stringify(duo)})`, !!duo && (MOBILE ? !duo.cote && duo.avant && Math.abs(duo.wa - duo.wc) <= 2 : duo.cote && Math.abs(duo.ha - duo.hc) <= 2 && duo.wa > duo.wc));
  await shot(`l13-tableau${suf}`);
  // ---- Accident du travail, noté par le titulaire pour quelqu'un
  await p.locator('#top-signaler').click(); await p.waitForTimeout(400);
  await p.locator('#sg-qui').selectOption({ index: 4 }); await p.locator('label[for="sg-absence"]').click(); await p.waitForTimeout(200);
  await p.locator('#sg-raisons button', { hasText: 'Accident du travail' }).click(); await p.waitForTimeout(300);
  verifie('accident : les faits et la suite à donner s’affichent', (await p.locator('#sg-accident').count()) === 1 && /48 heures/.test(await p.locator('#sg-acc-suite').innerText()));
  await p.locator('#sg-acc-heure').fill('09:15'); await p.locator('#sg-acc-faits').fill('Chute dans la réserve, douleur au poignet');
  await shot(`l13-accident${suf}`);
  await p.locator('#sg-confirmer').click(); await p.waitForTimeout(700);
  const acc = await donnees((d) => d.absences.find((a) => a.type === 'accident'));
  verifie('accident enregistré avec ses faits et le jour où il est connu', !!acc && acc.statut === 'approuvee' && acc.accident.heure === 555 && acc.accident.ou === 'travail' && acc.accident.connuLe === acc.accident.jour && /Chute/.test(acc.accident.circonstances));
  await p.locator('[data-tour="nav-tableau"]').click().catch(() => {}); await p.waitForTimeout(500);
  if (MOBILE) { await p.locator('.tab[data-tab="tableau"]').click().catch(() => {}); await p.waitForTimeout(400); }
  verifie('tableau de bord : la déclaration est rappelée, avec sa date limite', (await p.locator('#tb-declarer li').count()) === 1 && /au plus tard le/.test(await p.locator('#tb-declarer').innerText()));
  verifie('la déclaration est en tête de « À décider »', await p.evaluate(() => document.querySelector('.tb-faire .card-head')?.nextElementSibling?.id === 'tb-declarer'));
  await shot(`l13-declarer${suf}`);
  await p.locator('[data-declare]').click(); await p.waitForTimeout(500);
  verifie('« C’est fait » retire le rappel et date la déclaration', (await p.locator('#tb-declarer').count()) === 0 && !!(await donnees((d) => d.absences.find((a) => a.type === 'accident').accident.declareLe)));
  // ---- Solvi : une vraie conversation
  await p.locator('.aide-fab').click(); await p.waitForTimeout(400);
  const dire = async (t) => { await p.locator('#aide-question').fill(t); await p.keyboard.press('Enter'); await p.waitForTimeout(700); return p.locator('.aide-bulle.bot').last().innerText(); };
  const aime = await dire('je t’aime');
  verifie('Solvi reçoit « je t’aime » pour ce que c’est : ' + aime.split('\n')[0].slice(0, 60), !/Avec plaisir|Revenez quand vous voulez/.test(aime) && /aime bien|réciproque|tiens à vous/.test(aime));
  const demain = await dire('qui travail demian ?');
  verifie('Solvi comprend les fautes de frappe', /^Demain/.test(demain));
  const samedi = await dire('et samedi ?');
  verifie('Solvi suit le fil : « et samedi ? »', /^(Sam\.|Demain)/.test(samedi));
  const retard = await dire('je suis en retard');
  verifie('Solvi propose la fenêtre de retard', /Prévenir d’un retard/.test(retard));
  await shot(`l13-solvi${suf}`);
  await p.locator('.aide-bulle.bot').last().getByRole('button', { name: /Prévenir d’un retard/ }).click(); await p.waitForTimeout(500);
  verifie('le bouton de Solvi ouvre « Signaler », sur le retard', (await p.locator('#sg-confirmer').count()) === 1 && (await p.locator('#sg-retard').isChecked()));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // ---- Surface de l'officine
  if (MOBILE) { await p.locator('.tab.burger').click(); await p.waitForTimeout(300); }
  await p.locator('[data-tour="nav-officine"]').click(); await p.waitForTimeout(500);
  verifie('réglages : la surface de démonstration est affichée', (await p.locator('#officine-surface').inputValue()) === '180' && /180 m²/.test(await p.locator('.page-fait').innerText()));
  await p.locator('#officine-surface').fill('215'); await p.waitForTimeout(300);
  verifie('la surface se modifie, en mètres carrés', (await donnees((d) => d.officine.surface)) === 215);
  await shot(`l13-surface${suf}`);
  console.log(`\n${ok}/${ok + ko} vérifications`); console.log(errs.length ? errs.join('\n') : 'aucune erreur de page');
  await b.close();
})();
