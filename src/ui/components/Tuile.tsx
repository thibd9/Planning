import { phrasePauses } from '../../engine/pauses';
import { Sparkles } from 'lucide-react';
import { JOURS, fmtDuree, fmtHHMM, weekday } from '../../domain/time';
import type { AppData, Person, Shift } from '../../domain/types';
import { ACTIVITE_LABEL, nomCourt, couleurDuPoste } from '../../domain/types';
import { decrireShift, minutesTravail } from '../../engine/core';
import { ACTIVITE_COURT, ACTIVITE_ICONE } from '../icons';
import type { Echelle } from '../kit';
import { useStore } from '../../store/store';
import { momentDe } from '../kit';


/**
 * Tuile d'un poste. L'icône dit la tâche (comptoir, réception, administratif, formation) ;
 * la couleur dit le moment de la journée ; l'horaire est écrit en clair.
 * Avec `onClick`, la tuile est un bouton modifiable ; sans, elle est en lecture seule.
 */
export function Tuile({
  s,
  person,
  glissable,
  onClick,
}: {
  /** Conservé pour les appelants ; le moment ne dépend plus que des heures du poste. */
  data?: AppData;
  s: Shift;
  person: Person;
  /** Conservés pour les appelants ; la tuile n'affiche plus de barre de temps. */
  echelle?: Echelle;
  missions?: { start: number; end: number }[];
  glissable?: boolean;
  onClick?: () => void;
}): JSX.Element {
  // Un poste type peut avoir sa couleur ; sinon elle suit le moment de la journée.
  const postesTypes = useStore((st) => st.data.officine.postes);
  const choisie = couleurDuPoste(postesTypes, s);
  const moment = choisie ? `k-${choisie}` : momentDe(s);
  const Icone = ACTIVITE_ICONE[s.activite];
  const contenu = (
    <>
      <span className="ti" aria-hidden="true">
        <Icone size={14} />
      </span>
      <span className="tt num">
        <span className="th">{fmtHHMM(s.start)}</span>
        <span className="tsep">–</span>
        <span className="th">{fmtHHMM(s.end)}</span>
        <span className="ts">
          {fmtDuree(minutesTravail(s))} · {ACTIVITE_COURT[s.activite].toLowerCase()}
        </span>
        {/* Le nom accessible reprend le texte visible, puis le complète. */}
        <span className="sr">
          , {nomCourt(person)}, {JOURS[weekday(s.date)]}
          {phrasePauses(s) ? `, ${phrasePauses(s)}` : ''}
          {onClick ? '. Modifier le poste.' : '.'}
        </span>
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
