import { Coffee, Sun, Sunset } from 'lucide-react';
import { addDays, fmtDateCourt, fmtDuree, fmtHeure } from '../../domain/time';
import type { ISODate, Shift } from '../../domain/types';
import { minutesTravail } from '../../engine/core';
import { MOMENT_LABEL, momentDe } from '../kit';

/** Le prochain poste, écrit en grand : c'est la première question de chacun en ouvrant l'application. */
export function ProchainPoste({ postes, today }: { postes: Shift[]; today: ISODate }): JSX.Element {
  const [p, suivant] = postes;
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
        {p.pauseStart !== undefined && p.pauseEnd !== undefined ? ` · pause de ${fmtHeure(p.pauseStart)} à ${fmtHeure(p.pauseEnd)}` : ''}
      </span>
      {suivant ? (
        <span className="pp-suite">
          Ensuite : <span className="cap1">{quand(suivant.date)}</span>, {fmtHeure(suivant.start)} – {fmtHeure(suivant.end)}
        </span>
      ) : null}
    </div>
  );
}
