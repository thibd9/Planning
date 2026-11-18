import { AlarmClock, BellRing, Check, Pencil, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { addDays, fmtDateCourt, fmtHeure, todayISO } from '../../domain/time';
import { MOTIF_RETARD_LABEL, nomCourt } from '../../domain/types';
import type { AvisRetard, MotifRetard, Shift } from '../../domain/types';
import { RETARDS_RAPIDES, RETARD_MAX, arriveePrevue, avisPour, dureeRetard, effetsRetard, posteAPrevenir, superieurs } from '../../engine/retard';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Dialog } from '../kit';

const MOTIFS = Object.keys(MOTIF_RETARD_LABEL) as MotifRetard[];
/** L'heure qu'il est, en minutes ; sur une date d'essai, la journée n'a pas commencé. */
const heureQuIlEst = (today: string): number => {
  if (today !== todayISO()) return 0;
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
const enumerer = (noms: string[]): string => (noms.length <= 1 ? (noms[0] ?? '') : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`);

/**
 * « Prévenir d'un retard » : deux gestes suffisent, la durée puis l'envoi. Les titulaires reçoivent une notification
 * et un message ; l'avis reste affiché sur le prochain poste, où il se modifie ou s'annule.
 */
export function PrevenirRetard({ personId }: { personId: string }): JSX.Element | null {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const annuler = useStore((s) => s.annulerRetard);
  const dire = useUi((s) => s.dire);
  const [ouvert, setOuvert] = useState(false);
  // L'heure avance : un poste terminé laisse la place au suivant sans recharger la page.
  const [maintenant, setMaintenant] = useState(() => heureQuIlEst(today));
  useEffect(() => {
    setMaintenant(heureQuIlEst(today));
    const t = window.setInterval(() => setMaintenant(heureQuIlEst(today)), 60000);
    return () => window.clearInterval(t);
  }, [today]);
  const chefs = superieurs(data, personId);
  const poste = posteAPrevenir(data, personId, today, addDays(today, 1), maintenant);
  if (!poste || !chefs.length) return null;
  const avis = avisPour(data, personId, poste);
  const quand = poste.date === today ? 'Aujourd’hui' : poste.date === addDays(today, 1) ? 'Demain' : fmtDateCourt(poste.date);
  return (
    <div className="ret" data-focus="retard">
      {avis ? (
        <div className="ret-etat" role="status">
          <span className="ret-ico" aria-hidden="true">
            <AlarmClock size={18} />
          </span>
          <span className="grow">
            <b>Retard annoncé : {dureeRetard(avis.minutes)}</b>
            <span className="small">
              {quand}, poste de {fmtHeure(poste.start)} : arrivée prévue vers {fmtHeure(arriveePrevue(avis))}. Les titulaires sont prévenus.
            </span>
          </span>
          <button type="button" className="btn sm" id="ret-modifier" onClick={() => setOuvert(true)}>
            <Pencil size={14} aria-hidden="true" /> Modifier
          </button>
          <button
            type="button"
            className="btn sm ghost"
            id="ret-annuler"
            onClick={() => {
              annuler(avis.id);
              dire('Avis de retard annulé : les titulaires sont prévenus.');
            }}
          >
            <Undo2 size={14} aria-hidden="true" /> Je serai à l’heure
          </button>
        </div>
      ) : (
        <button type="button" className="btn ret-bouton" id="ret-prevenir" onClick={() => setOuvert(true)}>
          <AlarmClock size={17} aria-hidden="true" /> Prévenir d’un retard
        </button>
      )}
      {ouvert ? <DialogueRetard personId={personId} poste={poste} avis={avis} onClose={() => setOuvert(false)} /> : null}
    </div>
  );
}

function DialogueRetard({ personId, poste, avis, onClose }: { personId: string; poste: Shift; avis?: AvisRetard; onClose: () => void }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const prevenir = useStore((s) => s.prevenirRetard);
  const dire = useUi((s) => s.dire);
  const [minutes, setMinutes] = useState(avis?.minutes ?? 10);
  const [autre, setAutre] = useState(!!avis && !RETARDS_RAPIDES.includes(avis.minutes));
  const [motif, setMotif] = useState<MotifRetard | undefined>(avis?.motif);
  const [note, setNote] = useState(avis?.note ?? '');
  const chefs = superieurs(data, personId)
    .map((id) => data.personnes.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const duree = Math.max(1, Math.min(RETARD_MAX, Math.round(minutes) || 0));
  const quand = poste.date === today ? 'aujourd’hui' : poste.date === addDays(today, 1) ? 'demain' : fmtDateCourt(poste.date);
  const brouillon: AvisRetard = { id: 'essai', personId, date: poste.date, start: poste.start, minutes: duree, at: '' };
  const effets = effetsRetard(data, brouillon);
  const envoyer = (): void => {
    prevenir({ personId, date: poste.date, start: poste.start, minutes: duree, motif, note });
    dire(`${enumerer(chefs.map((p) => nomCourt(p)))} ${chefs.length > 1 ? 'sont prévenus' : 'est prévenu'} : arrivée vers ${fmtHeure(poste.start + duree)}.`);
    onClose();
  };
  return (
    <Dialog
      title={avis ? 'Modifier mon avis de retard' : 'Prévenir d’un retard'}
      subtitle={`Votre poste : ${quand}, ${fmtHeure(poste.start)} – ${fmtHeure(poste.end)}. Les titulaires sont prévenus aussitôt.`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn primary" id="ret-envoyer" data-autofocus onClick={envoyer}>
            <BellRing size={16} aria-hidden="true" /> {chefs.length > 1 ? 'Prévenir les titulaires' : `Prévenir ${chefs[0] ? chefs[0].prenom : 'le titulaire'}`}
          </button>
        </>
      }
    >
      <div className="ret-corps">
        <fieldset className="ret-bloc">
          <legend>De combien serez-vous en retard ?</legend>
          <div className="ret-choix" id="ret-durees">
            {RETARDS_RAPIDES.map((m) => (
              <button
                key={m}
                type="button"
                className={`comp${!autre && minutes === m ? ' on' : ''}`}
                aria-pressed={!autre && minutes === m}
                onClick={() => {
                  setAutre(false);
                  setMinutes(m);
                }}
              >
                <span>{dureeRetard(m)}</span>
                {!autre && minutes === m ? <Check size={14} strokeWidth={3} className="comp-coche" aria-hidden="true" /> : null}
              </button>
            ))}
            <button type="button" className={`comp${autre ? ' on' : ''}`} aria-pressed={autre} onClick={() => setAutre(true)}>
              <span>Autre durée</span>
            </button>
          </div>
          {autre ? (
            <label className="field ret-autre" htmlFor="ret-minutes">
              Durée en minutes
              <input id="ret-minutes" type="number" inputMode="numeric" min={1} max={RETARD_MAX} step={5} className="num" value={minutes || ''} onChange={(e) => setMinutes(Number(e.target.value))} />
            </label>
          ) : null}
          <p className="ret-arrivee" id="ret-arrivee" role="status">
            <AlarmClock size={17} aria-hidden="true" />
            <span>
              Arrivée prévue vers <b className="num">{fmtHeure(poste.start + duree)}</b>, au lieu de {fmtHeure(poste.start)}.
            </span>
          </p>
        </fieldset>
        <fieldset className="ret-bloc">
          <legend>
            Pourquoi ? <span className="oblig">facultatif</span>
          </legend>
          <div className="ret-choix" id="ret-motifs">
            {MOTIFS.map((m) => (
              <button key={m} type="button" className={`comp${motif === m ? ' on' : ''}`} aria-pressed={motif === m} onClick={() => setMotif(motif === m ? undefined : m)}>
                <span>{MOTIF_RETARD_LABEL[m]}</span>
                {motif === m ? <Check size={14} strokeWidth={3} className="comp-coche" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
          <label className="field" htmlFor="ret-note">
            <span>
              Un mot pour les titulaires <span className="oblig">facultatif</span>
            </span>
            <input id="ret-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} autoComplete="off" placeholder="Par exemple : train supprimé, je prends le suivant" />
          </label>
        </fieldset>
        <p className="ret-qui small">
          <BellRing size={15} aria-hidden="true" />
          <span>
            {enumerer(chefs.map((p) => nomCourt(p)))} {chefs.length > 1 ? 'reçoivent' : 'reçoit'} une notification et un message. La raison n’est vue que des titulaires.
          </span>
        </p>
        {effets.length ? (
          <p className="ret-effet small" id="ret-effet">
            {effets.join(' ')} Les titulaires en sont avertis.
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
