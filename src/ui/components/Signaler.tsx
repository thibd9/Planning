import { AlarmClock, BellRing, CalendarX, Check } from 'lucide-react';
import { useState } from 'react';
import { peutGerer } from '../../domain/acces';
import { addDays, fmtDateCourt, fmtHeure, todayISO } from '../../domain/time';
import { nomCourt } from '../../domain/types';
import type { AbsenceType, ISODate, Person } from '../../domain/types';
import { RETARDS_RAPIDES, RETARD_MAX, dureeRetard, posteAPrevenir, superieurs } from '../../engine/retard';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Dialog } from '../kit';

type Quoi = 'retard' | 'absence';
const RAISONS: { cle: AbsenceType; nom: string }[] = [
  { cle: 'maladie', nom: 'Maladie' },
  { cle: 'autre', nom: 'Autre raison' },
];
const heureQuIlEst = (today: string): number => {
  if (today !== todayISO()) return 0;
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

/**
 * Signaler un retard ou une absence, en quelques gestes, depuis n'importe quel écran. Pour soi : les titulaires
 * sont prévenus aussitôt. Un titulaire peut aussi le faire pour quelqu'un d'autre, qui a prévenu par téléphone.
 */
export function DialogueSignaler({ moi, quoi: depart, onClose }: { moi: Person; quoi?: Quoi; onClose: () => void }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { prevenirRetard, signalerAbsence, declarerAbsence } = useStore();
  const dire = useUi((s) => s.dire);
  const gestion = peutGerer(data, moi);
  const equipe = data.personnes.filter((p) => !p.externe);
  const [qui, setQui] = useState(moi.id);
  const [quoi, setQuoi] = useState<Quoi | null>(depart ?? null);
  const [minutes, setMinutes] = useState(10);
  const [autre, setAutre] = useState(false);
  const [du, setDu] = useState<ISODate>(today);
  const [au, setAu] = useState<ISODate>(today);
  const [raison, setRaison] = useState<AbsenceType>('maladie');
  const [note, setNote] = useState('');
  const personne = equipe.find((p) => p.id === qui) ?? moi;
  const pourMoi = personne.id === moi.id;
  const chefs = superieurs(data, personne.id)
    .map((id) => data.personnes.find((p) => p.id === id))
    .filter((p): p is Person => !!p && p.id !== moi.id);
  // Pour soi, sans titulaire au-dessus : personne à prévenir. Un titulaire enregistre alors directement.
  const poste = posteAPrevenir(data, personne.id, today, addDays(today, 1), heureQuIlEst(today));
  const duree = Math.max(1, Math.min(RETARD_MAX, Math.round(minutes) || 0));
  const fin = au >= du ? au : du;
  const postes = data.shifts.filter((s) => s.personId === personne.id && s.date >= du && s.date <= fin).length;
  const noms = chefs.map((p) => nomCourt(p)).join(', ');
  const pret = quoi === 'retard' ? !!poste : quoi === 'absence';
  const confirmer = (): void => {
    if (quoi === 'retard' && poste) {
      prevenirRetard({ personId: personne.id, date: poste.date, start: poste.start, minutes: duree, note, ...(pourMoi ? {} : { par: moi.id }) });
      dire(pourMoi ? `Retard signalé : arrivée vers ${fmtHeure(poste.start + duree)}.${noms ? ` ${noms} ${chefs.length > 1 ? 'sont prévenus' : 'est prévenu'}.` : ''}` : `Retard de ${nomCourt(personne)} noté : arrivée vers ${fmtHeure(poste.start + duree)}.`);
    } else if (quoi === 'absence') {
      if (gestion) {
        // Un titulaire enregistre l'absence : elle est acquise, et ses postes passent dans « Absences à couvrir ».
        declarerAbsence({ personId: personne.id, from: du, to: fin, type: raison, statut: 'approuvee', ...(note.trim() ? { precision: note.trim() } : {}) });
        dire(`Absence de ${pourMoi ? 'votre part' : nomCourt(personne)} enregistrée.${postes ? ` ${postes} poste${postes > 1 ? 's' : ''} à couvrir dans « Résoudre ».` : ''}`, true);
      } else {
        signalerAbsence({ personId: personne.id, from: du, to: fin, type: raison, note });
        dire(`Absence signalée.${noms ? ` ${noms} ${chefs.length > 1 ? 'sont prévenus' : 'est prévenu'}.` : ''}`);
      }
    }
    onClose();
  };
  return (
    <Dialog
      title="Signaler un retard ou une absence"
      subtitle={gestion ? 'Pour vous, ou pour une personne de l’équipe qui vous a prévenu.' : 'Vos titulaires sont prévenus aussitôt.'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn primary" id="sg-confirmer" disabled={!pret} onClick={confirmer}>
            <BellRing size={16} aria-hidden="true" /> {!quoi ? 'Choisissez retard ou absence' : gestion ? (quoi === 'retard' ? 'Noter le retard' : 'Enregistrer l’absence') : 'Prévenir les titulaires'}
          </button>
        </>
      }
    >
      <div className="ret-corps">
        {gestion ? (
          <label className="field" htmlFor="sg-qui">
            Pour qui ?
            <select id="sg-qui" value={qui} onChange={(e) => setQui(e.target.value)}>
              <option value={moi.id}>Moi ({nomCourt(moi)})</option>
              {equipe
                .filter((p) => p.id !== moi.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {nomCourt(p)}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        <fieldset className="ret-bloc">
          <legend>Que se passe-t-il ?</legend>
          <div className="fo-choix">
            {(
              [
                { cle: 'retard', titre: 'Un retard', phrase: pourMoi ? 'Je serai là, mais plus tard que prévu.' : 'Elle arrivera plus tard que prévu.', Icone: AlarmClock },
                { cle: 'absence', titre: 'Une absence', phrase: pourMoi ? 'Je ne pourrai pas venir.' : 'Elle ne pourra pas venir.', Icone: CalendarX },
              ] as const
            ).map(({ cle, titre, phrase, Icone }) => (
              <label key={cle} className={`fo-carte${quoi === cle ? ' on' : ''}`} htmlFor={`sg-${cle}`}>
                <input id={`sg-${cle}`} type="radio" name="sg-quoi" checked={quoi === cle} onChange={() => setQuoi(cle)} />
                <span className="fo-ico" aria-hidden="true">
                  <Icone size={20} />
                </span>
                <span className="fo-texte">
                  <b>{titre}</b>
                  <span>{phrase}</span>
                </span>
                <span className="fo-coche" aria-hidden="true">
                  <Check size={14} strokeWidth={3} />
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {quoi === 'retard' ? (
          poste ? (
            <fieldset className="ret-bloc">
              <legend>
                De combien ? <span className="oblig">poste {poste.date === today ? 'd’aujourd’hui' : 'de demain'}, {fmtHeure(poste.start)} – {fmtHeure(poste.end)}</span>
              </legend>
              <div className="ret-choix" id="sg-durees">
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
                  </button>
                ))}
                <button type="button" className={`comp${autre ? ' on' : ''}`} aria-pressed={autre} onClick={() => setAutre(true)}>
                  <span>Autre durée</span>
                </button>
              </div>
              {autre ? (
                <label className="field ret-autre" htmlFor="sg-minutes">
                  Durée en minutes
                  <input id="sg-minutes" type="number" inputMode="numeric" min={1} max={RETARD_MAX} step={5} className="num" value={minutes || ''} onChange={(e) => setMinutes(Number(e.target.value))} />
                </label>
              ) : null}
              <p className="ret-arrivee" role="status">
                <AlarmClock size={17} aria-hidden="true" />
                <span>
                  Arrivée prévue vers <b className="num">{fmtHeure(poste.start + duree)}</b>, au lieu de {fmtHeure(poste.start)}.
                </span>
              </p>
            </fieldset>
          ) : (
            <p className="ret-effet small" id="sg-sans-poste">
              {pourMoi ? 'Vous n’avez' : `${personne.prenom} n’a`} pas de poste publié aujourd’hui ni demain : il n’y a pas de retard à signaler.
            </p>
          )
        ) : null}

        {quoi === 'absence' ? (
          <fieldset className="ret-bloc">
            <legend>Quand, et pourquoi ?</legend>
            <div className="row wrap" style={{ alignItems: 'flex-end', gap: 12 }}>
              <label className="field" htmlFor="sg-du">
                À partir du
                <input
                  id="sg-du"
                  type="date"
                  value={du}
                  min={today}
                  onChange={(e) => {
                    setDu(e.target.value);
                    if (au < e.target.value) setAu(e.target.value);
                  }}
                />
              </label>
              <label className="field" htmlFor="sg-au">
                Jusqu’au
                <input id="sg-au" type="date" value={fin} min={du} onChange={(e) => setAu(e.target.value)} />
              </label>
            </div>
            <div className="ret-choix" id="sg-raisons">
              {RAISONS.map((x) => (
                <button key={x.cle} type="button" className={`comp${raison === x.cle ? ' on' : ''}`} aria-pressed={raison === x.cle} onClick={() => setRaison(x.cle)}>
                  <span>{x.nom}</span>
                </button>
              ))}
            </div>
            <p className={postes ? 'ret-effet small' : 'small soft'} id="sg-postes" style={{ margin: 0 }}>
              {postes
                ? `${postes} poste${postes > 1 ? 's sont planifiés' : ' est planifié'} ${du === fin ? `le ${fmtDateCourt(du)}` : 'sur ces dates'} : ${gestion ? 'ils seront à couvrir dans « Résoudre », avec les options comparées.' : 'vos titulaires décideront comment les couvrir.'}`
                : 'Aucun poste n’est planifié sur ces dates.'}
            </p>
          </fieldset>
        ) : null}

        {quoi ? (
          <label className="field" htmlFor="sg-note">
            <span>
              Un mot <span className="oblig">facultatif</span>
            </span>
            <input id="sg-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} autoComplete="off" placeholder={quoi === 'retard' ? 'Par exemple : train supprimé' : 'Par exemple : je vous tiens au courant demain'} />
          </label>
        ) : null}
        {quoi && noms ? (
          <p className="ret-qui small">
            <BellRing size={15} aria-hidden="true" />
            <span>
              {noms} {chefs.length > 1 ? 'reçoivent' : 'reçoit'} une notification{pourMoi && !gestion ? ' et un message' : ''}.
            </span>
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
