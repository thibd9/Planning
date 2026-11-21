// Cas de test injectés dans les données enregistrées (demandes venant de l'équipe), puis la page est rechargée.
exports.DEMANDES_REMPLACEMENT = `
  const poste = (pid, date) => d.shifts.find((s) => s.personId === pid && s.date === date);
  const mk = (id, pid, date, urgence, motif) => { const s = poste(pid, date); d.remplacements.push({ id, shiftId: s.id, demandeur: pid, date, start: s.start, end: s.end, creeLe: '2026-11-20T08:00:00.000Z', volontaires: [], statut: 'ouverte', urgence, accord: 'attente', motif, precision: 'Test audit' }); };
  mk('r_audit_prevu', 'p_camille', '2026-11-30', 'prevu', 'famille');
  mk('r_audit_medical', 'p_sarah', '2026-11-24', 'medical', 'sante');
  mk('r_audit_igor', 'p_karim', '2026-11-25', 'urgent', 'famille');
`;
exports.CONGE_SARAH = `
  d.absences.push({ id: 'a_audit_sarah', personId: 'p_sarah', from: '2026-12-01', to: '2026-12-03', type: 'conge', statut: 'demandee', createdAt: '2026-11-20T09:00:00.000Z', motif: 'famille', precision: 'Mariage' });
`;
