import type { LucideIcon } from 'lucide-react';
import { AlarmClockCheck, HandHelping, Hand, Scale } from 'lucide-react';
import type { PointFort, PointFortCle, Suivi } from '../../engine/suivi';

const ICONE_FORT: Record<PointFortCle, LucideIcon> = { ponctuel: AlarmClockCheck, entraide: HandHelping, volontaire: Hand, part: Scale };

/** Points forts d'une personne : des faits, sans note ni classement. `court` ne garde que les titres. */
export function PointsForts({ points, court }: { points: PointFort[]; court?: boolean }): JSX.Element | null {
  if (!points.length) return null;
  return (
    <ul className={`pforts${court ? ' court' : ''}`}>
      {points.map((p) => {
        const Icone = ICONE_FORT[p.cle];
        return (
          <li key={p.cle} className="pfort" title={court ? p.detail : undefined}>
            <span className="pfort-pic" aria-hidden="true">
              <Icone size={court ? 14 : 17} />
            </span>
            <span className="pfort-corps">
              <b>{p.titre}</b>
              {court ? <span className="sr"> : {p.detail}</span> : <span className="small soft">{p.detail}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Compteurs de présence d'une personne : retards, départs, absences par nature, remplacements assurés. */
export function Compteurs({ suivi }: { suivi: Suivi }): JSX.Element {
  const cases: { label: string; valeur: string; detail?: string; alerte?: boolean }[] = [
    { label: 'Retards', valeur: String(suivi.retards), detail: suivi.retards ? `${suivi.minutesRetard} min au total` : undefined, alerte: suivi.retards >= 3 },
    { label: 'Départs anticipés', valeur: String(suivi.departs) },
    { label: 'Absences non prévues', valeur: String(suivi.absencesImprevues), alerte: suivi.absencesImprevues >= 2 },
    { label: 'Congés', valeur: `${suivi.conges} j` },
    { label: 'Arrêts', valeur: `${suivi.arrets} j`, detail: suivi.accidents ? `dont ${suivi.accidents} accident${suivi.accidents > 1 ? 's' : ''} du travail` : undefined },
    { label: 'Formations', valeur: `${suivi.formations} j` },
    { label: 'Remplacements assurés', valeur: String(suivi.remplacementsAssures) },
  ];
  return (
    <dl className="compteurs">
      {cases.map((c) => (
        <div key={c.label} className={`compteur${c.alerte ? ' alerte' : ''}`}>
          <dt>{c.label}</dt>
          <dd className="num">
            {c.valeur}
            {c.detail ? <span className="small soft"> · {c.detail}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
