import { Building2, CalendarClock, Check, GraduationCap, Info, MapPin, Store } from 'lucide-react';
import { useState } from 'react';
import { addDays, fmtDateCourt } from '../../domain/time';
import type { CadreFormation } from '../../domain/types';
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
  // Interne ou externe : le choix se fait, il n'est pas deviné. Le lieu suit : la pharmacie, ou une adresse à donner.
  const [cadre, setCadre] = useState<CadreFormation | null>(null);
  const [lieu, setLieu] = useState('');
  const ici = data.officine.nom.trim() ? `À la pharmacie (${data.officine.nom.trim()})` : 'À la pharmacie';
  const choisirCadre = (c: CadreFormation): void => {
    setCadre(c);
    // Le lieu proposé pour une formation interne ne suit pas vers une formation externe.
    setLieu((l) => (c === 'interne' ? (l.trim() && l !== ici ? l : ici) : l === ici ? '' : l));
  };
  const equipe = data.personnes.filter((p) => !p.externe);
  const fin = to && to >= from ? to : from;
  const postes = data.shifts.filter((s) => choisis.includes(s.personId) && s.date >= from && s.date <= fin).length;
  const pret = intitule.trim().length >= 2 && !!from && choisis.length > 0 && !!cadre && lieu.trim().length >= 2;
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
              planifier({ intitule: intitule.trim(), personnes: choisis, from, to: fin, cadre: cadre ?? undefined, lieu: lieu.trim() });
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
      <fieldset className="fo-cadre">
        <legend className="field">Cette formation est</legend>
        <div className="fo-choix">
          {(
            [
              { cle: 'interne', titre: 'Interne', phrase: 'À la pharmacie, animée par l’équipe ou un intervenant.', Icone: Store },
              { cle: 'externe', titre: 'Externe', phrase: 'À l’extérieur, dans un organisme de formation.', Icone: Building2 },
            ] as const
          ).map(({ cle, titre, phrase, Icone }) => (
            <label key={cle} className={`fo-carte${cadre === cle ? ' on' : ''}`} htmlFor={`formation-${cle}`}>
              <input id={`formation-${cle}`} type="radio" name="formation-cadre" checked={cadre === cle} onChange={() => choisirCadre(cle)} />
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
      <label className="field" htmlFor="formation-lieu">
        <span>
          <MapPin size={14} aria-hidden="true" /> Lieu de la formation
        </span>
        <input
          id="formation-lieu"
          value={lieu}
          onChange={(e) => setLieu(e.target.value)}
          placeholder={cadre === 'externe' ? 'Organisme, adresse ou ville' : 'Par exemple : à la pharmacie, salle de réunion'}
          maxLength={120}
          autoComplete="off"
        />
        <span className="aide">Les participants le lisent dans leur espace, avec les dates.</span>
      </label>
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
