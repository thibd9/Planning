import { appendFileSync, mkdirSync } from 'node:fs';
import { vierge } from '/home/user/releve-planning/src/data/seed';
import type { AppData, Person, Shift } from '/home/user/releve-planning/src/domain/types';

export const DOSSIER = '/tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad/audit/E-moteur/journaux';
mkdirSync(DOSSIER, { recursive: true });

/** Consigne un constat : une ligne JSON par vérification, relue pour rédiger le rapport. */
export function constat(fichier: string, c: { id: string; regle: string; scenario: string; attendu: string; obtenu: string; ok: boolean; note?: string }): void {
  appendFileSync(`${DOSSIER}/${fichier}.jsonl`, JSON.stringify(c) + '\n');
  // eslint-disable-next-line no-console
  console.log(`${c.ok ? 'OK ' : 'KO '} [${c.id}] ${c.regle} | ${c.scenario} | attendu: ${c.attendu} | obtenu: ${c.obtenu}${c.note ? ' | ' + c.note : ''}`);
}

export const H = (h: number, m = 0): number => h * 60 + m;

export const personne = (id: string, qualification: Person['qualification'], heuresHebdo: number, extra: Partial<Person> = {}): Person => ({
  id,
  prenom: id.toUpperCase(),
  nom: 'Test',
  qualification,
  salarie: qualification !== 'titulaire',
  heuresHebdo,
  tauxHoraire: 10,
  competences: [],
  volontaireHeuresComp: false,
  volontaireGardes: false,
  ...extra,
});

let n = 0;
export const poste = (personId: string, date: string, start: number, end: number, extra: Partial<Shift> = {}): Shift => ({
  id: `t${++n}_${personId}_${date}_${start}`,
  personId,
  date,
  start,
  end,
  activite: 'comptoir',
  origine: 'manuel',
  ...extra,
});

/** Une officine vierge (horaires et postes de l'exemple), avec les personnes données. */
export function base(personnes: Person[], shifts: Shift[] = [], extra: Partial<AppData> = {}): AppData {
  const v = vierge();
  return { ...v, personnes, shifts, ...extra };
}
