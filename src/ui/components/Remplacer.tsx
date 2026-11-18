import { FileCheck2, Hourglass, Paperclip, ShieldCheck, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { dayIndex, fmtDateLong, fmtDuree, fmtHeure } from '../../domain/time';
import type { Justificatif, MotifRemplacement, Shift, Urgence } from '../../domain/types';
import { MOTIF_REMPLACEMENT_LABEL, URGENCE_LABEL } from '../../domain/types';
import { avisCollegues, delaiRemplacement, peutDemanderRemplacement } from '../../engine/remplacement';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Avatar, Dialog } from '../kit';

export const PDF_MAX = 600 * 1024;

/** Réduit une photo à 1 400 px de côté : assez pour lire un document, assez léger pour rester sur l'appareil. */
export function reduireImage(fichier: File): Promise<Justificatif> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1400 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const data = c.toDataURL('image/jpeg', 0.72);
      resolve({ nom: fichier.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', taille: Math.round((data.length * 3) / 4), data });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('illisible'));
    };
    img.src = url;
  });
}

export function lirePdf(fichier: File): Promise<Justificatif> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ nom: fichier.name, type: fichier.type, taille: fichier.size, data: String(r.result) });
    r.onerror = () => reject(new Error('illisible'));
    r.readAsDataURL(fichier);
  });
}

const DETAIL: Record<Urgence, string> = {
  prevu: 'Le poste est assez loin pour prévenir un collègue dans les règles.',
  urgent: 'Le poste est proche : votre titulaire répond d’abord, puis prévient l’équipe.',
  medical: 'Traitée en premier. Vous pouvez joindre un justificatif, maintenant ou plus tard.',
};

