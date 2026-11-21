import { it } from 'vitest';
import { mondayOf } from '/home/user/releve-planning/src/domain/time';
import { optionsReparation } from '/home/user/releve-planning/src/engine/repair';
import { useStore } from '/home/user/releve-planning/src/store/store';
import { H } from './aide';
const s = () => useStore.getState();
it('pu4', () => {
  s().chargerExemple(true); s().setActeur('p_helene');
  const d = s().data;
  for (const t of d.trous.filter((x) => x.statut === 'ouvert')) {
    const opts = optionsReparation(d, t.shift, s().today).options;
    console.log(t.shift.date, t.shift.start/60, t.shift.end/60, opts.map(o => `${o.type}:${o.titre} retirer=${o.patch.retirer.map(id => { const x = d.shifts.find(y => y.id === id); return x ? x.personId + ' ' + x.start/60 + '-' + x.end/60 : id; }).join(',')} ajouter=${o.patch.ajouter.map(x => x.personId + ' ' + x.start/60 + '-' + x.end/60).join(',')}`).join(' || '));
  }
  const t = d.trous.find(x => x.shift.date === '2026-11-19')!;
  s().saveShift({ id: 'brouillon_admin', personId: 'p_antoine', date: t.shift.date, start: H(20), end: H(20, 30), activite: 'admin', origine: 'manuel' });
  const o = optionsReparation(s().data, t.shift, s().today).options.find(x => x.titre.includes('Pierre'))!;
  console.log('option', o.titre, 'retirer', o.patch.retirer);
  s().resoudreTrou(t.id, o);
  console.log('apres', s().data.shifts.filter(x => x.personId === 'p_antoine' && x.date === t.shift.date).map(x => `${x.id} ${x.start/60}-${x.end/60} ${x.activite}`));
  console.log('snapshot', (s().data.semaines[mondayOf(t.shift.date)].snapshot ?? []).filter(x => x.personId === 'p_antoine' && x.date === t.shift.date).map(x => `${x.id} ${x.start/60}-${x.end/60} ${x.activite}`));
});
