import { describe, expect, it } from 'vitest';
import { seed } from '../data/seed';
import { addDays, mondayOf } from '../domain/time';
import { minutesTravail } from './core';
import { appliquerCreneau, controlerCreneau, proposerCreneaux } from './rattrapage';

const TODAY = '2026-11-18';
const data = seed(TODAY, 2);
const igor = data.personnes.find((p) => p.prenom === 'Igor')!;
const nicolas = data.personnes.find((p) => p.prenom === 'Nicolas')!;

describe('rattrapage et récupération à un moment précis', () => {
  it('propose des créneaux de rattrapage sans rien de bloquant, dans les quatre semaines', () => {
    const liste = proposerCreneaux(data, nicolas.id, 120, 'rattrapage', TODAY);
    expect(liste.length).toBeGreaterThan(0);
    for (const c of liste) {
      expect(c.controle.bloquants).toEqual([]);
      expect(c.date > TODAY && c.date <= addDays(TODAY, 28)).toBe(true);
      expect(c.controle.minutes).toBeGreaterThanOrEqual(30);
      expect(c.controle.minutes).toBeLessThanOrEqual(120);
    }
    expect(new Set(liste.map((c) => c.date)).size).toBe(liste.length);
  });

  it('applique un rattrapage : les heures de la journée augmentent d’autant', () => {
    const [c] = proposerCreneaux(data, nicolas.id, 120, 'rattrapage', TODAY);
    const res = appliquerCreneau(data, nicolas.id, c, 'rattrapage');
    expect(res.data).not.toBeNull();
    const total = (d: typeof data): number => d.shifts.filter((s) => s.personId === nicolas.id && s.date === c.date).reduce((t, s) => t + minutesTravail(s), 0);
    expect(total(res.data!) - total(data)).toBe(c.controle.minutes);
  });

  it('refuse un créneau qui chevauche un poste, un jour fermé ou passé', () => {
    const poste = data.shifts.find((s) => s.personId === igor.id && s.date > TODAY)!;
    expect(controlerCreneau(data, igor.id, { date: poste.date, start: poste.start + 30, end: poste.start + 90 }, 'rattrapage', TODAY).bloquants.length).toBeGreaterThan(0);
    const dimanche = addDays(mondayOf(TODAY), 13);
    expect(controlerCreneau(data, igor.id, { date: dimanche, start: 600, end: 720 }, 'rattrapage', TODAY).bloquants.join(' ')).toMatch(/fermée/);
    expect(controlerCreneau(data, igor.id, { date: TODAY, start: 600, end: 720 }, 'rattrapage', TODAY).bloquants.join(' ')).toMatch(/à venir/);
  });

  it('récupération : partir plus tôt raccourcit le poste, une journée entière le retire', () => {
    const poste = data.shifts.filter((s) => s.personId === nicolas.id && s.date > TODAY).sort((a, b) => a.date.localeCompare(b.date))[0];
    const tot = appliquerCreneau(data, nicolas.id, { date: poste.date, start: poste.end - 60, end: poste.end }, 'recuperation');
    expect(tot.forme).toBe('partir_tot');
    expect(tot.data!.shifts.find((s) => s.personId === nicolas.id && s.date === poste.date)!.end).toBe(poste.end - 60);
    const repos = appliquerCreneau(data, nicolas.id, { date: poste.date, start: poste.start, end: poste.end }, 'recuperation');
    expect(repos.forme).toBe('repos');
    expect(repos.data!.shifts.some((s) => s.id === poste.id)).toBe(false);
    const milieu = appliquerCreneau(data, nicolas.id, { date: poste.date, start: poste.start + 60, end: poste.start + 120 }, 'recuperation');
    expect(milieu.data).toBeNull();
  });

  it('propose des récupérations qui ne bloquent rien', () => {
    const liste = proposerCreneaux(data, nicolas.id, 120, 'recuperation', TODAY);
    expect(liste.length).toBeGreaterThan(0);
    for (const c of liste) expect(c.controle.bloquants).toEqual([]);
  });
});