/** Demander à être remplacé : un niveau d'urgence, un justificatif si besoin, jamais de raison à écrire. */
export function DialogueRemplacement({ shift, onClose }: { shift: Shift; onClose: () => void }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const demander = useStore((s) => s.demanderRemplacement);
  const dire = useUi((s) => s.dire);
  const loin = peutDemanderRemplacement(data, shift.date, today);
  const delai = delaiRemplacement(data);
  const jours = dayIndex(shift.date) - dayIndex(today);
  const [urgence, setUrgence] = useState<Urgence>(loin ? 'prevu' : 'urgent');
  const [piece, setPiece] = useState<Justificatif | null>(null);
  const [erreur, setErreur] = useState('');
  /** Le motif est obligatoire : c'est le titulaire qui décide, il doit savoir pourquoi. */
  const [motif, setMotif] = useState<MotifRemplacement | ''>('');
  const [precision, setPrecision] = useState('');
  /** À qui la demande s'adresse : '' pour toute l'équipe disponible, sinon un collègue précis. */
  const [collegue, setCollegue] = useState('');
  // Pour chaque collègue : les règles sont relues et ses heures de la semaine comptées.
  const avis = useMemo(() => avisCollegues(data, shift), [data, shift]);
  const choisi = data.personnes.find((p) => p.id === collegue);
  // Une urgence médicale porte son motif ; « autre raison » demande quelques mots.
  const raison: MotifRemplacement | '' = urgence === 'medical' ? 'sante' : motif;
  const pret = !!raison && (raison !== 'autre' || precision.trim().length >= 3);
  // Un poste à moins de sept jours ne peut pas être « prévu » : il passe par une demande urgente.
  const niveaux: Urgence[] = loin ? ['prevu', 'urgent', 'medical'] : ['urgent', 'medical'];

  const joindre = async (fichier: File | undefined): Promise<void> => {
    setErreur('');
    if (!fichier) return;
    try {
      if (fichier.type.startsWith('image/')) setPiece(await reduireImage(fichier));
      else if (fichier.type === 'application/pdf') {
        if (fichier.size > PDF_MAX) return setErreur('Ce PDF dépasse 600 Ko : photographiez plutôt le document.');
        setPiece(await lirePdf(fichier));
      } else setErreur('Joignez une photo ou un PDF.');
    } catch {
      setErreur('Ce fichier n’a pas pu être lu. Essayez une photo.');
    }
  };

  return (
    <Dialog
      title="Me faire remplacer"
      subtitle={
        <>
          <span className="cap1">{fmtDateLong(shift.date).replace(/ \d{4}$/, '')}</span>, {fmtHeure(shift.start)} – {fmtHeure(shift.end)}
        </>
      }
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
            title={pret ? undefined : 'Indiquez le motif de votre demande'}
            onClick={() => {
              demander(shift, urgence, urgence === 'medical' ? (piece ?? undefined) : undefined, collegue || undefined, raison ? { motif: raison, precision } : undefined);
              dire(choisi ? `Demande envoyée à ${choisi.prenom} et à votre titulaire. Vous restez en poste tant qu’elle n’est pas validée.` : 'Demande envoyée à votre titulaire. Vous restez en poste tant qu’elle n’est pas réglée.', true);
              onClose();
            }}
          >
            Envoyer la demande
          </button>
        </>
      }
    >
      <div className={`notice ${loin ? 'info' : 'warn'} delai-info`}>
        <Hourglass size={16} aria-hidden="true" />
        <span>
          <b>{jours <= 0 ? 'Poste aujourd’hui' : jours === 1 ? 'Poste demain' : `Poste dans ${jours} jours`}.</b>{' '}
          {loin ? `Plus de ${delai} jours : vos collègues sont prévenus dans les règles.` : `Moins de ${delai} jours : seul un volontaire peut le reprendre.`}
        </span>
      </div>
      <div className="rm-motif">
        <label className="field" htmlFor="rempl-motif">
          Motif de la demande
          <select id="rempl-motif" value={raison} disabled={urgence === 'medical'} onChange={(e) => setMotif(e.target.value as MotifRemplacement | '')} aria-required="true">
            <option value="">Choisir…</option>
            {(Object.keys(MOTIF_REMPLACEMENT_LABEL) as MotifRemplacement[]).map((m) => (
              <option key={m} value={m}>
                {MOTIF_REMPLACEMENT_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor="rempl-precision">
          <span>
            Précision {raison === 'autre' ? <span className="soft">(nécessaire)</span> : <span className="soft">(facultatif)</span>}
          </span>
          <input id="rempl-precision" value={precision} maxLength={140} onChange={(e) => setPrecision(e.target.value)} placeholder="Quelques mots pour votre titulaire" />
        </label>
        <p className="aide">Votre titulaire décide. Le motif n’est visible que des titulaires ; la précision est effacée une fois la demande réglée.</p>
      </div>
      <fieldset className="choix collegues">
        <legend>À qui demander ?</legend>
        <label>
          <input type="radio" name="collegue" checked={collegue === ''} onChange={() => setCollegue('')} />
          <span className="col-pic" aria-hidden="true">
            <Users size={18} />
          </span>
          <span className="grow">
            Toute l’équipe
            <small>Votre titulaire prévient tous ceux qui peuvent reprendre le poste.</small>
          </span>
        </label>
        {avis
          .filter((c) => c.ok)
          .map((c) => {
            const p = data.personnes.find((x) => x.id === c.personId);
            if (!p) return null;
            return (
              <label key={c.personId}>
                <input type="radio" name="collegue" checked={collegue === c.personId} onChange={() => setCollegue(c.personId)} />
                <Avatar person={p} />
                <span className="grow">
                  {p.prenom} {p.nom}
                  <small>{c.contrat ? `${fmtDuree(c.avant)} → ${fmtDuree(c.apres)} cette semaine-là, pour un contrat de ${fmtDuree(c.contrat)}` : 'Titulaire, hors décompte d’heures'}</small>
                </span>
                <span className="col-avis ok">Possible</span>
              </label>
            );
          })}
        {avis.some((c) => !c.ok) ? (
          <details className="col-non">
            <summary>
              {avis.filter((c) => !c.ok).length} collègue{avis.filter((c) => !c.ok).length > 1 ? 's ne peuvent' : ' ne peut'} pas reprendre ce poste
            </summary>
            <ul>
              {avis
                .filter((c) => !c.ok)
                .map((c) => {
                  const p = data.personnes.find((x) => x.id === c.personId);
                  return p ? (
                    <li key={c.personId}>
                      <b>
                        {p.prenom} {p.nom}
                      </b>
                      <span>{c.raisons[0]}</span>
                    </li>
                  ) : null;
                })}
            </ul>
          </details>
        ) : null}
        <p className="aide">Calcul automatique : règles de repos et heures de la semaine. Dans tous les cas, votre titulaire valide.</p>
      </fieldset>
      <fieldset className="choix urgence">
        <legend>Niveau d’urgence</legend>
        {niveaux.map((u) => (
          <label key={u} className={u}>
            <input type="radio" name="urgence" checked={urgence === u} onChange={() => setUrgence(u)} />
            <span>
              {URGENCE_LABEL[u]}
              <small>{DETAIL[u]}</small>
            </span>
          </label>
        ))}
      </fieldset>

      {urgence === 'medical' ? (
        <div className="piece">
          <b>Justificatif (facultatif)</b>
          {piece ? (
            <div className="piece-fichier">
              <FileCheck2 size={18} aria-hidden="true" />
              <span className="grow">
                {piece.nom} <span className="small soft">· {Math.max(1, Math.round(piece.taille / 1024))} Ko</span>
              </span>
              <button type="button" className="btn ghost icon" onClick={() => setPiece(null)} aria-label="Retirer le justificatif">
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className="btn piece-bouton">
              <Paperclip size={15} aria-hidden="true" /> Joindre une photo ou un PDF
              <input type="file" accept="image/*,application/pdf" className="sr" onChange={(e) => void joindre(e.target.files?.[0])} />
            </label>
          )}
          {erreur ? (
            <p className="small" role="alert" style={{ color: 'var(--danger-ink)', margin: 0 }}>
              {erreur}
            </p>
          ) : null}
          <p className="notice small" style={{ margin: 0 }}>
            <ShieldCheck size={15} aria-hidden="true" />
            <span>Joignez le volet destiné à l’employeur : il ne mentionne pas le diagnostic. Seuls les titulaires le voient, et il est effacé dès que la demande est réglée.</span>
          </p>
        </div>
      ) : null}
      <p className="tiny muted">Tant que votre titulaire n’a pas validé un remplaçant, le poste reste le vôtre.</p>
    </Dialog>
  );
}
