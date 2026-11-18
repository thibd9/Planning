import { Plus } from 'lucide-react';
import { useState } from 'react';
import { fmtDuree, fmtHHMM, fmtHeure, parseHHMM, uid } from '../../domain/time';
import type { CouleurPoste, PosteType } from '../../domain/types';
import { COULEUR_POSTE_LABEL } from '../../domain/types';
import { minutesTravail } from '../../engine/core';
import { Dialog, momentDe } from '../kit';

export const COULEURS_POSTE = Object.keys(COULEUR_POSTE_LABEL) as CouleurPoste[];
/** La classe de couleur d'un poste type : celle qu'on a choisie, sinon celle de son horaire. */
export const classePoste = (p: Pick<PosteType, 'start' | 'end' | 'couleur'>): string => (p.couleur ? `k-${p.couleur}` : momentDe(p));

/** Des points de départ : on choisit, tout se remplit, et tout reste modifiable. */
const MODELES: { cle: string; nom: string; label: string; start: number; end: number; pause: number; couleur: CouleurPoste }[] = [
  { cle: 'matin', nom: 'Matin', label: 'Matin', start: 510, end: 780, pause: 0, couleur: 'jaune' },
  { cle: 'apres', nom: 'Après-midi', label: 'Après-midi', start: 840, end: 1170, pause: 0, couleur: 'violet' },
  { cle: 'journee', nom: 'Journée', label: 'Journée', start: 510, end: 990, pause: 60, couleur: 'orange' },
  { cle: 'longue', nom: 'Journée longue', label: 'Journée longue', start: 510, end: 1170, pause: 90, couleur: 'bleu' },
  { cle: 'libre', nom: 'Autre : je règle tout moi-même', label: '', start: 540, end: 1020, pause: 60, couleur: 'gris' },
];
const JOURS_CHOIX: { cle: string; nom: string; jours: number[] }[] = [
  { cle: 'semaine', nom: 'Du lundi au vendredi', jours: [0, 1, 2, 3, 4] },
  { cle: 'samedi', nom: 'Le samedi', jours: [5] },
  { cle: 'ouvres', nom: 'Du lundi au samedi', jours: [0, 1, 2, 3, 4, 5] },
  { cle: 'tous', nom: 'Tous les jours', jours: [0, 1, 2, 3, 4, 5, 6] },
];
const PAUSES = [0, 30, 45, 60, 90, 120];

