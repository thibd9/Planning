// Lot 14 : propositions sans préférences, raccourcis de tâche, icônes d'état nues, planning d'équipe entier, retour en haut.
const { ouvrir } = require('./lib');
let ok = 0, ko = 0; const verifie = (nom, cond) => { cond ? ok++ : ko++; console.log(`${cond ? '✓' : '✗'} ${nom}`); };
(async () => {
  const { b, p, errs, nav, shot } = await ouvrir({ role: 0, w: 1440, h: 900 });
  // ---- Le titulaire prépare seul : pas de « Préférences d'abord »
  await nav('officine'); await p.locator('input[name="modele"]').nth(1).check({ force: true }); await p.waitForTimeout(400);
  await nav('construire'); await p.waitForTimeout(500);
  await p.getByRole('button', { name: /Proposer un planning/ }).first().click(); await p.waitForTimeout(600);
  const suite = p.getByRole('button', { name: /Calculer les propositions/ }).first();
  if (await suite.count()) { await suite.click().catch(() => {}); }
  await p.waitForSelector('.variant-titre', { timeout: 30000 }); await p.waitForTimeout(400);
  const titres = await p.locator('.variant-titre').allInnerTexts();
  const kpi = await p.locator('.kpi').first().innerText();
  verifie(`sans préférences, les propositions sont : ${titres.join(' | ')}`, !titres.some((t) => /Préférences/.test(t)) && titres.includes('Équité d’abord') && titres.includes('Contrats d’abord'));
  verifie('l’indicateur « Préférences suivies » n’est plus affiché', !/Préférences suivies/.test(kpi));
  verifie('le titre annonce le bon nombre de propositions', new RegExp(titres.length === 2 ? '^Deux' : '^Trois').test(await p.locator('.dialog h2').innerText()));
  await shot('l14-propositions'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // ---- Icônes d'état : nues, sans pastille
  const marques = await p.evaluate(() => [...document.querySelectorAll('.pg-o .mark')].map((m) => { const s = getComputedStyle(m); return s.backgroundColor + '|' + s.borderRadius; }));
  verifie(`« Équipe au complet ? » : ${marques.length} icônes sans fond ni cercle`, marques.length > 0 && marques.every((m) => /rgba\(0, 0, 0, 0\)\|0px/.test(m)));
  // ---- Tâche d'un poste : formation et inventaire ouvrent leur fenêtre
  await p.locator('.pg-c .add').first().click(); await p.waitForTimeout(400);
  verifie('tâche : trois choix, et deux raccourcis', (await p.locator('.choix input[name="tache"]').count()) === 3 && (await p.locator('.choix .choix-vers').count()) === 2);
  await shot('l14-tache');
  await p.locator('#tache-vers-formation').click(); await p.waitForTimeout(700);
  verifie('« Planifier une formation » ouvre la fenêtre de formation', /formation/i.test(await p.locator('.dialog h2').innerText()) && (await p.locator('#formation-lieu').count()) === 1);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // ---- Retour en haut en changeant d'écran
  await nav('equipe'); await p.evaluate(() => { document.getElementById('contenu').scrollTop = 700; }); await p.waitForTimeout(100);
  await nav('heures');
  verifie('changer d’écran ramène en haut de la page', (await p.evaluate(() => document.getElementById('contenu').scrollTop)) === 0);
  await b.close();
  // ---- Planning de l'équipe : du lundi au dimanche, sans coupure, à toutes les largeurs
  for (const [w, h] of [[1440, 900], [1180, 800], [1024, 768], [820, 1100], [600, 900], [390, 844], [360, 740]]) {
    const t = await ouvrir({ role: 3, w, h });
    const burger = t.p.locator('.tab.burger'); if (await burger.isVisible()) { await burger.click(); await t.p.waitForTimeout(250); }
    await t.p.locator('[data-tour="nav-planning"]').first().click(); await t.p.waitForTimeout(600);
    const m = await t.p.evaluate(() => { const z = document.querySelector('.plan-scroll'); const tb = z.querySelector('table'); const zr = z.getBoundingClientRect(); const cols = [...tb.querySelectorAll('thead th')].map((x) => x.getBoundingClientRect()); const tuiles = [...tb.querySelectorAll('.tile')].map((x) => x.getBoundingClientRect()); return { table: Math.round(tb.getBoundingClientRect().width), zone: Math.round(zr.width), dernier: Math.round(cols[cols.length - 1].right - zr.right), jour: Math.round(cols[1].width), hors: tuiles.filter((r) => r.right > zr.right + 1).length, n: cols.length }; });
    verifie(`planning de l’équipe à ${w}px : tous les jours ouverts visibles (jour = ${m.jour}px, table ${m.table}/${m.zone})`, m.n >= 7 && m.table <= m.zone + 1 && m.dernier <= 1 && m.hors === 0);
    if (w === 1440 || w === 820 || w === 390) await t.shot(`l14-equipe-${w}`);
    await t.b.close();
  }
  console.log(`\n${ok}/${ok + ko} vérifications`); console.log(errs.length ? errs.join('\n') : 'aucune erreur de page');
})();
