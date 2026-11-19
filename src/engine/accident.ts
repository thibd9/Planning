import { addDays, dayIndex, ferie, weekday } from '../domain/time';
import type { Absence, AppData, ISODate } from '../domain/types';

/**
 * Accident du travail ou de trajet. La personne prévient son employeur dans la journée, au plus tard dans les
 * 24 heures ; l'employeur déclare l'accident à la caisse d'assurance maladie dans les 48 heures, dimanches et
 * jours fériés non comptés, à partir du moment où il en a eu connaissance. Solvéa rappelle ce délai : il ne
 * déclare rien lui-même.
 */
export const JOURS_POUR_DECLARER = 2;

const compte = (date: ISODate): boolean => weekday(date) !== 6 && !ferie(date);

/** Dernier jour pour déclarer : deux jours après la connaissance de l'accident, dimanches et jours fériés non comptés. */
export function echeanceDeclaration(connuLe: ISODate): ISODate {
  let jour = connuLe;
  for (let restants = JOURS_POUR_DECLARER; restants > 0; ) {
    jour = addDays(jour, 1);
    if (compte(jour)) restants--;
  }
  return jour;
}

export interface DeclarationAFaire {
  absence: Absence;
  echeance: ISODate;
  /** Jours restants ; 0 : c'est aujourd'hui ; négatif : le délai est dépassé. */
  jours: number;
}

/** Les accidents signalés dont la déclaration n'a pas encore été notée comme faite, du plus pressé au moins pressé. */
export function declarationsAFaire(data: Pick<AppData, 'absences'>, today: ISODate): DeclarationAFaire[] {
  return data.absences
    .filter((a) => a.type === 'accident' && a.statut !== 'refusee' && a.accident && !a.accident.declareLe)
    .map((absence) => {
      const echeance = echeanceDeclaration(absence.accident!.connuLe);
      return { absence, echeance, jours: dayIndex(echeance) - dayIndex(today) };
    })
    .sort((a, b) => a.jours - b.jours);
}

/** « avant ce soir », « avant demain soir », « avant le … » : le délai dit simplement. */
export function delaiDeclaration(jours: number): string {
  if (jours < 0) return `délai dépassé depuis ${-jours} jour${jours < -1 ? 's' : ''}`;
  if (jours === 0) return 'à faire aujourd’hui';
  if (jours === 1) return 'à faire avant demain soir';
  return `encore ${jours} jours`;
}
