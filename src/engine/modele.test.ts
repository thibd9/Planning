import { describe, expect, it } from 'vitest';
import { seed } from '../data/seed';
import { addDays, mondayOf } from '../domain/time';
import type { AppData, Souhait } from '../domain/types';
import { generer } from './generate';

describe('qui prépare le planning', () => {
  const today = '2026-11-18';
  const lundi = addDays(mondayOf(today), 21);
  // Toute l'équipe préfère le repos chaque jour de la semaine : des préférences impossibles à ignorer dans les comptes.
  const avecPreferences = (modele: 'collaboratif' | 'classique'): AppData => {
    const d = seed(today, -99);
    const souhaits: Souhait[] = d.personnes.filter((p) => !p.externe).flatMap((p) => Array.from({ length: 6 }, (_, i) => ({ personId: p.id, date: addDays(lundi, i), choix: 'repos' as const })));
    return { ...d, besoins: [], souhaits, officine: { ...d.officine, modele } };
  };

  it('avec l’équipe : les préférences du mois entrent dans le calcul', () => {
    const r = generer(avecPreferences('collaboratif'), lundi, { variante: 'souhaits', graine: 7, iterations: 600 });
    expect(r.indicateurs.souhaitsTotal).toBeGreaterThan(0);
  });

  it('vous seul : les préférences du mois ne sont pas prises en compte, même s’il en reste', () => {
    const r = generer(avecPreferences('classique'), lundi, { variante: 'souhaits', graine: 7, iterations: 600 });
    expect(r.indicateurs.souhaitsTotal).toBe(0);
    expect(r.indicateurs.souhaits).toBeNull();
  });
});
