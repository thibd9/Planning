import { phrasePauses } from '../../engine/pauses';
import { Coffee, Sun, Sunset } from 'lucide-react';
import type { ReactNode } from 'react';
import { addDays, fmtDateCourt, fmtDuree, fmtHeure, todayISO } from '../../domain/time';
import type { ISODate, Shift } from '../../domain/types';
import { minutesTravail } from '../../engine/core';
import { MOMENT_LABEL, momentDe } from '../kit';

/** Le prochain poste, écrit en grand : c'est la première question de chacun en ouvrant l'application. */
export function ProchainPoste({ postes, today, action }: { postes: Shift[]; today: ISODate; action?: ReactNode }): JSX.Element {
  // Un poste d'aujourd'hui déjà terminé n'est plus « le prochain » : on montre celui qui vient.
  const heure = new Date();
  const maintenant = today === todayISO() ? heure.getHours() * 60 + heure.getMinutes() : 0;
  const [p, suivant] = postes.filter((s) => s.date > today || s.end > maintenant);
  const quand = (date: ISODate): string => (date === today ? 'Aujourd’hui' : date === addDays(today, 1) ? 'Demain' : fmtDateCourt(date));
  if (!p) {
    return (
      <div className="prochain">
        <span className="eyebrow">Prochain poste</span>
        <div className="pp-ligne">
          <span className="moment repos" aria-hidden="true">
            <Coffee size={22} />
          </span>
          <b className="pp-h">Rien de prévu</b>
        </div>
        <span className="pp-d">Aucun poste publié à venir.</span>
      </div>
    );
  }
  const moment = momentDe(p);
  return (
    <div className="prochain">
      <span className="eyebrow">Prochain poste</span>
      <div className="pp-ligne">
        <span className={`moment ${moment}`} aria-hidden="true">
          {moment === 'soir' ? <Sunset size={22} /> : <Sun size={22} />}
        </span>
        <div>
          <span className="pp-quand cap1">
            {quand(p.date)} · {MOMENT_LABEL[moment].toLowerCase()}
          </span>
          <b className="pp-h num">
            {fmtHeure(p.start)} – {fmtHeure(p.end)}
          </b>
        </div>
      </div>
      <span className="pp-d">
        {fmtDuree(minutesTravail(p))} de travail
        {phrasePauses(p) ? ` · ${phrasePauses(p)}` : ''}
      </span>
      {suivant ? (
        <span className="pp-suite">
          Ensuite : <span className="cap1">{quand(suivant.date)}</span>, {fmtHeure(suivant.start)} – {fmtHeure(suivant.end)}
        </span>
      ) : null}
      {action}
    </div>
  );
}
