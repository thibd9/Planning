// A7 (exemple) : le quota de pharmaciens, et retirer une personne qui a des postes publiés, des gardes, des messages.
const { exemple } = require('./outils');
(async () => {
  const o = await exemple({ role: 0 });
  const { p, cap, texte } = o; const log = (...a) => console.log(...a);
  await o.fermerTour();
  let d = await o.courante();
  log('Exemple :', d.officine.nom, '| CA', d.officine.caAnnuelHT, '| activité (dimensionnement)', d.officine.infos?.activiteAnnuelle, '| tranche règle', d.regles.find((r) => r.id === 'pharmacie.adjoints').valeur);
  log('Pharmaciens :', d.personnes.filter((x) => ['titulaire', 'adjoint'].includes(x.qualification)).map((x) => `${x.prenom} ${x.qualification}${x.externe ? ' (externe)' : ''} ${x.heuresHebdo} h`).join(' ; '));
  await o.nav('equipe');
  log('ÉQUIPE en-tête :', (await texte('.page-head')).replace(/\n/g, ' | '));
  log('ÉQUIPE alertes :', (await p.locator('.content .notice.warn').allInnerTexts()).slice(0, 4).join(' || '));
  await cap('a7-01-equipe-exemple', { fullPage: false });
  await o.nav('officine');
  log('Dimensionnement (exemple) :', (await p.locator('#dimensionnement').innerText()).replace(/\n/g, ' | ').slice(0, 900));
  log('Règle officielle affichée :', await p.locator('#dim-adjoints').count());
  // Qui retirer : Igor (pharmacien), avec ses postes publiés, gardes, messages, remplacements.
  const igor = d.personnes.find((x) => x.prenom === 'Igor');
  const compter = (d, id) => ({
    postes: d.shifts.filter((s) => s.personId === id).length,
    postesPublies: Object.values(d.semaines).reduce((t, s) => t + (s.snapshot || []).filter((x) => x.personId === id).length, 0),
    postesAVenirPublies: Object.entries(d.semaines).reduce((t, [m, s]) => t + (s.snapshot || []).filter((x) => x.personId === id && x.date >= '2026-11-20').length, 0),
    gardes: d.gardes.filter((g) => g.personId === id).length,
    messages: d.messages.filter((m) => m.de === id || m.a === id).length,
    remplacements: d.remplacements.filter((r) => r.demandeur === id || (r.volontaires || []).includes(id) || r.remplacantId === id).length,
    souhaits: d.souhaits.filter((s) => s.personId === id).length,
    besoins: d.besoins.filter((b) => b.personId === id).length,
    absences: d.absences.filter((a) => a.personId === id).length,
    rdv: (d.rendezVous || []).filter((r) => r.de === id || r.avec === id).length,
    documents: (d.documents || []).filter((x) => x.personId === id).length,
    regul: (d.regularisations || []).filter((x) => x.personId === id).length,
    trous: d.trous.length,
  });
  const avant = compter(d, igor.id); log('IGOR avant retrait :', JSON.stringify(avant));
  const gardesIgor = d.gardes.filter((g) => g.personId === igor.id).map((g) => g.date);
  await o.nav('resoudre'); const resAvant = (await texte('.content')).slice(0, 300).replace(/\n/g, ' | '); log('RÉSOUDRE avant :', resAvant);
  await o.nav('equipe'); await p.locator('.g-item', { hasText: 'Igor' }).click(); await p.waitForTimeout(300);
  log('Texte de retrait :', await p.locator('.split > .card > .card-body.row').innerText());
  await p.getByRole('button', { name: /Retirer de l’équipe/ }).click(); await p.waitForTimeout(200);
  await cap('a7-02-confirmation-retrait');
  await p.getByRole('button', { name: /Oui, retirer Igor/ }).click(); await p.waitForTimeout(500);
  log('Toast :', await o.toast());
  d = await o.courante(); const apres = compter(d, igor.id); log('IGOR après retrait :', JSON.stringify(apres));
  log('Gardes d’Igor après :', gardesIgor.map((dt) => { const g = d.gardes.find((x) => x.date === dt); return `${dt}:${g ? (g.personId || 'non affectée') : 'supprimée'}`; }).join(', '));
  const msgOrph = d.messages.filter((m) => m.de === igor.id || m.a === igor.id).slice(0, 2); log('Messages orphelins (extrait) :', JSON.stringify(msgOrph.map((m) => ({ de: m.de, a: m.a, t: m.texte.slice(0, 40) }))));
  await o.nav('resoudre'); log('RÉSOUDRE après :', (await texte('.content')).slice(0, 300).replace(/\n/g, ' | '));
  await o.nav('messages'); await p.waitForTimeout(400); log('MESSAGES après :', (await texte('.content')).slice(0, 700).replace(/\n/g, ' | '));
  await cap('a7-03-messages-apres-retrait', { fullPage: false });
  await o.nav('gardes'); await p.waitForTimeout(400); log('GARDES après :', (await texte('.content')).slice(0, 700).replace(/\n/g, ' | '));
  await cap('a7-04-gardes-apres-retrait', { fullPage: false });
  await o.nav('construire'); await p.locator('button[aria-label="Semaine précédente"]').click(); await p.waitForTimeout(500);
  log('CONSTRUIRE semaine en cours (publiée) :', (await p.locator('.plan-grid').getAttribute('aria-label')), '| contrôles :', (await texte('[data-tour="controles"]')).replace(/\n/g, ' | ').slice(0, 700));
  await cap('a7-05-construire-apres-retrait', { fullPage: true });
  // Annuler le retrait ?
  log('Ctrl+Z possible depuis Construire : bouton annuler actif =', !(await p.locator('button[aria-label="Annuler la dernière manipulation"]').isDisabled()));
  // Les annonces à l'équipe : quelqu'un est-il prévenu ?
  log('Annonces récentes :', JSON.stringify((d.annonces || []).slice(0, 3).map((a) => a.titre)), '| journal :', JSON.stringify(d.journal.slice(0, 3).map((j) => j.titre)));
  log('ERREURS console :', o.errs.join(' || ') || 'aucune');
  await o.b.close();
})().catch((e) => { console.error('ARRÊT', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
