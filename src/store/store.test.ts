import { beforeEach, describe, expect, it } from 'vitest';
import type { Justificatif } from '../domain/types';
import { absencesSimultanees, pointsForts } from '../engine/suivi';
import { useStore } from './store';

const s = (): ReturnType<typeof useStore.getState> => useStore.getState();
const PIECE: Justificatif = { nom: 'arret-volet3.png', type: 'image/png', taille: 68, data: 'data:image/png;base64,AAAA' };

beforeEach(() => {
  s().chargerExemple(true);
  s().setActeur('p_helene');
});

/** Un poste publié à venir de Nicolas, pour une demande de remplacement. */
const posteAVenir = () => {
  const d = s().data;
  const poste = d.shifts.filter((x) => x.personId === 'p_camille' && x.date > s().today && !d.remplacements.some((r) => r.shiftId === x.id)).sort((a, b) => a.date.localeCompare(b.date))[0];
  expect(poste).toBeTruthy();
  return poste;
};

describe('décisions annoncées', () => {
  it('un congé approuvé est annoncé à la personne et à tous les titulaires, avec ce qu’il change au planning', () => {
    const conge = s().data.absences.find((a) => a.personId === 'p_camille' && a.statut === 'demandee');
    expect(conge).toBeTruthy();
    const avant = (s().data.annonces ?? []).length;
    s().deciderAbsence(conge!.id, true);
    const annonces = s().data.annonces ?? [];
    expect(annonces).toHaveLength(avant + 1);
    const a = annonces[0];
    expect(a.titre).toMatch(/Congé de Nicolas L\. approuvé/);
    expect([...a.pour].sort()).toEqual(['p_antoine', 'p_camille', 'p_helene']);
    // Celle qui décide n'a pas à relire sa propre décision.
    expect(a.luPar).toEqual(['p_helene']);
    expect(a.auteur).toBe('p_helene');
    expect(a.effets.join(' ')).toMatch(/retirés? du planning|rien à couvrir/);
  });

  it('un refus dit que rien ne change, et « Vu » range l’annonce pour une seule personne', () => {
    const conge = s().data.absences.find((a) => a.personId === 'p_camille' && a.statut === 'demandee')!;
    const postes = s().data.shifts.length;
    s().deciderAbsence(conge.id, false, 'Raison : plusieurs absences déjà prévues.');
    const a = (s().data.annonces ?? [])[0];
    expect(a.titre).toMatch(/refusé/);
    expect(a.effets[0]).toMatch(/Aucun changement au planning/);
    expect(s().data.shifts).toHaveLength(postes);
    s().lireAnnonces('p_camille', a.id);
    const lue = (s().data.annonces ?? [])[0];
    expect(lue.luPar).toContain('p_camille');
    expect(lue.luPar).not.toContain('p_antoine');
    // Tout marquer comme lu ne touche que ses propres annonces.
    s().lireAnnonces('p_antoine');
    expect((s().data.annonces ?? []).every((x) => !x.pour.includes('p_antoine') || x.luPar.includes('p_antoine'))).toBe(true);
  });

  it('un remplacement validé annonce le changement des deux personnes', () => {
    const poste = posteAVenir();
    s().demanderRemplacement(poste, 'prevu', undefined, undefined, { motif: 'famille' });
    const r = s().data.remplacements.find((x) => x.shiftId === poste.id)!;
    s().deciderDemande(r.id, true);
    const candidat = s().data.remplacements.find((x) => x.id === r.id)!.sollicites?.[0];
    expect(candidat).toBeTruthy();
    s().seProposer(r.id, candidat!, true);
    s().validerRemplacement(r.id, candidat!);
    const a = (s().data.annonces ?? [])[0];
    expect(a.titre).toMatch(/Remplacement validé/);
    expect(a.pour).toEqual(expect.arrayContaining(['p_camille', candidat!, 'p_helene', 'p_antoine']));
    expect(a.effets[0]).toMatch(/Nicolas L\. : en poste → repos/);
    expect(a.effets[1]).toMatch(/repos → en poste/);
  });
});

describe('deux demandes sur les mêmes dates', () => {
  it('chaque demande montre l’autre, dans l’ordre d’arrivée, et l’annonce rappelle celle qui reste', () => {
    const conge = s().data.absences.find((a) => a.personId === 'p_camille' && a.statut === 'demandee')!;
    // Léa demande un congé qui chevauche celui de Nicolas, un jour plus tard.
    s().setActeur('p_lea');
    s().declarerAbsence({ personId: 'p_lea', from: conge.to, to: conge.to, type: 'conge', statut: 'demandee' });
    s().setActeur('p_helene');
    const lea = s().data.absences.find((a) => a.personId === 'p_lea' && a.statut === 'demandee')!;
    const vuDeNicolas = absencesSimultanees(s().data, conge);
    expect(vuDeNicolas.demandees.map((x) => x.absence.personId)).toEqual(['p_lea']);
    expect(vuDeNicolas.demandees[0]).toMatchObject({ jours: 1, avant: false });
    const vuDeLea = absencesSimultanees(s().data, lea);
    expect(vuDeLea.demandees[0]).toMatchObject({ jours: 1, avant: true });
    // Nicolas est accepté : pour Léa, il passe de « demande aussi » à « déjà absent », et l'annonce rappelle sa demande.
    s().deciderAbsence(conge.id, true);
    const apres = absencesSimultanees(s().data, lea);
    expect(apres.demandees).toHaveLength(0);
    expect(apres.accordees.map((x) => x.absence.personId)).toEqual(['p_camille']);
    expect((s().data.annonces ?? [])[0].effets.join(' ')).toMatch(/Reste à trancher sur ces dates : la demande de Léa F\./);
    // Une demande refusée ne compte plus.
    s().deciderAbsence(lea.id, false);
    expect(absencesSimultanees(s().data, conge).demandees).toHaveLength(0);
  });
});

