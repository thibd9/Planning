import { describe, expect, it } from 'vitest';
import type { Interval, Person } from '../domain/types';
import { HYPOTHESES, dimensionnement } from './dimensionnement';

const jour: Interval[] = [{ start: 8 * 60 + 30, end: 19 * 60 + 30 }];
/** Ouverte du lundi au samedi, onze heures par jour : 66 heures par semaine. */
const horaires: Interval[][] = [jour, jour, jour, jour, jour, jour, []];
const personne = (id: string, qualification: Person['qualification'], heuresHebdo: number): Person => ({ id, prenom: id, nom: 'T', qualification, heuresHebdo }) as Person;
const equipe = [personne('t1', 'titulaire', 42), personne('a1', 'adjoint', 35), personne('p1', 'preparateur', 35), personne('p2', 'preparateur', 35), personne('p3', 'preparateur', 24)];

describe("dimensionnement de l'équipe", () => {
  it('ne dit rien sans mesure de l’activité', () => {
    const d = dimensionnement({ horaires, effectifs: [], infos: { caisses: 6 } }, equipe);
    expect(d.source).toBe('aucune');
    expect(d.remarques[0]).toMatch(/clients servis par jour/);
    expect(d.heuresOuverture).toBe(66);
  });

  it('part des clients à servir, pas du nombre de caisses', () => {
    // 220 clients par jour sur 11 heures : 20 par heure, 5 minutes chacun, soit 100 minutes de service par heure.
    const d = dimensionnement({ horaires, effectifs: [], infos: { passagesJour: 220, caisses: 6, comptoirs: 6 } }, equipe);
    expect(d.source).toBe('passages');
    expect(d.comptoir.ordinaire).toBe(2);
    expect(d.comptoir.pointe).toBe(4);
    expect(d.comptoir.plafond).toBe(7);
    // Six caisses ne demandent pas six personnes : c'est dit.
    expect(d.remarques.some((r) => /6 caisses, mais 4 personnes/.test(r))).toBe(true);
    // Le même volume avec deux caisses seulement donne le même besoin : les caisses ne le créent pas.
    const peu = dimensionnement({ horaires, effectifs: [], infos: { passagesJour: 220, caisses: 4, comptoirs: 4 } }, equipe);
    expect(peu.equipe.besoin).toBe(d.equipe.besoin);
  });

  it('plafonne au nombre de postes où l’on sert, et le signale', () => {
    const d = dimensionnement({ horaires, effectifs: [], infos: { passagesJour: 600, comptoirs: 3 } }, equipe);
    expect(d.comptoir.pointe).toBe(4);
    expect(d.remarques.some((r) => /faute de place, pas faute de personnel/.test(r))).toBe(true);
  });

  it('un robot réduit le temps par client et le travail hors comptoir', () => {
    const sans = dimensionnement({ horaires, effectifs: [], infos: { passagesJour: 300 } }, equipe);
    const avec = dimensionnement({ horaires, effectifs: [], infos: { passagesJour: 300, robot: true } }, equipe);
    expect(avec.minutesParClient).toBe(HYPOTHESES.minutesParClientRobot);
    expect(avec.equipe.besoin).toBeLessThan(sans.equipe.besoin);
  });

  it('compte les pharmaciens d’après les heures d’ouverture, absences comprises', () => {
    const d = dimensionnement({ horaires, effectifs: [], infos: { passagesJour: 220 } }, equipe);
    // 66 heures à couvrir, 12 % d'absences, sur une base de 35 heures : 2,1 équivalents temps plein.
    expect(d.pharmaciens.besoin).toBeCloseTo(2.1, 1);
    expect(d.pharmaciens.dispo).toBeCloseTo(2.2, 1);
    expect(d.pharmaciens.verdict).toBe('bon');
    const seul = dimensionnement({ horaires, effectifs: [], infos: { passagesJour: 220 } }, equipe.filter((p) => p.id !== 'a1'));
    expect(seul.pharmaciens.verdict).toBe('manque');
  });

  it('rappelle la règle du nombre de pharmaciens selon l’activité annuelle', () => {
    const sous = dimensionnement({ horaires, effectifs: [], infos: { activiteAnnuelle: 1_200_000 } }, equipe);
    expect(sous.pharmaciens.adjointsRequis).toBe(0);
    const deux = dimensionnement({ horaires, effectifs: [], infos: { activiteAnnuelle: 2_700_000 } }, equipe);
    expect(deux.pharmaciens.adjointsRequis).toBe(2);
    expect(deux.pharmaciens.adjointsCouverts).toBe(1);
    expect(deux.remarques.some((r) => /au moins 2 pharmaciens en équivalent temps plein, en plus du titulaire/.test(r))).toBe(true);
    // Un titulaire associé à temps plein peut tenir lieu d'adjoint.
    const associes = dimensionnement({ horaires, effectifs: [], infos: { activiteAnnuelle: 2_700_000 } }, [...equipe, personne('t2', 'titulaire', 35)]);
    expect(associes.pharmaciens.adjointsCouverts).toBe(2);
  });

  it('compare l’effectif attendu réglé par le titulaire au repère', () => {
    const d = dimensionnement({ horaires, effectifs: [{ jours: [0, 1, 2, 3, 4], start: 510, end: 1170, minEquipe: 1 }, { jours: [5], start: 510, end: 1170, minEquipe: 9 }], infos: { passagesJour: 220, comptoirs: 4 } }, equipe);
    expect(d.ecarts).toHaveLength(2);
    expect(d.ecarts[0]).toMatchObject({ sens: 'bas', repere: 2 });
    expect(d.ecarts[1]).toMatchObject({ sens: 'haut', repere: 5 });
  });

  it('à défaut de clients comptés, s’appuie sur la surface de vente et le dit', () => {
    const d = dimensionnement({ horaires, effectifs: [], infos: { surfaceVente: 110 } }, equipe);
    expect(d.source).toBe('surface');
    expect(d.comptoir.ordinaire).toBe(3);
    expect(d.remarques.some((r) => /grossière/.test(r))).toBe(true);
  });
});
