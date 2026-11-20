import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import './onglets.css';

export interface Onglet {
  cle: string;
  titre: string;
  icone?: LucideIcon;
  /** Un compteur ou un état court, à droite du titre. */
  note?: ReactNode;
  contenu: ReactNode;
}

/**
 * Des onglets : quand une page porte trop de rubriques pour une seule colonne, on en montre une à la fois.
 * Tous les panneaux restent dans la page (les autres sont masqués) : une visite guidée ou un lien peut donc
 * désigner un champ d'un autre onglet, qui s'ouvre alors tout seul (voir `deplier`).
 * Chaque onglet porte son pictogramme au-dessus de son nom ; l'onglet ouvert est une tuile pleine, avec une pointe.
 * Au clavier : flèches gauche et droite, Début, Fin.
 */
export function Onglets({ id, label, onglets, defaut }: { id: string; label: string; onglets: Onglet[]; defaut?: string }): JSX.Element {
  const [actif, setActif] = useState(defaut && onglets.some((o) => o.cle === defaut) ? defaut : onglets[0]?.cle);
  const courant = onglets.some((o) => o.cle === actif) ? actif : onglets[0]?.cle;
  const aller = (cle: string): void => {
    setActif(cle);
    window.requestAnimationFrame(() => document.getElementById(`${id}-onglet-${cle}`)?.focus());
  };
  return (
    <div className="ong" id={id} data-onglets>
      <div
        className="ong-barre"
        role="tablist"
        aria-label={label}
        onKeyDown={(e) => {
          const i = onglets.findIndex((o) => o.cle === courant);
          if (e.key === 'ArrowRight') aller(onglets[(i + 1) % onglets.length].cle);
          else if (e.key === 'ArrowLeft') aller(onglets[(i - 1 + onglets.length) % onglets.length].cle);
          else if (e.key === 'Home') aller(onglets[0].cle);
          else if (e.key === 'End') aller(onglets[onglets.length - 1].cle);
          else return;
          e.preventDefault();
        }}
      >
        {onglets.map(({ cle, titre, icone: Icone, note }) => (
          <button key={cle} type="button" role="tab" id={`${id}-onglet-${cle}`} className={`ong-onglet${cle === courant ? ' on' : ''}`} aria-selected={cle === courant} aria-controls={`${id}-panneau-${cle}`} tabIndex={cle === courant ? 0 : -1} data-onglet={cle} onClick={() => setActif(cle)}>
            {Icone ? <Icone size={23} strokeWidth={1.9} aria-hidden="true" className="ong-ico" /> : null}
            <span className="ong-lib">
              <span className="ong-titre">{titre}</span>
              {note !== undefined && note !== null ? <span className="ong-note">{note}</span> : null}
            </span>
          </button>
        ))}
      </div>
      {onglets.map(({ cle, contenu }) => (
        <div key={cle} className="ong-panneau" role="tabpanel" id={`${id}-panneau-${cle}`} aria-labelledby={`${id}-onglet-${cle}`} hidden={cle !== courant} data-panneau={cle}>
          {contenu}
        </div>
      ))}
    </div>
  );
}
