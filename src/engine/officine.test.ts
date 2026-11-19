import { describe, expect, it } from 'vitest';
import { chiffresOfficine, remarquesOfficine } from './officine';

describe("l'officine en chiffres", () => {
  it('décrit ce qui est renseigné, et rien de plus', () => {
    expect(chiffresOfficine({})).toEqual([]);
    expect(chiffresOfficine({ surface: 180, infos: { surfaceVente: 110, caisses: 1, comptoirs: 4, robot: true } })).toEqual([
      '180 m² au total',
      '110 m² de surface de vente',
      '1 caisse',
      '4 postes de comptoir',
      'un robot de dispensation',
    ]);
  });

  it('remarque ce qui ne colle pas, sans rien bloquer', () => {
    expect(remarquesOfficine({ surface: 180, infos: { surfaceVente: 110, reserve: 45, caisses: 3, comptoirs: 4 }, effectifs: [] })).toEqual([]);
    expect(remarquesOfficine({ surface: 100, infos: { surfaceVente: 120 }, effectifs: [] })[0]).toMatch(/dépasse la surface totale/);
    expect(remarquesOfficine({ surface: 100, infos: { surfaceVente: 70, reserve: 50 }, effectifs: [] })[0]).toMatch(/dépassent ensemble/);
    expect(remarquesOfficine({ infos: { caisses: 5, comptoirs: 3 }, effectifs: [] })[0]).toMatch(/plus de caisses/);
    expect(remarquesOfficine({ infos: { comptoirs: 2 }, effectifs: [{ jours: [0], start: 510, end: 1170, minEquipe: 3 }] })[0]).toMatch(/jusqu’à 3 personnes/);
  });
});
