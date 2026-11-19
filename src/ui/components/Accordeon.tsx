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

/** Ouvre l'onglet et les accordéons qui contiennent cet élément : une visite guidée ou un lien peut désigner un champ masqué. */
export function deplier(el: Element | null | undefined): void {
  if (!el) return;
  // L'onglet d'abord : son panneau est montré tout de suite, et le clic met l'état de l'onglet d'accord.
  for (let p = el.closest<HTMLElement>('[role="tabpanel"][data-panneau]'); p; p = p.parentElement?.closest<HTMLElement>('[role="tabpanel"][data-panneau]') ?? null) {
    if (!p.hidden) continue;
    for (const frere of p.parentElement?.querySelectorAll<HTMLElement>(':scope > [role="tabpanel"][data-panneau]') ?? []) frere.hidden = frere !== p;
    document.getElementById(p.getAttribute('aria-labelledby') ?? '')?.click();
  }
  for (let d = el.closest('details'); d; d = d.parentElement?.closest('details') ?? null) if (!d.open) d.open = true;
}
