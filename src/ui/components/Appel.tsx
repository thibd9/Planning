import { Check, Megaphone, Scale, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RAISONS_DECLIN, texteDeclin } from '../../domain/refus';
import { DialogueRefus } from './Refus';
import { fmtDateCourt, fmtHeure, fmtJourMois } from '../../domain/time';
import type { Remplacement, Trou } from '../../domain/types';
import { nomCourt } from '../../domain/types';
import { aSonTour, posteDe, tourDeRole } from '../../engine/appel';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Avatar, Pill } from '../kit';

const compte = (n: number): string => (n ? `${n} dépannage${n > 1 ? 's' : ''} sur 3 mois` : 'Aucun dépannage sur 3 mois');
const ordinal = (n: number): string => (n === 1 ? '1er' : `${n}e`);

/**
 * Côté responsable : l'appel à l'équipe pour une absence à couvrir.
 * Tout le monde est prévenu en même temps ; l'ordre de passage est affiché, avec la raison pour ceux qui ne sont pas sollicités.
 */
export function TourDeRole({ trou }: { trou: Trou }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { appelerEquipe, validerRemplacement } = useStore();
  const dire = useUi((s) => s.dire);
  const appel = data.remplacements.find((r) => r.trouId === trou.id && r.statut === 'ouverte');
  const tour = useMemo(() => tourDeRole(data, trou.shift, today, appel), [data, trou, today, appel]);
  const peuvent = tour.filter((c) => c.ok);
  const ecartes = tour.filter((c) => !c.ok);
  const premier = aSonTour(tour);
  const personne = (id: string) => data.personnes.find((p) => p.id === id);

  return (
    <section className="appel" data-focus="appel" aria-label="Appel à l’équipe">
      <div className="appel-tete">
        <span className="ico grad" aria-hidden="true">
          <Megaphone size={18} />
        </span>
        <div className="grow">
          <h3>Demander à toute l’équipe</h3>
          <p className="small soft">
            {appel
              ? `Appel lancé : ${peuvent.length} personne${peuvent.length > 1 ? 's' : ''} prévenue${peuvent.length > 1 ? 's' : ''} en même temps, avec le même message.`
              : 'Tous ceux qui peuvent tenir ce poste sont prévenus en même temps. Entre volontaires, il revient à celui qui a le moins dépanné.'}
          </p>
        </div>
        {!appel ? (
          <button
            type="button"
            className="btn primary"
            disabled={!peuvent.length}
            onClick={() => {
              appelerEquipe(trou.id);
              dire(`${peuvent.length} personne${peuvent.length > 1 ? 's' : ''} prévenue${peuvent.length > 1 ? 's' : ''} en même temps.`, true);
            }}
          >
            <Megaphone size={15} aria-hidden="true" /> Prévenir {peuvent.length > 1 ? `les ${peuvent.length} personnes` : peuvent.length ? 'la personne' : 'l’équipe'}
          </button>
        ) : null}
      </div>

      {peuvent.length ? (
        <ol className="appel-liste">
          {peuvent.map((c) => {
            const p = personne(c.personId);
            if (!p) return null;
            const sonTour = premier?.personId === c.personId;
            return (
              <li key={c.personId} className={sonTour ? 'tour' : ''}>
                <span className="appel-rang num" aria-label={`Rang ${c.rang}`}>
                  {c.rang}
                </span>
                <Avatar person={p} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <b>{nomCourt(p)}</b>
                  <span className="small soft" style={{ display: 'block' }}>
                    {compte(c.depannages)}
                    {c.dernier ? ` · dernier le ${fmtJourMois(c.dernier)}` : ''}
                  </span>
                </span>
                {appel ? (
                  c.volontaire ? (
                    <>
                      {sonTour ? (
                        <Pill tone="ok">
                          <Scale size={13} aria-hidden="true" /> À son tour
                        </Pill>
                      ) : (
                        <Pill tone="miel">Volontaire</Pill>
                      )}
                      <button
                        type="button"
                        className={`btn sm${sonTour ? ' primary' : ''}`}
                        onClick={() => {
                          validerRemplacement(appel.id, c.personId);
                          dire(`Poste confié à ${nomCourt(p)}. Les autres volontaires sont remerciés et gardent leur rang.`, true);
                        }}
                      >
                        {sonTour ? 'Confier' : 'Confier hors tour'}
                      </button>
                    </>
                  ) : c.indisponible ? (
                    <Pill>
                      <X size={13} aria-hidden="true" /> Ne peut pas
                    </Pill>
                  ) : (
                    <span className="small soft">Pas encore répondu</span>
                  )
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="small soft" style={{ margin: '10px 0 0' }}>Personne dans l’équipe ne peut tenir ce poste sans enfreindre une règle : voyez les options ci-dessous.</p>
      )}

      {ecartes.length ? (
        <details className="plus">
          <summary>Pourquoi {ecartes.length} personne{ecartes.length > 1 ? 's ne sont' : ' n’est'} pas sollicitée{ecartes.length > 1 ? 's' : ''}</summary>
          <ul className="appel-raisons">
            {ecartes.map((c) => {
              const p = personne(c.personId);
              return p ? (
                <li key={c.personId}>
                  <b>{nomCourt(p)}</b> : {c.raisons[0]}
                </li>
              ) : null;
            })}
          </ul>
        </details>
      ) : null}
      <p className="tiny muted" style={{ margin: '10px 0 0' }}>
        À moins de sept jours, un changement d’horaire demande l’accord de la personne : seul un volontaire peut être désigné. Dire non ne change le rang de personne.
      </p>
    </section>
  );
}

/** Côté équipe : l'appel reçu, avec son propre rang, et deux réponses qui n'engagent à rien. */
export function AppelRecu({ appel, personId }: { appel: Remplacement; personId: string }): JSX.Element | null {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { seProposer, declinerAppel } = useStore();
  const dire = useUi((s) => s.dire);
  const poste = posteDe(data, appel);
  const tour = useMemo(() => (poste ? tourDeRole(data, poste, today, appel) : []), [data, poste, today, appel]);
  const moi = tour.find((c) => c.personId === personId);
  const [refus, setRefus] = useState(false);
  const chef = data.personnes.find((p) => p.id === data.officine.responsableId);
  if (!poste || !moi) return null;
  const peuvent = tour.filter((c) => c.ok).length;
  return (
    <div className="decision appel-recu" style={{ alignItems: 'center' }}>
      <div className="grow">
        <Pill tone="danger">Absence à couvrir</Pill>{' '}
        <b className="cap1">{fmtDateCourt(appel.date)}</b> · <span className="num">{fmtHeure(appel.start)} – {fmtHeure(appel.end)}</span>
        <div className="small soft" style={{ marginTop: 4 }}>
          {moi.ok
            ? `Les ${peuvent} personnes qui peuvent tenir ce poste ont reçu le même message. Votre rang : ${ordinal(moi.rang ?? 1)} sur ${peuvent} (${compte(moi.depannages).toLowerCase()}).`
            : `Vous n’êtes plus sollicité : ${moi.raisons[0]?.toLowerCase() ?? 'une règle l’empêche.'}`}
        </div>
      </div>
      {!moi.ok ? null : moi.volontaire ? (
        <>
          <Pill tone="ok">
            <Check size={13} aria-hidden="true" /> Vous êtes volontaire
          </Pill>
          <button type="button" className="btn sm" onClick={() => seProposer(appel.id, personId, false)}>
            Retirer
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="btn primary sm"
            onClick={() => {
              seProposer(appel.id, personId, true);
              dire('Merci. Le responsable choisit selon le tour de rôle.', true);
            }}
          >
            Je peux
          </button>
          {moi.indisponible ? (
            <Pill>Vous avez répondu non</Pill>
          ) : (
            <button type="button" className="btn sm" onClick={() => setRefus(true)}>
              Je ne peux pas
            </button>
          )}
        </>
      )}
      {refus ? (
        <DialogueRefus
          titre="Répondre non"
          quoi={`Poste à couvrir ${fmtDateCourt(appel.date)}, ${fmtHeure(appel.start)} – ${fmtHeure(appel.end)}`}
          raisons={RAISONS_DECLIN}
          pour={chef?.prenom ?? 'votre titulaire'}
          apercu={(m) => texteDeclin(`${fmtDateCourt(appel.date)}, ${fmtHeure(appel.start)} – ${fmtHeure(appel.end)}`, m)}
          bouton="Répondre non"
          exemple="Par exemple : je peux le lendemain."
          sansMessage="Votre réponse est notée, sans message. Dire non ne change pas votre rang dans le tour de rôle."
          onClose={() => setRefus(false)}
          onConfirmer={(motif) => {
            declinerAppel(appel.id, personId, motif);
            dire('C’est noté. Votre rang ne change pas.');
          }}
        />
      ) : null}
    </div>
  );
}
