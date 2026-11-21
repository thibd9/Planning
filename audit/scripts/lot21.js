// Lot 21 : fiche d'équipe (couleur du rôle, accordéons, contrat, ancienneté), compétences par métier, « Mes compétences ».
const fs = require('fs');
const { ouvrir } = require('./lib.js');
const axeSrc = fs.readFileSync(__dirname + '/axe/node_modules/axe-core/axe.min.js', 'utf8');
const MODE = process.env.MODE;
(async () => {
  const ok = []; const ko = []; const t = (nom, c) => (c ? ok : ko).push(nom);
  let { b, p, errs, nav, shot } = await ouvrir({ role: 0, w: 1440, h: 1100, mode: MODE });
  const axe = async (nom) => { await p.evaluate(axeSrc); const r = await p.evaluate(async () => await window.axe.run(document.querySelector('.content') || document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })); t(`accessibilité : ${nom} (${r.violations.map((v) => v.id + ' ' + v.nodes.length).join(', ') || 'rien'})`, r.violations.length === 0); };
  const plein = (sel) => p.evaluate((s) => getComputedStyle(document.querySelector(s)).getPropertyValue('--a-plein').trim(), sel);
  await nav('equipe');
  // 1. La couleur du rôle
  await p.locator('.g-item', { hasText: 'Igor' }).click(); await p.waitForTimeout(400);
  t(`pharmacien : fiche bleu-vert (${await plein('.fiche')})`, /#0a5a63/i.test(await plein('.fiche')));
  t('pharmacien : la ligne choisie prend sa couleur', /#0a5a63/i.test(await plein('.g-item.on')));
  await shot(`l21-pharmacien${MODE === 'sombre' ? '-s' : ''}`);
  // 2. Les rubriques
  const rubriques = await p.locator('.fiche > details.acc > summary b').allInnerTexts();
  t(`rubriques en accordéon : ${rubriques.join(' | ')}`, rubriques.length >= 6 && rubriques[0] === 'Poste et contrat' && rubriques.includes('Compétences et diplômes'));
  // 3. Contrat et ancienneté
  t('contrat : CDI par défaut pour un pharmacien salarié', await p.locator('#fiche-contrat').inputValue() === 'cdi');
  t(`ancienneté affichée (${await p.locator('#fiche-anciennete').innerText()})`, /Ancienneté : \d+ ans?/.test(await p.locator('#fiche-anciennete').innerText()));
  await p.locator('#fiche-contrat').selectOption('cdd'); await p.waitForTimeout(200);
  t('contrat : le changement est enregistré', await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('releve.v3')); return v.officines[v.courante].personnes.find((x) => x.id === 'p_karim').contrat; }) === 'cdd');
  await p.locator('#fiche-contrat').selectOption('cdi');
  t('pharmacien : entretiens et tests proposés', !(await p.locator('.fiche [data-competence="entretien"]').isDisabled()) && !(await p.locator('.fiche [data-competence="trod"]').isDisabled()));
  // 4. Un préparateur : indigo, actes réservés verrouillés
  await p.locator('.g-item', { hasText: 'Nicolas' }).click(); await p.waitForTimeout(400);
  t(`préparateur : fiche indigo (${await plein('.fiche')})`, /#3730a3/i.test(await plein('.fiche')));
  t('préparateur : entretiens et tests verrouillés, vaccination permise', await p.locator('.fiche [data-competence="entretien"]').isDisabled() && await p.locator('.fiche [data-competence="trod"]').isDisabled() && !(await p.locator('.fiche [data-competence="vaccination"]').isDisabled()));
  t('la règle est dite', /sous le contrôle effectif d’un pharmacien/.test(await p.locator('.fiche .comp-regle').innerText()));
  await p.locator('.g-item', { hasText: 'Caroline' }).click(); await p.waitForTimeout(400);
  t('titulaire : contrat « non salarié », seul choix', await p.locator('#fiche-contrat').inputValue() === 'non_salarie' && await p.locator('#fiche-contrat option').count() === 1);
  await axe('équipe');
  await b.close();
  // 5. Chacun tient ses compétences à jour
  ({ b, p, errs, nav, shot } = await ouvrir({ role: 3, w: 1280, h: 1100, mode: MODE }));
  const compte = async () => { await p.locator('[data-tour="compte"]:visible').first().click(); await p.waitForTimeout(250); await p.locator('.menu button', { hasText: 'Mon compte' }).click(); await p.waitForTimeout(500); };
  await compte();
  t('préparateur : carte « Mes compétences et diplômes »', await p.locator('#mes-competences').count() === 1);
  t('préparateur : actes réservés verrouillés dans son compte', await p.locator('#mes-competences [data-competence="entretien"]').isDisabled());
  const cible = p.locator('#mes-competences .comp:not(.on):not(.reservee)').first(); const cle = await cible.getAttribute('data-competence');
  await cible.click(); await p.waitForTimeout(400);
  const apres = await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('releve.v3')); const d = v.officines[v.courante]; return { comp: d.personnes.find((x) => x.id === 'p_camille').competences, annonce: d.annonces[0] }; });
  t(`compétence ajoutée (${cle})`, apres.comp.includes(cle));
  t(`annonce aux titulaires (${apres.annonce.titre})`, /a mis à jour ses compétences/.test(apres.annonce.titre) && apres.annonce.pour.includes('p_helene') && apres.annonce.pour.includes('p_antoine'));
  await p.locator('#mes-competences').scrollIntoViewIfNeeded(); await axe('mon compte'); await shot(`l21-compte${MODE === 'sombre' ? '-s' : ''}`);
  await b.close();
  // 6. La titulaire lit l'annonce
  console.log(ko.length ? `ÉCHECS : ${ko.join(' | ')}` : ''); console.log(`lot21${MODE ? ' ' + MODE : ''} : ${ok.length}/${ok.length + ko.length}`, errs.join(' ') || 'aucune erreur de page');
})();
