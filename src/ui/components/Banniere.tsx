import type { ReactNode } from 'react';
import type { Person } from '../../domain/types';
import { Avatar, Logo } from '../kit';
import type { NomIllustration } from './Illustration';
import { Illustration } from './Illustration';

/**
 * La bannière d'accueil : un aplat aux couleurs du profil, qui porte le portrait de la personne, son nom,
 * son rôle et sa pharmacie, puis ce qui l'attend. Dessous, une ligne de repères, chacun dans sa carte.
 * Elle porte l'illustration du profil quand il en a une (voir `Illustration`).
 */
export function BanniereAccueil({ personne, date, role, resume, illustration, children }: { personne: Person | undefined; date: string; role: string; resume?: ReactNode; illustration?: NomIllustration; children?: ReactNode }): JSX.Element {
  return (
    <header className="tb-banniere">
      {/* Le bloc d'accueil : un seul aplat aux couleurs du profil, qui porte le nom, le rôle et ce qui attend. */}
      <div className={`tb-couverture${illustration ? ` illustree ill-${illustration}` : ''}`}>
        {/* Le dessin du profil, révélé au centre entre deux fondus de sa couleur (maquette « Bannière 01 » pour la pharmacie). */}
        {illustration ? (
          <span className="tb-scene" aria-hidden="true">
            <Illustration nom={illustration} className="tb-scene-image" />
            <span className="tb-scene-harmonie" />
            <span className="tb-scene-fondu" />
            <span className="tb-scene-lumiere" />
            <span className="tb-scene-lisible" />
          </span>
        ) : null}
        <span className="tb-decor" aria-hidden="true">
          <span className="tb-forme f1">
            <Logo size={300} />
          </span>
          <span className="tb-forme f2">
            <Logo size={170} />
          </span>
          <span className="tb-forme f3">
            <Logo size={90} />
          </span>
        </span>
        <span className="tb-portrait">
          <Avatar person={personne} lg />
        </span>
        <div className="tb-nom">
          <div className="eyebrow">{date}</div>
          <h1>
            Bonjour {personne?.prenom} <span className="tb-salut" aria-hidden="true">👋</span>
          </h1>
          <p className="tb-role">{role}</p>
        </div>
        {resume ? <p className="tb-resume">{resume}</p> : null}
      </div>
      {children}
    </header>
  );
}
