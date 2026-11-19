import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import './accordeon.css';

/**
 * Une rubrique qui se replie : son titre, un résumé d'une ligne quand elle est fermée, et son contenu.
 * Quand une page porte beaucoup de champs, chaque rubrique devient un accordéon : on lit les résumés,
 * on ouvre celle qui intéresse. `focus` pose un repère `data-focus` pour les visites guidées.
 */
export function Accordeon({ id, titre, resume, icone: Icone, ouvert = false, focus, droite, children }: { id?: string; titre: ReactNode; resume?: ReactNode; icone?: LucideIcon; ouvert?: boolean; focus?: string; droite?: ReactNode; children: ReactNode }): JSX.Element {
  const [deplie, setDeplie] = useState(ouvert);
  return (
    <details className="acc" id={id} data-focus={focus} open={deplie} onToggle={(e) => setDeplie((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="acc-tete">
        {Icone ? (
          <span className="acc-ico" aria-hidden="true">
            <Icone size={18} />
          </span>
        ) : null}
        <span className="acc-titre">
          <b>{titre}</b>
          {resume ? <span className="acc-resume">{resume}</span> : null}
        </span>
        {droite ? <span className="acc-droite">{droite}</span> : null}
        <ChevronDown size={18} className="acc-chevron" aria-hidden="true" />
      </summary>
      <div className="acc-corps">{children}</div>
    </details>
  );
}

/** Ouvre les accordéons qui contiennent cet élément : une visite guidée ou un lien peut désigner un champ replié. */
export function deplier(el: Element | null | undefined): void {
  for (let d = el?.closest('details') ?? null; d; d = d.parentElement?.closest('details') ?? null) if (!d.open) d.open = true;
}