/** Créer un poste type : un modèle de départ, les horaires, la pause, les jours et la couleur, avec l'aperçu de la tuile. */
export function DialoguePosteType({ onClose, onAjouter }: { onClose: () => void; onAjouter: (p: PosteType) => void }): JSX.Element {
  const [modele, setModele] = useState('journee');
  const [label, setLabel] = useState('Journée');
  const [start, setStart] = useState(510);
  const [end, setEnd] = useState(990);
  const [pause, setPause] = useState(60);
  const [pauseDebut, setPauseDebut] = useState(750);
  const [jours, setJours] = useState('semaine');
  const [couleur, setCouleur] = useState<CouleurPoste | ''>('orange');
  const choisir = (cle: string): void => {
    const m = MODELES.find((x) => x.cle === cle);
    if (!m) return;
    setModele(cle);
    setLabel(m.label);
    setStart(m.start);
    setEnd(m.end);
    setPause(m.pause);
    setPauseDebut(Math.round((m.start + m.end) / 2 / 30) * 30 - 30);
    setCouleur(m.couleur);
  };
  const horairesOk = end > start && (!pause || (pauseDebut >= start && pauseDebut + pause <= end));
  const poste: PosteType = {
    id: 'apercu',
    label: label.trim(),
    start,
    end,
    ...(pause ? { pauseStart: pauseDebut, pauseEnd: pauseDebut + pause } : {}),
    jours: JOURS_CHOIX.find((j) => j.cle === jours)?.jours ?? [0, 1, 2, 3, 4],
    ...(couleur ? { couleur } : {}),
  };
  const pret = !!label.trim() && horairesOk;
  return (
    <Dialog
      title="Nouveau poste type"
      subtitle="Un horaire que vous utilisez souvent : il sert à la saisie rapide et aux propositions de planning."
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
              onAjouter({ ...poste, id: uid('poste') });
              onClose();
            }}
          >
            <Plus size={15} aria-hidden="true" /> Ajouter le poste type
          </button>
        </>
      }
    >
      <label className="field" htmlFor="pt-modele">
        Partir de
        <select id="pt-modele" value={modele} onChange={(e) => choisir(e.target.value)} data-autofocus>
          {MODELES.map((m) => (
            <option key={m.cle} value={m.cle}>
              {m.nom}
            </option>
          ))}
        </select>
      </label>
      <label className="field" htmlFor="pt-nom">
        Nom du poste
        <input id="pt-nom" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ouverture, Renfort du midi…" aria-required="true" />
      </label>
      <div className="row wrap" style={{ alignItems: 'flex-end' }}>
        <label className="field" htmlFor="pt-debut">
          Début
          <input id="pt-debut" type="time" step={900} value={fmtHHMM(start)} onChange={(e) => setStart(parseHHMM(e.target.value) ?? start)} />
        </label>
        <label className="field" htmlFor="pt-fin">
          Fin
          <input id="pt-fin" type="time" step={900} value={fmtHHMM(end)} onChange={(e) => setEnd(parseHHMM(e.target.value) ?? end)} />
        </label>
        <label className="field" htmlFor="pt-pause">
          Pause
          <select id="pt-pause" value={pause} onChange={(e) => setPause(Number(e.target.value))}>
            {PAUSES.map((m) => (
              <option key={m} value={m}>
                {m ? fmtDuree(m) : 'Sans pause'}
              </option>
            ))}
          </select>
        </label>
        {pause ? (
          <label className="field" htmlFor="pt-pause-debut">
            Pause à partir de
            <input id="pt-pause-debut" type="time" step={900} value={fmtHHMM(pauseDebut)} onChange={(e) => setPauseDebut(parseHHMM(e.target.value) ?? pauseDebut)} />
          </label>
        ) : null}
      </div>
      {!horairesOk ? (
        <p className="small" role="alert" style={{ color: 'var(--danger-ink)', margin: 0 }}>
          {end <= start ? 'La fin doit venir après le début.' : 'La pause doit tenir entre le début et la fin du poste.'}
        </p>
      ) : null}
      <label className="field" htmlFor="pt-jours">
        Jours
        <select id="pt-jours" value={jours} onChange={(e) => setJours(e.target.value)}>
          {JOURS_CHOIX.map((j) => (
            <option key={j.cle} value={j.cle}>
              {j.nom}
            </option>
          ))}
        </select>
      </label>
      <div className="row wrap" style={{ alignItems: 'flex-end' }}>
        <label className="field" htmlFor="pt-couleur">
          Couleur
          <select id="pt-couleur" value={couleur} onChange={(e) => setCouleur(e.target.value as CouleurPoste | '')}>
            <option value="">Automatique, selon l’horaire</option>
            {COULEURS_POSTE.map((c) => (
              <option key={c} value={c}>
                {COULEUR_POSTE_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <div className="pt-nuancier" role="group" aria-label="Choisir la couleur d’un clic">
          {COULEURS_POSTE.map((c) => (
            <button key={c} type="button" className={`pt-nuance k-${c}${couleur === c ? ' on' : ''}`} aria-pressed={couleur === c} aria-label={COULEUR_POSTE_LABEL[c]} title={COULEUR_POSTE_LABEL[c]} onClick={() => setCouleur(c)} />
          ))}
        </div>
      </div>
      <div className="pt-apercu" aria-live="polite">
        <span className="small soft">Aperçu dans le planning</span>
        <span className={`pt-tuile ${classePoste(poste)}`}>
          <b>{label.trim() || 'Nom du poste'}</b>
          <span className="num">
            {fmtHeure(start)} – {fmtHeure(end)}
          </span>
        </span>
        <span className="small">
          {horairesOk ? (
            <>
              <b className="num">{fmtDuree(minutesTravail(poste))}</b> de travail effectif{pause ? `, pause de ${fmtDuree(pause)}` : ''}
            </>
          ) : (
            'Horaires à corriger'
          )}
        </span>
      </div>
    </Dialog>
  );
}
