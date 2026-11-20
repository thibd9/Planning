import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, mondayOf } from '../domain/time';
import { generer } from '../engine/generate';
import { useStore } from './store';

const s = (): ReturnType<typeof useStore.getState> => useStore.getState();
const postesDe = (personId: string, date: string): number => s().data.shifts.filter((x) => x.personId === personId && x.date === date).length;

beforeEach(() => {
  s().chargerExemple(true);
  s().setActeur('p_helene');
});

describe('le poste type « Repos »', () => {
  it('poser un repos retire le poste du jour et laisse une trace dans la grille', () => {
    const poste = s().data.shifts.find((x) => x.date > s().today)!;
    s().poserRepos(poste.personId, poste.date);
    expect(postesDe(poste.personId, poste.date)).toBe(0);
    expect(s().data.repos).toContainEqual({ personId: poste.personId, date: poste.date });
  });

  it('un poste posé un jour de repos remplace ce repos', () => {
    const poste = s().data.shifts.find((x) => x.date > s().today)!;
    s().poserRepos(poste.personId, poste.date);
    s().saveShift({ ...poste, id: 'nouveau' });
    expect(postesDe(poste.personId, poste.date)).toBe(1);
    expect((s().data.repos ?? []).some((r) => r.personId === poste.personId && r.date === poste.date)).toBe(false);
  });

  it('une proposition de planning respecte les repos posés', () => {
    const lundi = addDays(mondayOf(s().today), 14);
    const res0 = generer(s().data, lundi, { variante: 'equite', graine: 7, iterations: 3000 });
    const cible = res0.shifts[0];
    s().poserRepos(cible.personId, cible.date);
    const res = generer(s().data, lundi, { variante: 'equite', graine: 7, iterations: 3000 });
    expect(res.shifts.some((x) => x.personId === cible.personId && x.date === cible.date)).toBe(false);
  });
});

describe('remettre un planning à zéro', () => {
  it('retire les postes et les repos des jours à venir, garde les jours passés', () => {
    const today = s().today;
    const lundi = mondayOf(today);
    const passes = s().data.shifts.filter((x) => x.date >= lundi && x.date < today).length;
    const futur = s().data.shifts.find((x) => x.date > today && x.date <= addDays(lundi, 6));
    if (futur) s().poserRepos(futur.personId, futur.date);
    s().remettreAZero(lundi, addDays(lundi, 6));
    expect(s().data.shifts.filter((x) => x.date >= today && x.date <= addDays(lundi, 6))).toEqual([]);
    expect(s().data.shifts.filter((x) => x.date >= lundi && x.date < today).length).toBe(passes);
    expect((s().data.repos ?? []).filter((r) => r.date >= today && r.date <= addDays(lundi, 6))).toEqual([]);
  });

  it('se défait d’un seul « Annuler »', () => {
    const lundi = addDays(mondayOf(s().today), 7);
    const avant = s().data.shifts.filter((x) => x.date >= lundi && x.date <= addDays(lundi, 6)).length;
    expect(avant).toBeGreaterThan(0);
    s().remettreAZero(lundi, addDays(lundi, 6));
    expect(s().data.shifts.filter((x) => x.date >= lundi && x.date <= addDays(lundi, 6)).length).toBe(0);
    s().undo();
    expect(s().data.shifts.filter((x) => x.date >= lundi && x.date <= addDays(lundi, 6)).length).toBe(avant);
  });

  it('une semaine publiée remise à zéro reste lisible par l’équipe jusqu’à la prochaine publication', () => {
    const lundi = addDays(mondayOf(s().today), 7);
    const snap = s().data.semaines[lundi]?.snapshot?.length ?? 0;
    s().remettreAZero(lundi, addDays(lundi, 6));
    expect(s().data.semaines[lundi]?.snapshot?.length ?? 0).toBe(snap);
  });
});
