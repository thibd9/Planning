import { ArrowRight, Check, Megaphone } from 'lucide-react';
import { fmtDateCourt } from '../../domain/time';
import type { Annonce, AppData } from '../../domain/types';
import { nomCourt } from '../../domain/types';

/** « à l’instant », « il y a 12 min », « hier », puis la date. */
export function ilYA(at: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60_000));
  if (min < 2) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  if (min < 60 * 24) return `il y a ${Math.round(min / 60)} h`;
  if (min < 60 * 48) return 'hier';
  return fmtDateCourt(at.slice(0, 10));
}

/** Les annonces de décision adressées à une personne, non lues d'abord puis les plus récentes. */
export const annoncesDe = (data: Pick<AppData, 'annonces'>, personId: string | undefined, nonLues = false): Annonce[] =>
  personId ? (data.annonces ?? []).filter((a) => a.pour.includes(personId) && (!nonLues || !a.luPar.includes(personId))) : [];

/**
 * Décisions annoncées : ce qui a été décidé, par qui, et ce que cela change dans les plannings.
 * `onLu` affiche le bouton « Vu » sur celles que la personne n'a pas encore lues.
 */
export function ListeAnnonces({ data, annonces, moi, onLu }: { data: Pick<AppData, 'personnes'>; annonces: Annonce[]; moi: string; onLu?: (id: string) => void }): JSX.Element {
  return (
    <ul className="annonces">
      {annonces.map((a) => {
        const auteur = data.personnes.find((p) => p.id === a.auteur);
        const neuve = !a.luPar.includes(moi);
        return (
          <li key={a.id} className={`annonce${neuve ? ' neuve' : ''}`}>
            <span className="annonce-pic" aria-hidden="true">
              <Megaphone size={16} />
            </span>
            <div className="annonce-corps">
              <b className="annonce-titre">{a.titre}</b>
              {a.effets.length ? (
                <ul className="annonce-effets" aria-label="Ce que cela change">
                  {a.effets.map((e) => (
                    <li key={e}>
                      <ArrowRight size={13} aria-hidden="true" /> <span>{e}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <span className="annonce-meta tiny muted">
                {auteur ? (a.auteur === moi ? 'Décidé par vous' : `Décidé par ${nomCourt(auteur)}`) : 'Décision'} · {ilYA(a.at)}
              </span>
            </div>
            {onLu && neuve ? (
              <button type="button" className="annonce-vu" onClick={() => onLu(a.id)} aria-label={`Vu : ${a.titre}`}>
                <Check size={14} aria-hidden="true" /> Vu
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
