import { CalendarClock, GraduationCap, Info } from 'lucide-react';
import { useState } from 'react';
import { addDays, fmtDateCourt } from '../../domain/time';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { EtiquetteRole } from '../icons';
import { Avatar, Dialog } from '../kit';

/**
 * Planifier une formation : un intitulé, des dates, des participants. Chaque participant est prévenu
 * dans son espace ; ses postes de ces jours-là deviennent des absences à couvrir dans « Résoudre ».
 */
export function DialogueFormation({ onClose, personId }: { onClose: () => void; personId?: string }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const planifier = useStore((s) => s.planifierFormation);
  const dire = useUi((s) => s.dire);
  const [intitule, setIntitule] = useState('');
  const [from, setFrom] = useState(addDays(today, 14));
  const [to, setTo] = useState(addDays(today, 14));
  const [choisis, setChoisis] = useState<string[]>(personId ? [personId] : []);
  const equipe = data.personnes.filter((p) => !p.externe);
  const fin = to && to >= from ? to : from;
  const postes = data.shifts.filter((s) => choisis.includes(s.personId) && s.date >= from && s.date <= fin).length;
  const pret = intitule.trim().length >= 2 && !!from && choisis.length > 0;
  const basculer = (id: string): void => setChoisis((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  return (
    <Dialog
      size="mid"
      title="Planifier une formation"
      subtitle="Les participants sont prévenus dans leur espace. Leurs postes de ces jours-là seront à couvrir."
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
              planifier({ intitule: intitule.trim(), personnes: choisis, from, to: fin });
              dire(`Formation « ${intitule.trim()} » planifiée pour ${choisis.length} personne${choisis.length > 1 ? 's' : ''}. ${postes ? 'Les postes concernés sont à couvrir dans « Résoudre ».' : 'Aucun poste n’est touché.'}`, true);
              onClose();
            }}
          >
            <GraduationCap size={16} aria-hidden="true" /> Planifier et prévenir
          </button>
        </>
      }
    >
      <label className="field" htmlFor="formation-intitule">
        Nom de la formation
        <input id="formation-intitule" value={intitule} onChange={(e) => setIntitule(e.target.value)} placeholder="Vaccination, entretiens pharmaceutiques, gestes d’urgence…" list="formations-connues" autoComplete="off" data-autofocus aria-required="true" />
      </label>
      <NomsFormations />
      <div className="row wrap" style={{ alignItems: 'flex-end' }}>
        <label className="field" htmlFor="formation-debut">
          Premier jour
          <input
            id="formation-debut"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              if (to < e.target.value) setTo(e.target.value);
            }}
          />
        </label>
        <label className="field" htmlFor="formation-fin">
          Dernier jour
          <input id="formation-fin" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <span className="small soft" style={{ paddingBottom: 12 }}>
          <CalendarClock size={14} aria-hidden="true" /> {from === fin ? `Le ${fmtDateCourt(from)}` : `Du ${fmtDateCourt(from)} au ${fmtDateCourt(fin)}`}
        </span>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field" style={{ marginBottom: 8 }}>
          Participants {choisis.length ? `(${choisis.length})` : ''}
        </legend>
        <div className="participants">
          {equipe.map((p) => (
            <label key={p.id} className={`participant${choisis.includes(p.id) ? ' on' : ''}`} htmlFor={`formation-${p.id}`}>
              <input id={`formation-${p.id}`} type="checkbox" checked={choisis.includes(p.id)} onChange={() => basculer(p.id)} />
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
      {choisis.length ? (
        <p className={`notice ${postes ? 'warn' : 'ok'} small`} role="status">
          <Info size={15} aria-hidden="true" />
          <span>
            {postes
              ? `${postes} poste${postes > 1 ? 's' : ''} déjà planifié${postes > 1 ? 's' : ''} sur ces dates : vous les retrouverez dans « Résoudre », avec des options de remplacement comparées.`
              : 'Aucun poste n’est planifié sur ces dates : rien à couvrir pour l’instant.'}
          </span>
        </p>
      ) : null}
      <p className="tiny muted">Pour une formation de quelques heures pendant un poste, ouvrez plutôt le poste dans « Construire » et choisissez la tâche « Formation ».</p>
    </Dialog>
  );
}

/** Noms proposés à la saisie : ceux déjà utilisés dans la pharmacie, puis les formations courantes en officine. */
const COURANTES = ['Vaccination', 'Entretiens pharmaceutiques', 'Gestes d’urgence (AFGSU)', 'Tests angine et cystite', 'Orthopédie', 'Contention et compression', 'Dermocosmétique', 'Phytothérapie et aromathérapie', 'Micronutrition', 'Maintien à domicile', 'Diabète', 'Sevrage tabagique', 'Tiers payant', 'Merchandising'];
export function NomsFormations(): JSX.Element {
  const absences = useStore((s) => s.data.absences);
  const noms = [...new Set([...absences.filter((a) => a.type === 'formation' && a.libelle).map((a) => a.libelle as string), ...COURANTES])];
  return (
    <datalist id="formations-connues">
      {noms.map((n) => (
        <option key={n} value={n} />
      ))}
    </datalist>
  );
}
