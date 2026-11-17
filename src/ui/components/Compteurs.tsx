import type { Suivi } from '../../engine/suivi';

/** Compteurs de présence d'une personne : retards, départs, absences par nature, remplacements assurés. */
export function Compteurs({ suivi }: { suivi: Suivi }): JSX.Element {
  const cases: { label: string; valeur: string; detail?: string; alerte?: boolean }[] = [
    { label: 'Retards', valeur: String(suivi.retards), detail: suivi.retards ? `${suivi.minutesRetard} min au total` : undefined, alerte: suivi.retards >= 3 },
    { label: 'Départs anticipés', valeur: String(suivi.departs) },
    { label: 'Absences non prévues', valeur: String(suivi.absencesImprevues), alerte: suivi.absencesImprevues >= 2 },
    { label: 'Congés', valeur: `${suivi.conges} j` },
    { label: 'Arrêts', valeur: `${suivi.arrets} j` },
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
