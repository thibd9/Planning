import { Sparkles } from 'lucide-react';
import { JOURS, fmtDuree, fmtHHMM, fmtHeure, weekday } from '../../domain/time';
import type { AppData, Person, Shift } from '../../domain/types';
import { ACTIVITE_LABEL, nomCourt } from '../../domain/types';
import { decrireShift, estFermeture, estOuverture, minutesTravail } from '../../engine/core';
import { ACTIVITE_COURT, ACTIVITE_ICONE } from '../icons';
import type { Echelle } from '../kit';

const pct = (e: Echelle, m: number): number => Math.max(0, Math.min(100, ((m - e.start) / (e.end - e.start)) * 100));

/**
 * Tuile d'un poste. L'icône dit la tâche (comptoir, réception, administratif, formation) ;
 * la couleur dit le moment de la journée ; la barre du bas situe le poste dans la journée.
 * Avec `onClick`, la tuile est un bouton modifiable ; sans, elle est en lecture seule.
 */
export function Tuile({
  data,
  s,
  person,
  echelle,
  missions = [],
  glissable,
  onClick,
}: {
  data: AppData;
  s: Shift;
  person: Person;
  echelle: Echelle;
  missions?: { start: number; end: number }[];
  glissable?: boolean;
  onClick?: () => void;
}): JSX.Element {
  const ouvre = estOuverture(data.officine, s);
  const ferme = estFermeture(data.officine, s);
  const moment = ouvre && ferme ? 'journee' : ouvre ? 'matin' : ferme ? 'soir' : 'milieu';
  const Icone = ACTIVITE_ICONE[s.activite];
  const contenu = (
    <>
      <span className="ti" aria-hidden="true">
        <Icone size={14} />
      </span>
      <span className="tt num">
        {fmtHHMM(s.start)}–{fmtHHMM(s.end)}
        <span className="ts">
          {fmtDuree(minutesTravail(s))} · {ACTIVITE_COURT[s.activite].toLowerCase()}
        </span>
        {/* Le nom accessible reprend le texte visible, puis le complète. */}
        <span className="sr">
          , {nomCourt(person)}, {JOURS[weekday(s.date)]}
          {s.pauseStart !== undefined && s.pauseEnd !== undefined ? `, pause de ${fmtHeure(s.pauseStart)} à ${fmtHeure(s.pauseEnd)}` : ''}
          {onClick ? '. Modifier le poste.' : '.'}
        </span>
      </span>
      <span className="tline" aria-hidden="true">
        <i style={{ left: `${pct(echelle, s.start)}%`, width: `${pct(echelle, s.end) - pct(echelle, s.start)}%` }} />
        {s.pauseStart !== undefined && s.pauseEnd !== undefined ? <i className="p" style={{ left: `${pct(echelle, s.pauseStart)}%`, width: `${pct(echelle, s.pauseEnd) - pct(echelle, s.pauseStart)}%` }} /> : null}
        {missions.map((m, i) => (
          <i key={i} className="m" style={{ left: `${pct(echelle, m.start)}%`, width: `${pct(echelle, m.end) - pct(echelle, m.start)}%` }} />
        ))}
      </span>
      {s.explication && onClick ? (
        <span className="why" aria-hidden="true">
          <Sparkles size={9} />
        </span>
      ) : null}
    </>
  );
  const classe = `tile ${moment}${s.activite !== 'comptoir' ? ' back' : ''}${person.externe ? ' ext' : ''}`;
  if (!onClick) return <span className={classe}>{contenu}</span>;
  return (
    <button type="button" className={classe} draggable={glissable} onDragStart={(e) => e.dataTransfer.setData('text/plain', s.id)} onClick={onClick} title={s.explication ?? `${decrireShift(s)} · ${ACTIVITE_LABEL[s.activite]}`}>
      {contenu}
    </button>
  );
}
