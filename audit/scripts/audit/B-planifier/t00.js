const { ouvrir } = require('./h.js');
(async () => {
  const { b, p, data } = await ouvrir({ role: 0 });
  const d = await data();
  const fs = require('fs'); fs.writeFileSync(__dirname + '/donnees-initiales.json', JSON.stringify(d, null, 1));
  const o = d.officine;
  console.log('officine', JSON.stringify({ nom: o.nom, fermeJoursFeries: o.fermeJoursFeries, horaires: o.horaires, collaboratif: o.collaboratif ?? o.preparation, publication: o.publication, postes: o.postes.map((x) => `${x.id}:${x.label}:${x.start}-${x.end}:p${x.pauseStart}-${x.pauseEnd}:j${x.jours}`) }, null, 0));
  console.log('officine keys', Object.keys(o));
  console.log('absences', d.absences.map((a) => `${a.personId} ${a.type} ${a.statut} ${a.from}->${a.to}`).join('\n'));
  console.log('repos', JSON.stringify(d.repos));
  console.log('souhaits', d.souhaits.length, JSON.stringify(d.souhaits.slice(0, 5)));
  console.log('personnes', d.personnes.map((x) => `${x.id}:${x.prenom}:${x.qualification}:${x.heuresHebdo}h:sal${x.salarie}:ext${!!x.externe}`).join(' | '));
  console.log('notifications', d.notifications.length, 'messages', d.messages.length, 'trous', d.trous.length);
  console.log('shifts dates', [...new Set(d.shifts.map((s) => s.date))].sort().slice(-12).join(','));
  console.log('regles', d.regles.map((r) => `${r.id}:${r.titre}:${JSON.stringify(r.valeur ?? r.seuil ?? '')}`).join('\n'));
  await b.close();
})();
