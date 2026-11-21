const { ouvrir } = require('./h.js');
(async () => {
  const { b, p, errs, shot, data, texte } = await ouvrir({ role: 0 });
  await shot('01-tableau', { fullPage: true });
  console.log(JSON.stringify(await texte('.tb-chiffre'), null, 1));
  console.log(await texte('.tb-priorite'));
  console.log(await texte('.tb-faire'));
  console.log(await texte('.cycle'));
  console.log(await texte('.tb-jour'));
  console.log(await texte('.tb-agenda'));
  const d = await data();
  console.log('keys', Object.keys(d));
  console.log('demo', d.demo, 'semaines', JSON.stringify(Object.fromEntries(Object.entries(d.semaines).map(([k, v]) => [k, v.statut]))));
  console.log('personnes', d.personnes.map((x) => `${x.id}:${x.prenom} ${x.nom}:${x.qualification}:${x.contratHeures ?? x.heures}`).join(' | '));
  console.log('gardes', JSON.stringify(d.gardes.slice(0, 5)));
  console.log('errs', errs);
  await b.close();
})();
