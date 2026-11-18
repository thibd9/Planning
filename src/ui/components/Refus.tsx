import { MessageSquareText, X } from 'lucide-react';
import { useState } from 'react';
import { motifRefus } from '../../domain/refus';
import { Dialog } from '../kit';

/**
 * Dire non, proprement : une raison choisie dans une liste, un mot si l'on veut,
 * et l'aperçu du message que l'autre recevra. Sans message, le refus est simplement enregistré.
 * Sert au titulaire qui refuse une demande, et au collègue qui ne peut pas reprendre un poste.
 */
export function DialogueRefus({
  titre = 'Refuser la demande',
  quoi,
  raisons,
  pour,
  apercu,
  bouton = 'Refuser',
  sansMessage,
  exemple = 'Par exemple : la semaine suivante serait possible.',
  onClose,
  onConfirmer,
}: {
  titre?: string;
  /** Ce qui est refusé, en une ligne. */
  quoi: string;
  raisons: string[];
  /** Prénom de la personne qui reçoit le message. */
  pour: string;
  /** Le message complet, d'après la raison et le mot. */
  apercu: (motif: string) => string;
  bouton?: string;
  /** Ce qui se passe si aucun message n'est envoyé. */
  sansMessage: string;
  exemple?: string;
  onClose: () => void;
  /** `undefined` : aucun message à envoyer. */
  onConfirmer: (motif: string | undefined) => void;
}): JSX.Element {
  const [prevenir, setPrevenir] = useState(true);
  const [raison, setRaison] = useState('');
  const [mot, setMot] = useState('');
  const motif = motifRefus(raison, mot);
  return (
    <Dialog
      title={titre}
      subtitle={quoi}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              onConfirmer(prevenir ? motif : undefined);
              onClose();
            }}
          >
            <X size={15} aria-hidden="true" /> {prevenir ? `${bouton} et prévenir ${pour}` : bouton}
          </button>
        </>
      }
    >
      <label className="check ligne" htmlFor="refus-prevenir">
        <input id="refus-prevenir" type="checkbox" checked={prevenir} onChange={(e) => setPrevenir(e.target.checked)} />
        <span>
          Envoyer un message à {pour}
          <span className="soft small" style={{ display: 'block' }}>Il arrive dans ses messages. La raison reste facultative.</span>
        </span>
      </label>
      {prevenir ? (
        <>
          <label className="field" htmlFor="refus-raison">
            Raison
            <select id="refus-raison" value={raison} onChange={(e) => setRaison(e.target.value)} data-autofocus>
              <option value="">Ne pas préciser</option>
              {raisons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor="refus-mot">
            <span>
              Un mot pour {pour} <span className="soft">(facultatif)</span>
            </span>
            <textarea id="refus-mot" rows={2} maxLength={240} value={mot} onChange={(e) => setMot(e.target.value)} placeholder={exemple} />
          </label>
          <div className="refus-apercu" aria-live="polite">
            <span className="refus-apercu-tete">
              <MessageSquareText size={14} aria-hidden="true" /> Ce que {pour} recevra
            </span>
            <p>{apercu(motif)}</p>
          </div>
        </>
      ) : (
        <p className="small soft">{sansMessage}</p>
      )}
    </Dialog>
  );
}
