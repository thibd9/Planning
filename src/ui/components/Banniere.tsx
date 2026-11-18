import type { ReactNode } from 'react';
import type { Person } from '../../domain/types';
import { Avatar, Logo } from '../kit';

/**
 * La bannière d'accueil : une couverture aux couleurs du profil, le portrait de la personne posé dessus,
 * son nom, son rôle et sa pharmacie. Dessous, une ligne de repères, discrète. Elle accueille ; elle ne
 * demande rien : ce qu'il faut faire en premier vient juste après, dans un seul bloc.
 */
export function BanniereAccueil({ personne, date, role, resume, children }: { personne: Person | undefined; date: string; role: string; resume?: ReactNode; children?: ReactNode }): JSX.Element {
  return (
    <header className="tb-banniere">
      <div className="tb-couverture" aria-hidden="true">
        <span className="tb-forme f1">
          <Logo size={300} />
        </span>
        <span className="tb-forme f2">
          <Logo size={170} />
        </span>
        <span className="tb-forme f3">
          <Logo size={90} />
        </span>
      </div>
      <div className="tb-identite">
        <span className="tb-portrait">
          <Avatar person={personne} lg />
        </span>
        <div className="tb-nom">
          <div className="eyebrow">{date}</div>
          <h1>Bonjour {personne?.prenom}</h1>
          <p className="tb-role">{role}</p>
        </div>
        {resume ? <p className="tb-resume">{resume}</p> : null}
      </div>
      {children}
    </header>
  );
}
