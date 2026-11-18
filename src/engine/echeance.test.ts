import { describe, expect, it } from 'vitest';
import { seed } from '../data/seed';
import { addDays, mondayOf } from '../domain/time';
import type { AppData, Shift } from '../domain/types';
import { etatPublication, preparerMois, semaineHabituelle, semainesDuMois } from './echeance';

const AUJ = '2026-11-18';
const poste = (personId: string, date: string, start: number, end: number): Shift => ({ id: `s_${personId}_${date}_${start}`, personId, date, start, end, activite: 'comptoir' }) as Shift;
/** Une pharmacie sans planning, puis ce que le test y pose. */
const vide = (): AppData => ({ ...seed(AUJ, -99), shifts: [], semaines: {}, absences: [], besoins: [], souhaits: [] });
/** Huit semaines publiées où Nicolas fait toujours le lundi matin, sauf une fois l'après-midi. */
const avecHabitudes = (): AppData => {
  const d = vide();
  const lundi0 = mondayOf(AUJ);
  const shifts: Shift[] = [];
  const semaines: AppData['semaines'] = {};
  for (let k = 1; k <= 8; k++) {
    const l = addDays(lundi0, -7 * k);
    const s = [k === 3 ? poste('p_camille', l, 840, 1140) : poste('p_camille', l, 510, 780), poste('p_helene', l, 510, 1170), poste('p_helene', addDays(l, 1), 510, 1170)];
    // Thomas ne travaille le mardi qu'une semaine sur quatre : ce n'est pas une habitude.
    if (k % 4 === 0) s.push(poste('p_thomas', addDays(l, 1), 510, 780));
    shifts.push(...s);
    semaines[l] = { statut: 'publie', snapshot: s };
  }
  return { ...d, shifts, semaines };
};

describe('publication au mois', () => {
  it('compte les semaines qui touchent le mois', () => {
    expect(semainesDuMois('2026-12')).toEqual(['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28']);
  });

  it('rappelle avant l’échéance, puis signale qu’elle est dépassée', () => {
    const d = vide();
    // Par défaut : à publier 14 jours avant le 1er, rappel 7 jours plus tôt.
    const calme = etatPublication(d, '2026-11-05');
    expect(calme.mois).toBe('2026-12');
    expect(calme.echeance).toBe('2026-11-17');
    expect(calme.rappelLe).toBe('2026-11-10');
    expect(calme.etat).toBe('tranquille');
    expect(etatPublication(d, '2026-11-12').etat).toBe('rappel');
    expect(etatPublication(d, '2026-11-12').jours).toBe(5);
    expect(etatPublication(d, '2026-11-17').etat).toBe('rappel');
    expect(etatPublication(d, '2026-11-18').etat).toBe('depasse');
    const regle = { ...d, officine: { ...d.officine, publication: { delai: 7, rappel: 3 } } };
    expect(etatPublication(regle, '2026-11-18').echeance).toBe('2026-11-24');
    expect(etatPublication(regle, '2026-11-18').etat).toBe('tranquille');
  });

  it('un mois entièrement publié ne rappelle rien', () => {
    const d = vide();
    const semaines = Object.fromEntries(semainesDuMois('2026-12').map((l) => [l, { statut: 'publie' as const, snapshot: [] }]));
    expect(etatPublication({ ...d, semaines }, AUJ).etat).toBe('publie');
  });

  it('retrouve les habitudes : la journée la plus fréquente, un jour rarement travaillé reste un repos', () => {
    const d = avecHabitudes();
    const cible = '2026-12-07';
    const semaine = semaineHabituelle(d, cible);
    const nicolas = semaine.filter((s) => s.personId === 'p_camille');
    expect(nicolas).toHaveLength(1);
    expect([nicolas[0].date, nicolas[0].start, nicolas[0].end]).toEqual([cible, 510, 780]);
    expect(semaine.filter((s) => s.personId === 'p_helene').map((s) => s.date)).toEqual([cible, addDays(cible, 1)]);
    expect(semaine.some((s) => s.personId === 'p_thomas')).toBe(false);
    expect(nicolas[0].explication).toMatch(/habitudes/);
  });

  it('ne propose rien à une personne absente ce jour-là, et rien sans historique', () => {
    const d = avecHabitudes();
    const cible = '2026-12-07';
    const absent = { ...d, absences: [{ id: 'a', personId: 'p_camille', from: cible, to: cible, type: 'conge', statut: 'approuvee', createdAt: '' }] as AppData['absences'] };
    expect(semaineHabituelle(absent, cible).some((s) => s.personId === 'p_camille')).toBe(false);
    expect(semaineHabituelle(vide(), cible)).toEqual([]);
  });

  it('prépare les semaines vides en brouillon, sans toucher à une semaine commencée à la main', () => {
    const d = avecHabitudes();
    const main = poste('p_thomas', '2026-12-14', 600, 900);
    const r = preparerMois({ ...d, shifts: d.shifts.concat(main) }, AUJ, '2026-12', '2026-11-18T08:00:00.000Z');
    // La semaine du 14 décembre, commencée à la main, garde son seul poste.
    expect(r.semaines).not.toContain('2026-12-14');
    expect(r.data.shifts.filter((s) => s.date >= '2026-12-14' && s.date <= '2026-12-20')).toEqual([main]);
    expect(r.semaines).toContain('2026-12-07');
    expect(r.habitudes).toBe(r.semaines.length);
    // Rien n'est publié : ce sont des brouillons, marqués comme préparés par Solvéa.
    for (const l of r.semaines) {
      expect(r.data.semaines[l].statut).toBe('brouillon');
      expect(r.data.semaines[l].auto).toBeTruthy();
    }
    const apres = etatPublication(r.data, AUJ);
    expect(apres.vides).toBe(0);
    expect(apres.semaines.filter((s) => s.auto).length).toBe(r.semaines.length);
  });
});
