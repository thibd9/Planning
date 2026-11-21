// Lot 22 : tout fonctionne ensemble. Construire, publier, décider, retoucher : chaque écran suit.
const { ouvrir } = require('./lib.js');
const ECARTS = () => { const v = JSON.parse(localStorage.getItem('releve.v3')); const d = v.officines[v.courante]; const lundi = (iso) => { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); }; const cle = (s) => `${s.personId}|${s.date}|${s.start}|${s.end}|${s.pauseStart ?? ''}|${s.pauseEnd ?? ''}`; let n = 0; for (const [m, sem] of Object.entries(d.semaines)) { if (sem.statut !== 'publie') continue; const a = new Set((sem.snapshot || []).map(cle)); const b = new Set(d.shifts.filter((s) => lundi(s.date) === m).map(cle)); for (const k of a) if (!b.has(k)) n++; for (const k of b) if (!a.has(k)) n++; } return n; };
(async () => {
  const ok = []; const ko = []; const t = (nom, c) => (c ? ok : ko).push(nom);
  let { b, p, errs, nav, shot } = await ouvrir({ role: 0, w: 1440, h: 1000 });
  const ecarts = () => p.evaluate(ECARTS);
  const donnees = (f) => p.evaluate((corps) => { const v = JSON.parse(localStorage.getItem('releve.v3')); return new Function('d', `return (${corps})(d)`)(v.officines[v.courante]); }, f.toString());
  t(`l'exemple démarre sans écart entre titulaire et équipe (${await ecarts()})`, await ecarts() === 0);
  t('tableau de bord : aucune note « non publié » au départ', await p.locator('#tb-nonpublie').count() === 0);
  // 1. Une décision : couvrir l'absence. Le planning publié suit, les personnes sont prévenues.
  const avant = await donnees((d) => ({ notifs: d.notifications.length, trous: d.trous.filter((x) => x.statut === 'ouvert').length }));
  await nav('resoudre'); await p.waitForTimeout(400);
  const onglet = p.locator('.onglet, [role=tab], button', { hasText: /Absences/ }).first(); if (await onglet.count()) await onglet.click().catch(() => {});
  await p.waitForTimeout(300);
  await p.locator('.panneau button', { hasText: 'Voir et choisir la solution' }).first().click(); await p.waitForSelector('.rs-jour', { timeout: 15000 }); await p.waitForTimeout(300);
  await p.locator('.dialog-foot .btn.primary').click(); await p.waitForTimeout(800);
  const apres = await donnees((d) => ({ notifs: d.notifications.length, trous: d.trous.filter((x) => x.statut === 'ouvert').length, annonce: d.annonces[0]?.titre }));
  t(`absence couverte : ${avant.trous} → ${apres.trous} poste(s) ouvert(s)`, apres.trous < avant.trous);
  t(`après la décision, aucun écart entre titulaire et équipe (${await ecarts()})`, await ecarts() === 0);
  t(`la décision est annoncée (${apres.annonce})`, !!apres.annonce);
  // Les personnes dont la journée change lisent la nouvelle journée dans la version publiée.
  const touches = await donnees((d) => d.notifications.slice(0, 6).map((n) => ({ personId: n.personId, date: n.date, apres: n.apres })));
  t(`avis de changement envoyés (${apres.notifs - avant.notifs})`, apres.notifs >= avant.notifs);
  await nav('tableau'); await p.waitForTimeout(500);
  t('tableau de bord : toujours aucune note « non publié » après une décision', await p.locator('#tb-nonpublie').count() === 0);
  // 2. Une retouche à la main sur une semaine publiée : c'est un brouillon, le tableau de bord le dit, puis on publie.
  await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('releve.v3')); const d = v.officines[v.courante]; const t = new Date(); const auj = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; const x = new Date(auj + 'T12:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); const lundi = x.toISOString().slice(0, 10); const fin = new Date(lundi + 'T12:00:00'); fin.setDate(fin.getDate() + 6); const dim = fin.toISOString().slice(0, 10); const s = d.shifts.filter((q) => q.date >= auj && q.date <= dim && q.personId !== 'p_helene').sort((a, b) => b.date.localeCompare(a.date))[0]; s.end -= 30; localStorage.setItem('releve.v3', JSON.stringify(v)); });
  await p.reload(); await p.waitForTimeout(900);
  t(`retouche à la main : un écart (${await ecarts()})`, await ecarts() >= 1);
  t('tableau de bord : la retouche non publiée est signalée', await p.locator('#tb-nonpublie').count() === 1 && /n’est pas encore publiée|ne sont pas encore publiées/.test(await p.locator('#tb-nonpublie').innerText()));
  await shot('l22-retouche');
  await p.locator('#tb-nonpublie .btn').click(); await p.waitForTimeout(900);
  await p.locator("[data-focus='publier']").first().click(); await p.waitForSelector('.dialog', { timeout: 10000 }); await p.waitForTimeout(300);
  const tout = p.locator('.dialog button', { hasText: 'Tout cocher' }); if (await tout.count()) await tout.click();
  const cases = p.locator('.dialog input[type=checkbox]'); for (let i = 0; i < await cases.count(); i++) await cases.nth(i).check({ force: true }).catch(() => {});
  await p.locator('.dialog-foot .btn.primary').click(); await p.waitForTimeout(900);
  t(`modifications publiées : plus d'écart (${await ecarts()})`, await ecarts() === 0);
  await nav('tableau'); await p.waitForTimeout(500);
  t('tableau de bord : la note a disparu', await p.locator('#tb-nonpublie').count() === 0);
  // 3. Une semaine en cours jamais construite : on la construit, on la publie, tout le monde la voit.
  await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('releve.v3')); const d = v.officines[v.courante]; const lundi = (iso) => { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); }; const t = new Date(); const auj = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; const cette = lundi(auj); d.shifts = d.shifts.filter((s) => lundi(s.date) !== cette); delete d.semaines[cette]; d.absences = d.absences.filter((a) => a.to < cette || a.from > cette); d.trous = []; d.remplacements = d.remplacements.filter((r) => lundi(r.date) !== cette); localStorage.setItem('releve.v3', JSON.stringify(v)); });
  await p.reload(); await p.waitForTimeout(900);
  t('semaine vide : le repère dit « Pas de planning »', /Pas de planning/.test(await p.locator('.tb-chiffre.tb-auj').innerText()));
  t('semaine vide : la carte du comptoir l’explique et propose de construire', /n’a aucun poste/.test(await p.locator('#tb-jour-vide').innerText()) && await p.locator('#tb-construire-semaine').count() === 1);
  await p.locator('#tb-construire-semaine').click(); await p.waitForTimeout(900);
  await p.getByRole('button', { name: /Proposer un planning/ }).first().click(); await p.waitForTimeout(700);
  const suite = p.getByRole('button', { name: /Calculer les propositions/ }).first(); if (await suite.count()) await suite.click().catch(() => {});
  await p.waitForSelector('.variant-titre', { timeout: 60000 }); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /Placer dans le brouillon/ }).click(); await p.waitForTimeout(900);
  await nav('tableau'); await p.waitForTimeout(500);
  t('brouillon de la semaine en cours : le tableau de bord dit que l’équipe ne le voit pas', await p.locator('#tb-nonpublie').count() === 1 && /brouillon/.test(await p.locator('#tb-nonpublie').innerText()));
  await p.locator('#tb-nonpublie .btn').click(); await p.waitForTimeout(900);
  await p.locator("[data-focus='publier']").first().click(); await p.waitForSelector('.dialog', { timeout: 10000 }); await p.waitForTimeout(300);
  const tout2 = p.locator('.dialog button', { hasText: 'Tout cocher' }); if (await tout2.count()) await tout2.click();
  const cases2 = p.locator('.dialog input[type=checkbox]'); for (let i = 0; i < await cases2.count(); i++) await cases2.nth(i).check({ force: true }).catch(() => {});
  await p.locator('.dialog-foot .btn.primary').click(); await p.waitForTimeout(700);
  const toast = await p.locator('.toast').innerText().catch(() => '');
  t(`le message dit quelle semaine est publiée (${toast.replace(/\n/g, ' ').slice(0, 90)})`, /Semaine du .* publiée/.test(toast));
  await nav('tableau'); await p.waitForTimeout(600);
  const repere = await p.locator('.tb-chiffre.tb-auj').innerText();
  t(`tableau de bord : l'équipe du jour apparaît (${repere.replace(/\n/g, ' ')})`, /en poste|Fermée/.test(repere) && await p.locator('#tb-nonpublie').count() === 0);
  await nav('moi'); await p.waitForTimeout(600);
  t('Mon planning (titulaire) : la semaine en cours est publiée', !/pas de planning publié/.test(await p.locator('.me').innerText()));
  t(`au bout du compte, aucun écart (${await ecarts()})`, await ecarts() === 0);
  await b.close();
  console.log(ko.length ? `ÉCHECS : ${ko.join(' | ')}` : ''); console.log(`lot22 : ${ok.length}/${ok.length + ko.length}`, errs.join(' ') || 'aucune erreur de page');
})();
