const { ouvrir } = require('../lib');
(async () => {
  const o = await ouvrir({ role: 3 });
  const d = await o.data();
  const fmt = (s) => `${s.date} ${Math.floor(s.start/60)}:${String(s.start%60).padStart(2,'0')}-${Math.floor(s.end/60)}:${String(s.end%60).padStart(2,'0')}`;
  const out = [];
  out.push('semaines: ' + Object.entries(d.semaines).filter(([k]) => k >= '2026-11-01').map(([k, v]) => `${k}:${v.statut}:${(v.snapshot||[]).length}`).join(' | '));
  for (const id of ['p_karim','p_lea','p_camille','p_sarah','p_manon','p_yanis']) {
    const sh = d.shifts.filter(s => s.personId === id && s.date >= '2026-11-16' && s.date <= '2026-12-06').sort((a,b)=>a.date.localeCompare(b.date));
    const sn = Object.values(d.semaines).flatMap(v => v.snapshot||[]).filter(s => s.personId === id && s.date >= '2026-11-16' && s.date <= '2026-12-06').sort((a,b)=>a.date.localeCompare(b.date));
    out.push(`${id} shifts: ${sh.map(fmt).join(', ')}`);
    out.push(`${id} snap  : ${sn.map(fmt).join(', ')}`);
  }
  out.push('remplacements: ' + JSON.stringify(d.remplacements.map(r => ({...r, creeLe: undefined}))));
  out.push('trous: ' + d.trous.map(t => t.statut + ' ' + t.shift.personId + ' ' + fmt(t.shift)).join(' | '));
  out.push('absences: ' + JSON.stringify(d.absences));
  out.push('besoins: ' + JSON.stringify(d.besoins.map(b => [b.personId, b.forme, b.jours, b.statut, b.decision])));
  out.push('gardes: ' + JSON.stringify(d.gardes.map(g => [g.date, g.type, g.personId])));
  out.push('missions: ' + JSON.stringify(d.missions.map(g => [g.date, g.type, g.personId])));
  out.push('officine.modele ' + d.officine.modele + ' souhaitsLimite ' + d.officine.souhaitsLimite);
  out.push('souhaits par personne: ' + JSON.stringify(Object.entries((d.souhaits||[]).reduce((a,s)=>{a[s.personId+' '+s.date.slice(0,7)]=(a[s.personId+' '+s.date.slice(0,7)]||0)+1;return a;},{}))));
  out.push('messages: ' + JSON.stringify(d.messages));
  out.push('notifications: ' + JSON.stringify(d.notifications));
  out.push('personnes: ' + d.personnes.map(p => `${p.id} ${p.identifiant} ${p.qualification} ${p.heuresHebdo} prov=${p.provisoire}`).join(' | '));
  out.push('keys: ' + Object.keys(d).join(','));
  o.ecrire('sonde.txt', out.join('\n'));
  console.log(out.join('\n').slice(0, 9000));
  console.log('ERR', o.errs);
  await o.b.close();
})();
