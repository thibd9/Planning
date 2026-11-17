import { CalendarRange, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { useMemo } from 'react';
import { JOURS, addDays, fmtHorodatage, fmtSemaine, isoWeek, weekDates, weekday } from '../../domain/time';
import { nomCourt } from '../../domain/types';
import { HEBERGE } from '../../env';
import { ouverture } from '../../engine/core';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Tuile } from '../components/Tuile';
import { EtiquetteRole } from '../icons';
import { Avatar, Empty, Pill } from '../kit';
import { echelleOfficine } from './Construire';

/** Planning publié de toute l'équipe, en lecture seule : ni brouillon, ni coût, ni motif d'absence. */
export function PlanningEquipe({ personId }: { personId: string }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { semaine, setSemaine } = useUi();
  const etat = data.semaines[semaine];
  const publie = etat?.statut === 'publie';
  const postes = publie ? (etat.snapshot ?? []) : [];
  const dates = useMemo(() => weekDates(semaine).filter((d) => ouverture(data.officine, d).length > 0), [semaine, data.officine]);
  const echelle = echelleOfficine(data);
  const personnes = data.personnes.filter((p) => !p.externe || postes.some((s) => s.personId === p.id));

  return (
    <div>
      <div className="page-head">
        <span className="page-ico c-jaune" aria-hidden="true">
          <CalendarRange size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Planning de l’équipe</div>
          <h1>
            Qui travaille <span className="hl">quand</span> ?
          </h1>
          <p>Le planning officiel, tel que le responsable l’a publié. Vous ne pouvez pas le modifier ici : passez par une demande depuis « Mon planning ».</p>
        </div>
        {!HEBERGE && publie ? (
          <button type="button" className="btn no-print" onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" /> Imprimer
          </button>
        ) : null}
      </div>

      <div className="plan">
        <div className="plan-bar">
          <div className="week-nav">
            <button type="button" className="btn ghost icon no-print" onClick={() => setSemaine(addDays(semaine, -7))} aria-label="Semaine précédente">
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="btn ghost icon no-print" onClick={() => setSemaine(addDays(semaine, 7))} aria-label="Semaine suivante">
              <ChevronRight size={18} />
            </button>
            <div className="label" aria-live="polite">
              {fmtSemaine(semaine)}
              <small>Semaine {isoWeek(semaine)}</small>
            </div>
          </div>
          {publie ? <Pill tone="ok">Publié le {fmtHorodatage(etat.publishedAt ?? '')}</Pill> : <Pill>Pas encore publié</Pill>}
        </div>
        {publie ? (
          <div className="plan-scroll">
            <table className="t lecture" aria-label={`Planning de l'équipe, semaine du ${fmtSemaine(semaine)}`}>
              <thead>
                <tr>
                  <th scope="col">Équipe</th>
                  {dates.map((d) => (
                    <th key={d} scope="col" aria-current={d === today ? 'date' : undefined}>
                      {JOURS[weekday(d)]} {Number(d.slice(8))}
                      {d === today ? <span className="sr"> (aujourd’hui)</span> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {personnes.map((p) => (
                  <tr key={p.id} className={p.id === personId ? 'moi' : undefined}>
                    <th scope="row">
                      <span className="row" style={{ gap: 10 }}>
                        <Avatar person={p} />
                        <span>
                          <span className="nm">
                            {nomCourt(p)}
                            {p.id === personId ? ' (vous)' : ''}
                          </span>
                          <span style={{ display: 'block', marginTop: 3 }}>
                            <EtiquetteRole person={p} />
                          </span>
                        </span>
                      </span>
                    </th>
                    {dates.map((d) => {
                      const duJour = postes.filter((s) => s.personId === p.id && s.date === d).sort((a, b) => a.start - b.start);
                      const absent = data.absences.some((a) => a.personId === p.id && a.statut === 'approuvee' && a.from <= d && d <= a.to);
                      return (
                        <td key={d}>
                          {duJour.length ? (
                            <span className="col" style={{ gap: 4 }}>
                              {duJour.map((s) => (
                                <Tuile key={s.id} data={data} s={s} person={p} echelle={echelle} />
                              ))}
                            </span>
                          ) : (
                            <span className="muted small">{absent ? 'Absent' : 'Repos'}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<CalendarRange size={30} />} title="Cette semaine n’est pas encore publiée">
            Le responsable prépare encore ce planning. Il apparaîtra ici dès sa publication.
          </Empty>
        )}
      </div>
    </div>
  );
}
