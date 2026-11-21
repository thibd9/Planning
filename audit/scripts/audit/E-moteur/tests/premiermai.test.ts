import { it } from 'vitest';
import { seed } from '/home/user/releve-planning/src/data/seed';
import { generer } from '/home/user/releve-planning/src/engine/generate';
import { validateWeek } from '/home/user/releve-planning/src/engine/validate';
import { ficheNavette } from '/home/user/releve-planning/src/engine/payroll';
import { rmSync } from 'node:fs';
import { DOSSIER, constat } from './aide';
rmSync(`${DOSSIER}/premiermai.jsonl`, { force: true });
it('1er mai travaillé', () => {
  const d0 = seed('2026-11-20', 2);
  const d = { ...d0, officine: { ...d0.officine, fermeJoursFeries: false } };
  const r = generer(d, '2028-05-01', { variante: 'equite', graine: 7 });
  const dd = { ...d, shifts: d.shifts.concat(r.shifts) };
  const mai = r.shifts.filter((s) => s.date === '2028-05-01');
  const l = validateWeek(dd, '2028-05-01').filter((i) => i.date === '2028-05-01' && i.gravite !== 'info');
  const fn = ficheNavette(dd, '2028-05').filter((x) => mai.some((s) => s.personId === x.person.id)).map((x) => `${x.person.prenom}: ${x.variablesGarde.length} variable(s)`);
  constat('premiermai', { id: 'MAI1', regle: '(1er mai)', scenario: 'Officine réglée « ouverte les jours fériés », semaine du lundi 1er mai 2028', attendu: 'à vérifier : le 1er mai est le seul jour férié chômé de droit (Code du travail) ; un poste ce jour-là appelle au moins une alerte et une majoration en paie', obtenu: `${mai.length} postes le 1er mai ; constats ce jour : ${l.map((i) => i.regle).join(', ') || 'aucun'} ; fiche navette : ${fn.join(', ')}`, ok: l.length > 0 });
});
