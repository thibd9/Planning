import { CalendarRange } from 'lucide-react';
import { useMemo } from 'react';
import { MOIS_COURT, addDays, dayIndex, ferie, fmtDateCourt, mondayOf } from '../../domain/time';
import type { Absence, AppData, ISODate } from '../../domain/types';
import { classeAbsence, libelleAbsence, nomCourt } from '../../domain/types';
import { Avatar } from '../kit';

/**
 * Les absences de toute l'équipe sur les semaines à venir : une ligne par personne, une barre par absence.
 * Les demandes en attente sont en pointillés. `discret` : pour l'équipe, ni nature de l'absence ni demande en attente.
 */
export function FriseConges({ data, today, semaines = 10, discret = false, surligner }: { data: Pick<AppData, 'absences' | 'personnes'>; today: ISODate; semaines?: number; discret?: boolean; surligner?: string }): JSX.Element | null {
  const debut = mondayOf(today);
  const jours = semaines * 7;
  const fin = addDays(debut, jours - 1);
  const lignes = useMemo(() => {
    const visibles = data.absences.filter((a) => a.statut !== 'refusee' && (!discret || a.statut === 'approuvee') && a.to >= debut && a.from <= fin);
    return data.personnes
      .filter((p) => !p.externe)
      .map((p) => ({ p, absences: visibles.filter((a) => a.personId === p.id).sort((a, b) => a.from.localeCompare(b.from)) }))
      .filter((l) => l.absences.length);
  }, [data.absences, data.personnes, debut, fin, discret]);
  if (!lignes.length) return null;
  const lundis = Array.from({ length: semaines }, (_, i) => addDays(debut, i * 7));
  const colonne = (date: ISODate): number => Math.max(0, Math.min(jours - 1, dayIndex(date) - dayIndex(debut)));
  const aujourdhui = colonne(today);
  const feries = Array.from({ length: jours }, (_, i) => addDays(debut, i)).filter((d) => ferie(d));
  const dire = (a: Absence): string => {
    const quoi = discret ? 'Absent' : libelleAbsence(a);
    const quand = a.from === a.to ? `le ${fmtDateCourt(a.from)}` : `du ${fmtDateCourt(a.from)} au ${fmtDateCourt(a.to)}`;
    return `${quoi} ${quand}${a.statut === 'demandee' ? ', demande en attente' : ''}`;
  };
  const sans = data.personnes.filter((p) => !p.externe).length - lignes.length;
  return (
    <section className="card fc" aria-labelledby="fc-titre" data-focus="frise-conges">
      <div className="card-head">
        <span className="fc-ico" aria-hidden="true">
          <CalendarRange size={18} />
        </span>
        <div className="grow">
          <h2 className="h3" id="fc-titre">
            Absences de l’équipe
          </h2>
          <p className="small soft" style={{ margin: 0 }}>
            Les {semaines} prochaines semaines, une ligne par personne.{discret ? '' : ' En pointillés : une demande qui attend votre réponse.'}
          </p>
        </div>
        {!discret ? (
          <ul className="fc-legende" aria-hidden="true">
            <li>
              <i className="fc-barre conge" /> Congé
            </li>
            <li>
              <i className="fc-barre arret" /> Arrêt
            </li>
            <li>
              <i className="fc-barre formation" /> Formation
            </li>
            <li>
              <i className="fc-barre conge attente" /> En attente
            </li>
          </ul>
        ) : null}
      </div>
      <div className="fc-zone" tabIndex={0} role="group" aria-label="Frise des absences, à faire défiler">
        <div className="fc-grille" style={{ ['--fc-jours' as string]: jours }}>
          <div className="fc-tete" aria-hidden="true">
            <span className="fc-qui" />
            <div className="fc-semaines">
              {lundis.map((l, i) => (
                <span key={l} className="fc-semaine">
                  {i === 0 || l.slice(8) <= '07' ? <b>{MOIS_COURT[Number(l.slice(5, 7)) - 1]}</b> : null} {Number(l.slice(8))}
                </span>
              ))}
            </div>
          </div>
          {lignes.map(({ p, absences }) => (
            <div key={p.id} className={`fc-ligne${surligner === p.id ? ' moi' : ''}`}>
              <span className="fc-qui">
                <Avatar person={p} /> <span className="fc-nom">{nomCourt(p)}</span>
              </span>
              <div className="fc-piste">
                <i className="fc-auj" style={{ gridColumn: `${aujourdhui + 1} / span 1` }} aria-hidden="true" />
                {feries.map((d) => (
                  <i key={d} className="fc-ferie" style={{ gridColumn: `${colonne(d) + 1} / span 1` }} title={`Férié : ${ferie(d)}`} aria-hidden="true" />
                ))}
                {absences.map((a) => {
                  const de = colonne(a.from < debut ? debut : a.from);
                  const a2 = colonne(a.to > fin ? fin : a.to);
                  const large = a2 - de + 1;
                  return (
                    <span key={a.id} className={`fc-barre ${discret ? 'absence' : classeAbsence(a.type)}${a.statut === 'demandee' ? ' attente' : ''}`} style={{ gridColumn: `${de + 1} / span ${large}` }} title={dire(a)}>
                      {large >= 4 ? <span aria-hidden="true">{discret ? 'Absent' : a.statut === 'demandee' ? 'Demandé' : libelleAbsence(a).split(' · ')[0]}</span> : null}
                      <span className="sr">{dire(a)}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      {sans > 0 ? <p className="tiny muted fc-note">{sans} personne{sans > 1 ? 's' : ''} sans absence prévue sur la période.</p> : null}
    </section>
  );
}
