import { describe, expect, it } from 'vitest';
import { seed } from '../data/seed';
import { addDays, mondayOf } from '../domain/time';
import type { Person } from '../domain/types';
import { GEOMETRIE, documentImpression, heureCourte } from './impression';

const TODAY = '2026-11-18';
const data = seed(TODAY);
const LUNDI = mondayOf(TODAY);
const titulaire = { gestion: true, moi: 'p_helene' };
const equipier = { gestion: false, moi: 'p_camille' };

describe('feuille à imprimer', () => {
  it('une semaine : une page, toute l’équipe, sept jours, les heures de chacun', () => {
    const d = documentImpression(data, { periode: 'semaine', repere: TODAY, ...titulaire });
    expect(d.pages).toHaveLength(1);
    const bloc = d.pages[0].blocs[0];
    expect(bloc.monday).toBe(LUNDI);
    expect(bloc.jours).toHaveLength(7);
    expect(bloc.jours[6].ferme).toBe(true);
    const lignes = bloc.groupes.flatMap((g) => g.lignes);
    const internes = data.personnes.filter((p) => !p.externe);
    expect(lignes.filter((l) => !l.personne.externe)).toHaveLength(internes.length);
    // Les pharmaciens d'abord.
    expect(bloc.groupes[0].titre).toBe('Pharmaciens');
    const nicolas = lignes.find((l) => l.personne.id === 'p_camille')!;
    const attendu = data.shifts.filter((s) => s.personId === 'p_camille' && s.date >= LUNDI && s.date <= addDays(LUNDI, 6)).length;
    expect(nicolas.cases.reduce((t, c) => t + c.postes.length, 0)).toBe(attendu);
    expect(nicolas.minutes).toBeGreaterThan(0);
    expect(d.titre).toMatch(/^Semaine \d+$/);
  });

  it('les lignes d’une semaine remplissent la page sans la dépasser', () => {
    const d = documentImpression(data, { periode: 'semaine', repere: TODAY, ...titulaire });
    const bloc = d.pages[0].blocs[0];
    const hauteur = GEOMETRIE.semaine.tete + bloc.groupes.length * GEOMETRIE.semaine.groupe + bloc.groupes.flatMap((g) => g.lignes).reduce((t, l) => t + l.hauteur, 0);
    expect(hauteur).toBeLessThanOrEqual(GEOMETRIE.utile);
    expect(bloc.groupes[0].lignes[0].hauteur).toBeGreaterThanOrEqual(GEOMETRIE.semaine.ligneMin);
  });

  it('un mois : toutes ses semaines, réparties sur des pages qui ne débordent pas', () => {
    const d = documentImpression(data, { periode: 'mois', repere: '2026-11-18', ...titulaire });
    const blocs = d.pages.flatMap((p) => p.blocs);
    // La semaine du 26 octobre ne touche novembre que par un dimanche fermé : elle n'est pas imprimée.
    expect(blocs.map((b) => b.monday)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
    expect(blocs[4].jours.filter((j) => j.horsMois)).toHaveLength(6);
    for (const p of d.pages) {
      const h = p.blocs.reduce((t, b, i) => t + (i ? GEOMETRIE.mois.ecart : 0) + GEOMETRIE.mois.titre + GEOMETRIE.mois.tete + b.groupes.flatMap((g) => g.lignes).reduce((x, l) => x + l.hauteur, 0), 0);
      expect(h).toBeLessThanOrEqual(GEOMETRIE.utile);
    }
    expect(d.titre).toBe('Novembre 2026');
  });

  it('l’équipe ne voit que ce qui est publié, et l’absence d’un collègue reste « Absent »', () => {
    const brouillon = Object.keys(data.semaines).length ? addDays(LUNDI, 28) : LUNDI;
    const d = documentImpression(data, { periode: 'semaine', repere: brouillon, ...equipier });
    const bloc = d.pages[0].blocs[0];
    if (data.semaines[mondayOf(brouillon)]?.statut !== 'publie') {
      expect(bloc.etat).toBe('non_publie');
      expect(bloc.groupes.flatMap((g) => g.lignes).every((l) => l.cases.every((c) => !c.postes.length))).toBe(true);
    }
    const absence = data.absences.find((a) => a.statut === 'approuvee' && a.type !== 'formation' && a.personId !== 'p_camille')!;
    const vuParEquipe = documentImpression(data, { periode: 'semaine', repere: absence.from, ...equipier }).pages[0].blocs[0];
    const caseEquipe = vuParEquipe.groupes.flatMap((g) => g.lignes).find((l) => l.personne.id === absence.personId)!.cases[vuParEquipe.jours.findIndex((j) => j.date === absence.from)];
    expect(caseEquipe.absence).toBe('Absent');
    const vuParTitulaire = documentImpression(data, { periode: 'semaine', repere: absence.from, ...titulaire }).pages[0].blocs[0];
    const caseTitulaire = vuParTitulaire.groupes.flatMap((g) => g.lignes).find((l) => l.personne.id === absence.personId)!.cases[vuParTitulaire.jours.findIndex((j) => j.date === absence.from)];
    expect(caseTitulaire.absence).not.toBe('Absent');
  });

  it('« mes postes » n’imprime qu’une personne', () => {
    const d = documentImpression(data, { periode: 'semaine', repere: TODAY, ...equipier, seulement: 'p_camille' });
    expect(d.pages[0].blocs[0].groupes.flatMap((g) => g.lignes).map((l) => l.personne.id)).toEqual(['p_camille']);
  });

  it('une très grande équipe passe sur plusieurs pages, sans perdre personne', () => {
    const foule: Person[] = Array.from({ length: 40 }, (_, i) => ({ ...data.personnes[4], id: `x${i}`, prenom: `Personne ${i}` }));
    const grand = { ...data, personnes: data.personnes.concat(foule) };
    const semaine = documentImpression(grand, { periode: 'semaine', repere: TODAY, ...titulaire });
    expect(semaine.pages.length).toBeGreaterThan(1);
    expect(new Set(semaine.pages.flatMap((p) => p.blocs.flatMap((b) => b.groupes.flatMap((g) => g.lignes.map((l) => l.personne.id))))).size).toBe(grand.personnes.filter((p) => !p.externe || grand.shifts.some((s) => s.personId === p.id && s.date >= LUNDI && s.date <= addDays(LUNDI, 6))).length);
    expect(semaine.pages[1].blocs[0].suite).toBe(true);
    const mois = documentImpression(grand, { periode: 'mois', repere: TODAY, ...titulaire });
    for (const p of mois.pages) {
      const h = p.blocs.reduce((t, b, i) => t + (i ? GEOMETRIE.mois.ecart : 0) + GEOMETRIE.mois.titre + GEOMETRIE.mois.tete + b.groupes.flatMap((g) => g.lignes).reduce((x, l) => x + l.hauteur, 0), 0);
      expect(h).toBeLessThanOrEqual(GEOMETRIE.utile);
    }
  });

  it('écrit l’heure au plus court', () => {
    expect(heureCourte(510)).toBe('8h30');
    expect(heureCourte(1140)).toBe('19h');
  });
});