describe('justificatifs conservés', () => {
  it('une demande refusée range son justificatif dans les documents de la personne, pour les titulaires', () => {
    const poste = posteAVenir();
    s().demanderRemplacement(poste, 'medical', PIECE, undefined, { motif: 'sante', precision: 'Rendez-vous' });
    const r = s().data.remplacements.find((x) => x.shiftId === poste.id)!;
    expect(r.justificatif?.data).toBe(PIECE.data);
    s().deciderDemande(r.id, false, 'Raison : effectif insuffisant.');
    const apres = s().data.remplacements.find((x) => x.id === r.id)!;
    expect(apres.statut).toBe('refusee');
    // La demande ne porte plus le fichier ni la précision ; le document, lui, est conservé.
    expect(apres.justificatif?.data).toBe('');
    expect(apres.precision).toBeUndefined();
    const doc = (s().data.documents ?? []).find((x) => x.source === r.id);
    expect(doc).toMatchObject({ personId: 'p_camille', categorie: 'justificatif', partage: true, data: PIECE.data, nom: PIECE.nom });
    expect(doc?.origine).toMatch(/Remplacement du .* · refusé/);
  });

  it('une demande annulée par la personne emporte son justificatif', () => {
    const poste = posteAVenir();
    s().demanderRemplacement(poste, 'medical', PIECE, undefined, { motif: 'sante' });
    const r = s().data.remplacements.find((x) => x.shiftId === poste.id)!;
    s().setActeur('p_camille');
    s().cloreRemplacement(r.id, 'annulee');
    expect((s().data.documents ?? []).some((x) => x.source === r.id)).toBe(false);
    expect(s().data.remplacements.find((x) => x.id === r.id)?.justificatif?.data).toBe('');
  });
});

describe('points forts', () => {
  it('ne tiennent jamais compte d’un arrêt, d’un congé ou d’une absence non prévue', () => {
    const d = s().data;
    const today = s().today;
    const avant = pointsForts(d, 'p_camille', today).map((x) => x.cle);
    expect(avant).toContain('ponctuel');
    const avecArret = {
      ...d,
      absences: d.absences.concat({ id: 'a_test', personId: 'p_camille', from: '2026-09-01', to: '2026-09-20', type: 'maladie', statut: 'approuvee', createdAt: '2026-09-01T08:00:00.000Z' }),
      ecarts: (d.ecarts ?? []).concat({ id: 'e_abs', personId: 'p_camille', date: '2026-10-05', type: 'absence', at: '2026-10-05T08:00:00.000Z' }),
    };
    expect(pointsForts(avecArret, 'p_camille', today).map((x) => x.cle)).toEqual(avant);
  });

  it('un retard noté retire « Toujours à l’heure » ; trop peu de postes ne dit rien', () => {
    const d = s().data;
    const today = s().today;
    const hier = d.shifts.filter((x) => x.personId === 'p_camille' && x.date < today).sort((a, b) => b.date.localeCompare(a.date))[0].date;
    const avecRetard = { ...d, ecarts: (d.ecarts ?? []).concat({ id: 'e_ret', personId: 'p_camille', date: hier, type: 'retard' as const, minutes: 10, at: `${hier}T09:00:00.000Z` }) };
    expect(pointsForts(avecRetard, 'p_camille', today).map((x) => x.cle)).not.toContain('ponctuel');
    const peu = { ...d, shifts: d.shifts.filter((x) => x.personId !== 'p_camille').concat(d.shifts.filter((x) => x.personId === 'p_camille').slice(0, 5)) };
    expect(pointsForts(peu, 'p_camille', today).map((x) => x.cle)).not.toContain('ponctuel');
  });
});

describe('prévenir d’un retard', () => {
  it('sans poste publié, l’avis part aux titulaires en message, sans rien changer au planning', () => {
    const avant = s().data;
    s().prevenirRetard({ personId: 'p_camille', date: s().today, minutes: 25, note: 'train supprimé' });
    const apres = s().data;
    // Aucun avis rattaché à un poste, aucun poste modifié.
    expect((apres.retards ?? []).length).toBe((avant.retards ?? []).length);
    expect(apres.shifts).toEqual(avant.shifts);
    // Un message par titulaire, qui dit la durée et l'absence de poste.
    const nouveaux = apres.messages.filter((m) => !avant.messages.some((x) => x.id === m.id));
    expect(nouveaux.length).toBeGreaterThan(0);
    expect(nouveaux.every((m) => m.de === 'p_camille' && /25 min/.test(m.texte) && /pas de poste publié/.test(m.texte) && /Train supprimé/.test(m.texte))).toBe(true);
  });

  it('avec un poste, l’avis donne l’heure d’arrivée', () => {
    const poste = posteAVenir();
    const avant = (s().data.retards ?? []).length;
    s().prevenirRetard({ personId: 'p_camille', date: poste.date, start: poste.start, minutes: 10 });
    const retards = s().data.retards ?? [];
    expect(retards).toHaveLength(avant + 1);
    expect(retards.at(-1)).toMatchObject({ personId: 'p_camille', date: poste.date, start: poste.start, minutes: 10 });
  });
});
