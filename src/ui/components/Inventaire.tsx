import { ClipboardCheck, Info } from 'lucide-react';
import { useState } from 'react';
import { addDays, fmtDateCourt, fmtDuree, fmtHHMM, parseHHMM } from '../../domain/time';
import { ouverture } from '../../engine/core';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { EtiquetteRole } from '../icons';
import { Avatar, Dialog } from '../kit';

/**
 * Fixer un inventaire : une date, des heures, des participants. Chacun reçoit un poste « Inventaire »
 * dans son planning et un avis dans son espace.
 */
export function DialogueInventaire({ onClose }: { onClose: () => void }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const planifier = useStore((s) => s.planifierInventaire);
  const dire = useUi((s) => s.dire);
  const [date, setDate] = useState(addDays(today, 21));
  const [debut, setDebut] = useState('19:30');
  const [fin, setFin] = useState('22:30');
  const [choisis, setChoisis] = useState<string[]>([]);
  const equipe = data.personnes.filter((p) => !p.externe);
  const d = parseHHMM(debut);
  const f = parseHHMM(fin);
  const pret = !!date && d !== null && f !== null && f > d && choisis.length > 0;
  const ouvert = ouverture(data.officine, date);
  const pendant = d !== null && f !== null && ouvert.some((o) => d < o.end && o.start < f);
  const dejaEnPoste = choisis.filter((id) => data.shifts.some((s) => s.personId === id && s.date === date && d !== null && f !== null && s.start < f && d < s.end)).length;
  const tous = choisis.length === equipe.length;

  return (
    <Dialog
      size="mid"
      title="Fixer un inventaire"
      subtitle="Chaque participant reçoit un poste « Inventaire » et un avis dans son espace."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!pret}
            onClick={() => {
              planifier({ date, start: d as number, end: f as number, personnes: choisis });
              dire(`Inventaire fixé le ${fmtDateCourt(date)} pour ${choisis.length} personne${choisis.length > 1 ? 's' : ''}.`, true);
              onClose();
            }}
          >
            <ClipboardCheck size={16} aria-hidden="true" /> Fixer et prévenir
          </button>
        </>
      }
    >
      <div className="row wrap" style={{ alignItems: 'flex-end' }}>
        <label className="field" htmlFor="inventaire-date">
          Date
          <input id="inventaire-date" type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} data-autofocus />
        </label>
        <label className="field" htmlFor="inventaire-debut">
          Début
          <input id="inventaire-debut" type="time" step={900} value={debut} onChange={(e) => setDebut(e.target.value)} />
        </label>
        <label className="field" htmlFor="inventaire-fin">
          Fin
          <input id="inventaire-fin" type="time" step={900} value={fin} onChange={(e) => setFin(e.target.value)} />
        </label>
        {d !== null && f !== null && f > d ? <span className="small soft" style={{ paddingBottom: 12 }}>{fmtDuree(f - d)} · {fmtHHMM(d)} → {fmtHHMM(f)}</span> : null}
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field" style={{ marginBottom: 8 }}>
          Participants {choisis.length ? `(${choisis.length})` : ''}
        </legend>
        <button type="button" className="btn sm" style={{ marginBottom: 10 }} onClick={() => setChoisis(tous ? [] : equipe.map((p) => p.id))}>
          {tous ? 'Tout décocher' : 'Toute l’équipe'}
        </button>
        <div className="participants">
          {equipe.map((p) => (
            <label key={p.id} className={`participant${choisis.includes(p.id) ? ' on' : ''}`} htmlFor={`inventaire-${p.id}`}>
              <input id={`inventaire-${p.id}`} type="checkbox" checked={choisis.includes(p.id)} onChange={() => setChoisis((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id]))} />
              <Avatar person={p} />
              <span className="grow">
                <b>
                  {p.prenom} {p.nom}
                </b>
                <span style={{ display: 'block', marginTop: 3 }}>
                  <EtiquetteRole person={p} />
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {pret ? (
        <p className={`notice ${pendant || dejaEnPoste ? 'warn' : 'info'} small`} role="status">
          <Info size={15} aria-hidden="true" />
          <span>
            {pendant ? 'Ces heures tombent pendant l’ouverture : les participants ne seront pas au comptoir. ' : 'L’inventaire se tient hors des heures d’ouverture. '}
            {dejaEnPoste ? `${dejaEnPoste} participant${dejaEnPoste > 1 ? 's ont' : ' a'} déjà un poste sur cet horaire : ajustez-le dans « Construire ». ` : ''}
            Durées et repos seront contrôlés dans « Construire ».
          </span>
        </p>
      ) : null}
    </Dialog>
  );
}
