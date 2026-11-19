import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, mondayOf } from '../domain/time';
import type { Shift } from '../domain/types';
import { decisions } from '../engine/decisions';
import { changementsSemaine } from '../engine/publish';
import { optionsReparation } from '../engine/repair';
import { useStore } from './store';

const s = (): ReturnType<typeof useStore.getState> => useStore.getState();
/** Ce que le titulaire voit et que l'équipe ne voit pas encore, sur les semaines publiées. */
const ecarts = (): string[] =>
  Object.keys(s().data.semaines)
    .filter((m) => s().data.semaines[m].statut === 'publie')
    .flatMap((m) => changementsSemaine(s().data, m).map((c) => `${c.personId} ${c.date} : ${c.avant} → ${c.apres}`));
/** La journée d'une personne telle que l'équipe la lit : dans la version publiée. */
const publie = (personId: string, date: string): Shift[] => (s().data.semaines[mondayOf(date)]?.snapshot ?? []).filter((x) => x.personId === personId && x.date === date);
const reel = (personId: string, date: string): Shift[] => s().data.shifts.filter((x) => x.personId === personId && x.date === date);

beforeEach(() => {
  s().chargerExemple(true);
  s().setActeur('p_helene');
});

describe('tout le monde lit le même planning', () => {
  it('l’exemple démarre sans écart entre le planning du titulaire et la version publiée', () => {
    expect(ecarts()).toEqual([]);
    expect(decisions(s().data, s().today).publications).toEqual([]);
  });

  it('un congé approuvé retire aussitôt les postes de la version publiée', () => {
    const conge = s().data.absences.find((a) => a.statut === 'demandee')!;
    const jours = [0, 1, 2, 3, 4].map((i) => addDays(conge.from, i));
    expect(jours.some((d) => publie(conge.personId, d).length > 0)).toBe(true);
    s().deciderAbsence(conge.id, true);
    expect(jours.every((d) => publie(conge.personId, d).length === 0)).toBe(true);
    expect(ecarts()).toEqual([]);
  });

  it('une absence enregistrée par le titulaire se lit partout, sans republier', () => {
    const today = s().today;
    const avant = publie('p_thomas', today).length + publie('p_thomas', addDays(today, 1)).length;
    expect(avant).toBeGreaterThan(0);
    s().declarerAbsence({ personId: 'p_thomas', from: today, to: addDays(today, 1), type: 'maladie', statut: 'approuvee' } as never);
    expect(publie('p_thomas', today)).toEqual([]);
    expect(publie('p_thomas', addDays(today, 1))).toEqual([]);
    expect(ecarts()).toEqual([]);
    // Les postes laissés deviennent des postes à couvrir.
    expect(s().data.trous.filter((t) => t.shift.personId === 'p_thomas').length).toBe(avant);
  });

  it('couvrir une absence change la journée du remplaçant dans la version publiée, et le prévient', () => {
    const absence = s().data.absences.find((x) => s().data.trous.some((t) => t.absenceId === x.id))!;
    const avant = s().data.notifications.length;
    s().resoudreAbsence(absence.id);
    expect(ecarts()).toEqual([]);
    // Chaque journée modifiée pour couvrir est lue telle quelle par l'intéressé, qui reçoit un avis de changement.
    const nouveaux = s().data.notifications.slice(0, s().data.notifications.length - avant);
    for (const n of nouveaux) {
      expect(publie(n.personId, n.date).map((x) => `${x.start}-${x.end}`).sort()).toEqual(reel(n.personId, n.date).map((x) => `${x.start}-${x.end}`).sort());
      expect(n.personId).not.toBe(absence.personId);
    }
  });

  it('chaque façon de régler un poste à couvrir se répercute', () => {
    const types = optionsReparation(s().data, s().data.trous[0].shift, s().today).options.map((o) => o.type);
    expect(types.length).toBeGreaterThan(0);
    for (const type of types) {
      s().chargerExemple(true);
      s().setActeur('p_helene');
      const trou = s().data.trous[0];
      s().resoudreTrou(trou.id, optionsReparation(s().data, trou.shift, s().today).options.find((o) => o.type === type)!);
      expect(ecarts(), type).toEqual([]);
    }
  });

  it('une formation planifiée libère les participants dans la version publiée', () => {
    const jour = addDays(mondayOf(s().today), 8);
    expect(publie('p_ines', jour).length + publie('p_thomas', jour).length).toBeGreaterThan(0);
    s().planifierFormation({ intitule: 'Vaccination', personnes: ['p_ines', 'p_thomas'], from: jour, to: jour, cadre: 'interne' as never });
    expect(publie('p_ines', jour)).toEqual([]);
    expect(publie('p_thomas', jour)).toEqual([]);
    expect(ecarts()).toEqual([]);
  });

  it('un remplacement validé, un inventaire, une garde confiée, un départ : aucun écart', () => {
    const r = s().data.remplacements.find((x) => x.statut === 'ouverte' && x.volontaires.length)!;
    s().validerRemplacement(r.id, r.volontaires[0]);
    expect(ecarts()).toEqual([]);
    const samedi = addDays(mondayOf(s().today), 12);
    s().planifierInventaire({ date: samedi, start: 9 * 60, end: 13 * 60, personnes: ['p_ines', 'p_thomas'] });
    expect(ecarts()).toEqual([]);
    const garde = s().data.gardes.find((g) => !g.personId && g.date >= s().today)!;
    s().affecterGarde(garde.id, 'p_karim', false);
    expect(ecarts()).toEqual([]);
    s().supprimerPersonne('p_thomas');
    expect(ecarts()).toEqual([]);
    expect(Object.values(s().data.semaines).some((x) => (x.snapshot ?? []).some((p) => p.personId === 'p_thomas' && p.date >= s().today))).toBe(false);
  });

  it('une retouche à la main dans la grille reste un brouillon jusqu’à « Publier les modifications »', () => {
    const lundi = addDays(mondayOf(s().today), 7);
    const poste = s().data.shifts.find((x) => x.date >= lundi && x.date <= addDays(lundi, 5) && x.personId === 'p_ines')!;
    s().saveShift({ ...poste, end: poste.end - 30 });
    expect(ecarts()).toHaveLength(1);
    expect(publie('p_ines', poste.date)[0].end).toBe(poste.end);
    expect(decisions(s().data, s().today).publications.map((p) => p.type)).toEqual(['modifications']);
    s().publier(lundi, [], 0);
    expect(ecarts()).toEqual([]);
    expect(publie('p_ines', poste.date)[0].end).toBe(poste.end - 30);
    // L'intéressée est prévenue du changement.
    expect(s().data.notifications[0]).toMatchObject({ personId: 'p_ines', date: poste.date });
  });

  it('publier une semaine la rend lisible par chacun, poste pour poste', () => {
    const lundi = addDays(mondayOf(s().today), 21);
    expect(s().data.semaines[lundi]?.statut).not.toBe('publie');
    s().copierSemaine(addDays(mondayOf(s().today), 7), lundi);
    expect(s().data.semaines[lundi]?.statut).not.toBe('publie');
    s().publier(lundi, [], 0);
    const semaine = s().data.semaines[lundi];
    expect(semaine.statut).toBe('publie');
    expect((semaine.snapshot ?? []).length).toBe(s().data.shifts.filter((x) => x.date >= lundi && x.date <= addDays(lundi, 6)).length);
    expect(ecarts()).toEqual([]);
    expect((s().data.annonces ?? [])[0].titre).toMatch(/publié/);
  });
});
