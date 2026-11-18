import type { LucideIcon } from 'lucide-react';
import { Check, MessageSquareText, MessagesSquare, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { motifRefus } from '../../domain/refus';
import type { Person } from '../../domain/types';
import { useUi } from '../../store/ui';
import { Avatar, Dialog } from '../kit';

export interface OptionDecision {
  cle: string;
  titre: string;
  phrase: string;
  icone: LucideIcon;
  /** Cette décision est un refus : elle demande une raison, et son bouton est rouge. */
  refus?: boolean;
  /** Impossible en l'état : la phrase dit pourquoi. */
  off?: boolean;
}

/**
 * Décider d'une demande. Un titulaire ne tranche pas par oui ou par non : la fenêtre montre la demande et sa raison,
 * ce qu'elle implique pour le planning, puis les décisions possibles, avec le message que la personne recevra.
 * Il peut aussi lui écrire avant de décider.
 */
export function DialogueDecision({
  titre,
  sousTitre,
  personne,
  demande,
  implications,
  options,
  raisons,
  message,
  bouton,
  onConfirmer,
  onClose,
}: {
  titre: string;
  sousTitre: string;
  personne: Person | undefined;
  /** Les faits de la demande : son objet, ses dates, sa raison. */
  demande: ReactNode;
  /** Ce que la demande implique pour le planning et pour l'équipe. */
  implications: ReactNode;
  options: OptionDecision[];
  /** Les raisons de refus proposées. */
  raisons: string[];
  /** Le message que la personne recevra pour cette décision ; `motif` : la raison du refus. */
  message: (cle: string, motif: string) => string;
  /** Le libellé du bouton de confirmation pour cette décision. */
  bouton: (cle: string) => string;
  onConfirmer: (cle: string, motif: string) => void;
  onClose: () => void;
}): JSX.Element {
  const { viserFil, aller } = useUi();
  const [choix, setChoix] = useState<string | null>(null);
  const [raison, setRaison] = useState('');
  const [mot, setMot] = useState('');
  const option = options.find((o) => o.cle === choix);
  const motif = motifRefus(raison, mot);
  const prenom = personne?.prenom ?? 'la personne';
  return (
    <Dialog
      size="mid"
      title={titre}
      subtitle={sousTitre}
      onClose={onClose}
      footer={
        <>
          {personne ? (
            <button
              type="button"
              className="btn ghost dc-ecrire"
              id="dc-ecrire"
              title="Ouvre votre conversation : la demande reste à décider"
              onClick={() => {
                viserFil(personne.id);
                aller('messages');
                onClose();
              }}
            >
              <MessagesSquare size={15} aria-hidden="true" /> En parler d’abord à {prenom}
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onClose}>
            Plus tard
          </button>
          <button
            type="button"
            className={`btn ${option?.refus ? 'danger' : 'primary'}`}
            id="dc-confirmer"
            disabled={!option}
            onClick={() => {
              if (!option) return;
              onConfirmer(option.cle, option.refus ? motif : '');
              onClose();
            }}
          >
            {option?.refus ? <X size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
            {option ? bouton(option.cle) : 'Choisissez une décision'}
          </button>
        </>
      }
    >
      <div className="dr">
        <section className="dr-bloc" aria-labelledby="dc-demande">
          <h3 id="dc-demande">La demande</h3>
          <div className="dr-demande">
            <Avatar person={personne} />
            <div className="grow">{demande}</div>
          </div>
        </section>
        <section className="dr-bloc" aria-labelledby="dc-implique" id="dc-implications">
          <h3 id="dc-implique">Ce que cela implique</h3>
          {implications}
        </section>
        <fieldset className="dr-bloc dr-decision">
          <legend>Votre décision</legend>
          <div className="dr-choix">
            {options.map(({ cle, titre: nom, phrase, icone: Icone, off, refus }) => (
              <label key={cle} className={`fo-carte dr-carte${choix === cle ? ' on' : ''}${off ? ' off' : ''}${refus ? ' non' : ''}`} htmlFor={`dc-${cle}`}>
                <input id={`dc-${cle}`} type="radio" name="dc-decision" checked={choix === cle} disabled={off} onChange={() => setChoix(cle)} />
                <span className="fo-ico" aria-hidden="true">
                  <Icone size={20} />
                </span>
                <span className="fo-texte">
                  <b>{nom}</b>
                  <span>{phrase}</span>
                </span>
                <span className="fo-coche" aria-hidden="true">
                  <Check size={14} strokeWidth={3} />
                </span>
              </label>
            ))}
          </div>
          {option?.refus ? (
            <>
              <label className="field" htmlFor="dc-raison">
                Raison du refus
                <select id="dc-raison" value={raison} onChange={(e) => setRaison(e.target.value)}>
                  <option value="">Ne pas préciser</option>
                  {raisons.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" htmlFor="dc-mot">
                <span>
                  Un mot pour {prenom} <span className="oblig">facultatif</span>
                </span>
                <textarea id="dc-mot" rows={3} maxLength={240} value={mot} onChange={(e) => setMot(e.target.value)} placeholder="Par exemple : la semaine suivante serait possible." />
              </label>
            </>
          ) : null}
          {option ? (
            <div className="refus-apercu" aria-live="polite" id="dc-message">
              <span className="refus-apercu-tete">
                <MessageSquareText size={14} aria-hidden="true" /> Ce que {prenom} recevra
              </span>
              <p>{message(option.cle, option.refus ? motif : '')}</p>
            </div>
          ) : null}
        </fieldset>
      </div>
    </Dialog>
  );
}
