import { describe, expect, it } from 'vitest';
import { seed } from '../data/seed';
import type { AppData, RendezVous } from '../domain/types';
import { segmentsTravail } from './core';
import { avisRdv, proposerRdv, rdvARepondre, rdvAVenir, rdvFixes } from './rdv';

const TODAY = '2026-11-18';
const data = seed(TODAY, 2);
const caroline = data.personnes.find((p) => p.prenom === 'Caroline')!;
const sarah = data.personnes.find((p) => p.prenom === 'Sarah')!;
const rdv = (patch: Partial<RendezVous>): RendezVous => ({ id: 'r1', de: sarah.id, avec: caroline.id, sujet: 'Bilan d’animation', date: '2026-11-24', start: 840, end: 870, statut: 'propose', attend: caroline.id, at: '2026-11-18T09:00:00.000Z', ...patch });

describe('rendez-vous', () => {
  it('propose des moments où les deux sont en poste, un par jour', () => {
    const liste = proposerRdv(data, sarah.id, caroline.id, 30, TODAY);
    expect(liste.length).toBeGreaterThan(0);
    expect(new Set(liste.map((c) => c.date)).size).toBe(liste.length);
    for (const c of liste) {
      for (const id of [sarah.id, caroline.id]) {
        const segments = data.shifts.filter((s) => s.personId === id && s.date === c.date).flatMap(segmentsTravail);
        expect(segments.some((s) => s.start <= c.start && c.end <= s.end)).toBe(true);
      }
      expect(avisRdv(data, { de: sarah.id, avec: caroline.id, ...c }, TODAY)).toEqual({ bloquants: [], infos: [] });
    }
  });

  it('refuse un jour passé, soi-même, et un moment déjà pris par un autre rendez-vous', () => {
    expect(avisRdv(data, rdv({ date: '2026-11-10' }), TODAY).bloquants.join(' ')).toMatch(/à venir/);
    expect(avisRdv(data, rdv({ avec: sarah.id }), TODAY).bloquants.join(' ')).toMatch(/autre personne/);
    const avec: AppData = { ...data, rendezVous: [rdv({ id: 'pris', statut: 'fixe' })] };
    expect(avisRdv(avec, rdv({ id: 'neuf', start: 855, end: 885 }), TODAY).bloquants.join(' ')).toMatch(/déjà un rendez-vous/);
    expect(avisRdv(avec, rdv({ id: 'pris', start: 855, end: 885 }), TODAY).bloquants).toEqual([]);
  });

  it('range les rendez-vous : à venir, fixés, à répondre', () => {
    const avec: AppData = { ...data, rendezVous: [rdv({}), rdv({ id: 'r2', statut: 'fixe', date: '2026-11-26' }), rdv({ id: 'r3', statut: 'decline' })] };
    expect(rdvAVenir(avec, sarah.id, TODAY).map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(rdvFixes(avec, caroline.id, '2026-11-26').map((r) => r.id)).toEqual(['r2']);
    expect(rdvARepondre(avec, caroline.id, TODAY).map((r) => r.id)).toEqual(['r1']);
    expect(rdvARepondre(avec, sarah.id, TODAY)).toEqual([]);
  });
});
