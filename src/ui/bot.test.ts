import { describe, expect, it } from 'vitest';
import { seed } from '../data/seed';
import { addDays } from '../domain/time';
import { planifieMois } from '../engine/souhaits';
import { chercher, fichesPour, jourDe, repondre } from './bot';

const TODAY = '2026-11-18'; // un mercredi

describe('assistant : comprendre le jour demandé', () => {
  it('lit aujourd’hui, demain, après-demain et un jour de la semaine', () => {
    expect(jourDe('Qui travaille ?', TODAY)).toBe(TODAY);
    expect(jourDe('Qui travaille demain ?', TODAY)).toBe(addDays(TODAY, 1));
    expect(jourDe('et après-demain ?', TODAY)).toBe(addDays(TODAY, 2));
    expect(jourDe('Qui est là samedi ?', TODAY)).toBe('2026-11-21');
    // Le jour nommé est toujours à venir : « mardi » un mercredi, c'est mardi prochain.
    expect(jourDe('qui ouvre mardi', TODAY)).toBe('2026-11-24');
  });
});

describe('assistant : répondre d’après le planning', () => {
  const data = seed(TODAY);
  const titulaire = { data, today: TODAY, moi: 'p_helene', espace: 'responsable' as const, fiches: fichesPour('responsable', true) };
  const camille = { data, today: TODAY, moi: 'p_camille', espace: 'equipe' as const, fiches: fichesPour('equipe', true) };

  it('liste les personnes en poste un jour donné, avec leurs horaires', () => {
    const r = repondre('Qui travaille demain ?', titulaire);
    const attendus = new Set(data.shifts.filter((s) => s.date === addDays(TODAY, 1)).map((s) => s.personId));
    expect(attendus.size).toBeGreaterThan(0);
    expect(r.lignes).toHaveLength(attendus.size);
    expect(r.texte).toContain(`${attendus.size} personne`);
    expect(r.lignes?.every((l) => /\d+ h/.test(l))).toBe(true);
    expect(r.bouton?.label).toBe('Voir la journée');
  });

  it('donne à un membre de l’équipe son prochain poste publié, jamais un brouillon', () => {
    const r = repondre('Mon prochain poste ?', camille);
    expect(r.texte).toMatch(/^Votre prochain poste/);
    const sansPublication = { ...camille, data: { ...data, semaines: {} } };
    expect(repondre('Mon prochain poste ?', sansPublication).texte).toBe('Aucun poste publié à venir pour vous.');
  });

  it('ne montre les décisions en attente qu’au titulaire', () => {
    expect(repondre('Que dois-je décider ?', titulaire).texte).toMatch(/décision|Rien n’attend/);
    expect(repondre('Que dois-je décider ?', camille).texte).not.toMatch(/décision/);
  });

  it('retombe sur une fiche d’aide, puis sur des suggestions quand rien ne correspond', () => {
    const r = repondre('comment me faire remplacer', camille);
    expect(r.bouton?.label).toBe('Demander un remplacement');
    const inconnu = repondre('xyzzy', camille);
    expect(inconnu.texte).toMatch(/pas trouvé/);
    expect(inconnu.suites?.length).toBeGreaterThan(0);
  });

  it('réserve les fiches personnelles à l’équipe', () => {
    expect(fichesPour('responsable', true).some((f) => f.id === 'remplacer')).toBe(false);
    expect(fichesPour('equipe', true).some((f) => f.id === 'remplacer')).toBe(true);
    expect(fichesPour('equipe', false).some((f) => f.id === 'souhaits')).toBe(false);
    expect(chercher(fichesPour('equipe', true), 'poser un congé')[0]?.id).toBe('conge');
  });
});

describe('vue mois : heures planifiées face au contrat', () => {
  it('ne compte le contrat que sur les semaines construites et déduit les absences', () => {
    const data = seed(TODAY);
    const camille = data.personnes.find((p) => p.id === 'p_camille')!;
    const h = planifieMois(data, camille, '2026-11');
    expect(h.construit).toBe(true);
    expect(h.minutes).toBe(data.shifts.filter((s) => s.personId === 'p_camille' && s.date.startsWith('2026-11')).reduce((t, s) => t + s.end - s.start - ((s.pauseEnd ?? 0) - (s.pauseStart ?? 0)), 0));
    expect(h.cible).toBeGreaterThan(0);
    expect(h.cible).toBeLessThanOrEqual(camille.heuresHebdo * 60 * 5);
    // Un mois sans aucun planning : rien n'est dû, donc aucun « retard » affiché.
    const vide = planifieMois({ ...data, shifts: [] }, camille, '2026-11');
    expect(vide).toEqual({ minutes: 0, cible: 0, construit: false });
    // Une semaine d'absence approuvée réduit la cible d'autant.
    const absente = planifieMois({ ...data, absences: data.absences.concat({ id: 'a_test', personId: 'p_camille', from: '2026-11-09', to: '2026-11-13', type: 'conge', statut: 'approuvee', createdAt: '2026-11-01T08:00:00.000Z' }) }, camille, '2026-11');
    expect(h.cible - absente.cible).toBe(camille.heuresHebdo * 60);
  });
});
