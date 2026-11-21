import { it } from 'vitest';
import { seed } from '/home/user/releve-planning/src/data/seed';
import { generer } from '/home/user/releve-planning/src/engine/generate';
import { validateWeek } from '/home/user/releve-planning/src/engine/validate';
import { addDays } from '/home/user/releve-planning/src/domain/time';
import type { AppData } from '/home/user/releve-planning/src/domain/types';
import { H } from './aide';
it('x4', () => {
  const d0 = seed('2026-11-20', 2);
  const officine = { ...d0.officine, horaires: d0.officine.horaires.map((h, i) => (i === 6 ? [{ start: H(9), end: H(19) }] : h)), postes: d0.officine.postes.concat([
  { id: 'dim-matin', label: 'Dimanche matin', start: H(9), end: H(13), jours: [6] },
  { id: 'dim-aprem', label: 'Dimanche après-midi', start: H(14), end: H(19), jours: [6] }]), effectifs: d0.officine.effectifs.concat({ jours: [6], start: H(9), end: H(19), minEquipe: 2 }) };
  let d: AppData = { ...d0, officine };
  for (const m of ['2026-12-07']) {
    const r = generer(d, m, { variante: 'equite', graine: 7 });
    d = { ...d, shifts: d.shifts.filter((s) => s.date < m || s.date > addDays(m, 6)).concat(r.shifts) };
    console.log(validateWeek(d, m).filter(i => i.gravite !== 'info').map(i => i.gravite + ' ' + i.message).join('\n'));
    console.log(r.shifts.filter(s => s.date === '2026-12-13').map(s => `${s.personId} ${s.start/60}-${s.end/60}`).join(', '));
    console.log(r.blocages.map(b => b.cas + ' ' + b.titre + ' ' + b.message).join('\n'));
  }
});
