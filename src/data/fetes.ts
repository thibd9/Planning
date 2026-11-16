import { addDays, joursFeries } from '../domain/time';
import type { ISODate } from '../domain/types';

export interface Repere {
  date: ISODate;
  nom: string;
  /** Date dépendant d'une observation ou d'un calendrier local : à vérifier. */
  indicative?: boolean;
}

/**
 * Repères de calendrier, toutes traditions confondues, pour aider un salarié à choisir une date.
 * Ce fichier ne sert qu'à préremplir un champ « date » : le repère choisi n'est jamais enregistré.
 */
const REPERES: Repere[] = [
  { date: '2026-12-05', nom: 'Hanoukka (du 4 au soir au 12 décembre)' },
  { date: '2026-12-25', nom: 'Noël' },
  { date: '2027-01-06', nom: 'Épiphanie' },
  { date: '2027-01-07', nom: 'Noël orthodoxe' },
  { date: '2027-02-06', nom: 'Nouvel An lunaire' },
  { date: '2027-02-08', nom: 'Début du ramadan', indicative: true },
  { date: '2027-03-10', nom: 'Aïd el-Fitr', indicative: true },
  { date: '2027-03-22', nom: 'Holi', indicative: true },
  { date: '2027-03-26', nom: 'Vendredi saint' },
  { date: '2027-03-28', nom: 'Pâques' },
  { date: '2027-04-14', nom: 'Vaisakhi', indicative: true },
  { date: '2027-04-22', nom: 'Pessa’h (du 21 au soir au 29 avril)' },
  { date: '2027-05-02', nom: 'Pâques orthodoxe' },
  { date: '2027-05-06', nom: 'Ascension' },
  { date: '2027-05-16', nom: 'Pentecôte' },
  { date: '2027-05-17', nom: 'Aïd el-Adha', indicative: true },
  { date: '2027-05-20', nom: 'Vesak', indicative: true },
  { date: '2027-06-11', nom: 'Chavouot (du 10 au soir au 12 juin)' },
  { date: '2027-08-15', nom: 'Assomption' },
  { date: '2027-10-02', nom: 'Roch Hachana (du 1er au soir au 3 octobre)' },
  { date: '2027-10-11', nom: 'Yom Kippour (dès le 10 au soir)' },
  { date: '2027-10-29', nom: 'Diwali', indicative: true },
  { date: '2027-11-01', nom: 'Toussaint' },
  { date: '2027-12-25', nom: 'Noël' },
];

/** Repères à venir sur les treize prochains mois, jours fériés légaux compris. */
export function reperesAVenir(today: ISODate): Repere[] {
  const limite = addDays(today, 400);
  const annee = Number(today.slice(0, 4));
  const feries: Repere[] = [annee, annee + 1].flatMap((y) => [...joursFeries(y).entries()].map(([date, nom]) => ({ date, nom: `${nom} (jour férié)` })));
  const vus = new Set<string>();
  return [...REPERES, ...feries]
    .filter((r) => r.date >= today && r.date <= limite)
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((r) => {
      const cle = `${r.date}|${r.nom.replace(' (jour férié)', '')}`;
      if (vus.has(cle)) return false;
      vus.add(cle);
      return !REPERES.some((x) => x.date === r.date && r.nom.endsWith('(jour férié)') && x.nom === r.nom.replace(' (jour férié)', ''));
    });
}
