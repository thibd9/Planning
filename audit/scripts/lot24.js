// Lot 24 : préférences visibles partout, attribution et tirage au sort, vue Mois active.
const { ouvrir } = require('./lib.js');
(async () => {
  const ok = []; const ko = []; const t = (nom, c) => (c ? ok : ko).push(nom);
  const { b, p, errs, nav, shot } = await ouvrir({ role: 0, w: 1280, h: 760 });
  const donnees = async (f) => { await p.waitForTimeout(350); return p.evaluate((corps) => { const v = JSON.parse(localStorage.getItem('releve.v3')); return new Function('d', `return (${corps})(d)`)(v.officines[v.courante]); }, f.toString()); };
  await nav('construire'); await p.waitForTimeout(500);
  // la semaine du 7 décembre : les préférences y sont recueillies
  for (let i = 0; i < 6 && !/7 – 13 décembre/.test(await p.locator('.plan-bar, .plan').first().innerText()); i++) { await p.locator('[aria-label="Semaine suivante"]').click(); await p.waitForTimeout(300); }
  const pastilles = await p.locator('.pg-pref').count();
  t(`semaine : les préférences se lisent dans les cases (${pastilles})`, pastilles > 10);
  t('la case « Préférences » est cochée d’office', await p.locator('#plan-preferences').isChecked());
  await p.locator('#plan-preferences').uncheck(); await p.waitForTimeout(250);
  t('décochée, elle masque les préférences', (await p.locator('.pg-pref').count()) === 0);
  await p.locator('#plan-preferences').check(); await p.waitForTimeout(250);
  // un jour où plusieurs personnes demandent la même forme
  const cas = await donnees((d) => { const jours = ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11', '2026-12-12']; for (const date of jours) for (const choix of ['matin', 'journee', 'soir']) { const q = (d.souhaits || []).filter((s) => s.date === date && s.choix === choix).map((s) => s.personId); if (q.length >= 2) return { date, choix, q, prenoms: q.map((id) => d.personnes.find((x) => x.id === id).prenom) }; } return null; });
  t(`un créneau demandé par plusieurs personnes existe (${cas ? cas.prenoms.join(', ') + ' le ' + cas.date : 'aucun'})`, !!cas);
  if (cas) {
    const jour = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][new Date(cas.date + 'T12:00').getDay() - 1];
    const type = { matin: 'Matin', journee: 'Ouverture', soir: 'Après-midi' }[cas.choix];
    await p.locator(`.plan-grid .add[aria-label*="${cas.prenoms[0]}"][aria-label*="${jour}"]`).first().click(); await p.waitForTimeout(450);
    await p.locator('.dialog .ptc', { hasText: type }).first().click(); await p.waitForTimeout(300);
    const texte = await p.locator('#dp-pref-texte').innerText();
    t(`nouveau poste : Solvéa dit qui a demandé le créneau (« ${texte.slice(0, 70)} »)`, new RegExp(cas.prenoms[1]).test(texte) && /demandé ce créneau/.test(texte));
    t('la fenêtre tient dans l’écran d’un portable, sans défilement', await p.locator('.dialog').last().evaluate((d) => d.getBoundingClientRect().bottom <= innerHeight + 1));
    t('plusieurs demandes : le tirage au sort est proposé', /Tirer au sort entre/.test(await p.locator('#dp-tirer').innerText()));
    await p.locator('#dp-tirer').click(); await p.waitForTimeout(350);
    const sort = await p.locator('#dp-tirage').innerText();
    const somme = (await p.locator('.dp-pref-chance').allInnerTexts()).reduce((a, t) => a + parseInt(t, 10), 0);
    t(`le sort désigne une des personnes et affiche les chances (total ${somme} %)`, cas.prenoms.some((n) => sort.includes(`désigné ${n}`)) && somme >= 98 && somme <= 102);
    await shot('l24-tirage');
    const gagnant = cas.prenoms.find((n) => sort.includes(`désigné ${n}`));
    await p.locator('.dialog-foot .btn.primary').click(); await p.waitForTimeout(500);
    const pose = await donnees((d) => d.shifts.filter((s) => s.date >= '2026-12-07' && s.date <= '2026-12-12').map((s) => ({ date: s.date, prenom: d.personnes.find((x) => x.id === s.personId).prenom })));
    t(`le poste est posé pour la personne tirée au sort (${gagnant})`, pose.length === 1 && pose[0].date === cas.date && pose[0].prenom === gagnant);
    t('dans la grille, sa préférence passe en « suivie »', (await p.locator('.pg-pref.ok').count()) === 1);
  }
  // une seule personne demande : on lui accorde
  const seul = await donnees((d) => { const jours = ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11', '2026-12-12']; for (const date of jours) for (const choix of ['matin', 'soir', 'journee']) { const q = (d.souhaits || []).filter((s) => s.date === date && s.choix === choix && !d.shifts.some((x) => x.personId === s.personId && x.date === date)).map((s) => s.personId); if (q.length === 1 && !d.shifts.some((x) => x.date === date)) return { date, choix, prenom: d.personnes.find((x) => x.id === q[0]).prenom }; } return null; });
  t(`un créneau demandé par une seule personne existe (${seul ? seul.prenom + ' le ' + seul.date : 'aucun'})`, !!seul);
  if (seul) {
    const jour = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][new Date(seul.date + 'T12:00').getDay() - 1];
    const type = { matin: 'Matin', journee: 'Ouverture', soir: 'Après-midi' }[seul.choix];
    await p.locator(`.plan-grid .add[aria-label*="Caroline"][aria-label*="${jour}"]`).first().click(); await p.waitForTimeout(450);
    await p.locator('.dialog .ptc', { hasText: type }).first().click(); await p.waitForTimeout(300);
    t('une seule demande : « Accorder ce poste à … »', new RegExp(`Accorder ce poste à ${seul.prenom}`).test(await p.locator('#dp-accorder').innerText().catch(() => '')));
    await p.locator('#dp-accorder').click().catch(() => {}); await p.waitForTimeout(300);
    t('le poste change de titulaire dans l’en-tête de la fenêtre', new RegExp(seul.prenom).test(await p.locator('.dialog').last().locator('.dialog-head, header').first().innerText()));
    await p.locator('.dialog-foot .btn.primary').click(); await p.waitForTimeout(500);
    t('le poste est enregistré pour elle', await donnees(new Function('d', `return d.shifts.some((s) => s.date === '${seul.date}' && d.personnes.find((x) => x.id === s.personId).prenom === '${seul.prenom}')`)));
  }
  // la journée
  await p.locator('.pg-h .jour-btn').first().click(); await p.waitForTimeout(500);
  t('fenêtre de la journée : « A demandé : … »', (await p.locator('.je-pref').count()) > 0);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // le mois
  await p.locator('button', { hasText: /^Mois$/ }).first().click(); await p.waitForTimeout(700);
  t('mois : les préférences sont affichées sans rien cocher', (await p.locator('.mo-c.souhait').count()) > 20);
  t('mois : chaque case libre à venir peut recevoir un poste', (await p.locator('.mo-poser').count()) > 100);
  await p.locator('#mois-reponses').click(); await p.waitForTimeout(300);
  const liste = await p.locator('#mois-reponses-liste').innerText();
  t('« préférences reçues » liste qui a répondu et qui relancer', /Ont répondu · 7/.test(liste) && /Sans réponse · 4/.test(liste) && (await p.locator('[data-relancer]').count()) === 4);
  await shot('l24-mois');
  const avant = await donnees((d) => d.messages.length);
  await p.locator('[data-relancer]').nth(1).click(); await p.waitForTimeout(300);
  t('« Relancer » envoie un message à la personne', (await donnees((d) => d.messages.length)) === avant + 1 && /préférences/.test(await donnees((d) => d.messages[d.messages.length - 1].texte)));
  await p.locator('.mo-c.souhait.mo-poser').first().click(); await p.waitForTimeout(450);
  t('mois : un clic sur une case ouvre « Nouveau poste » sur place', /Nouveau poste/.test(await p.locator('.dialog').last().innerText()) && await p.locator('#dp-preferences').isVisible());
  await p.locator('.dialog-foot .btn.primary').click(); await p.waitForTimeout(500);
  t('enregistré depuis le mois, on reste dans la vue Mois', (await p.locator('#mois-reponses').count()) === 1 && (await p.locator('.dialog').count()) === 0);
  console.log(ko.length ? `ÉCHECS : ${ko.join(' | ')}` : ''); console.log(`lot24 : ${ok.length}/${ok.length + ko.length}`, errs.join(' ') || 'aucune erreur de page');
  await b.close();
})();
