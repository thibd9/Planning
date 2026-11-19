import type { AppData, Person } from '../../domain/types';
import { estResponsable, estSecondaire } from '../../domain/acces';
import animateur from '../../assets/illustrations/banniere-animateur.webp';
import apprenti from '../../assets/illustrations/banniere-apprenti.webp';
import etudiant from '../../assets/illustrations/banniere-etudiant.webp';
import pharmacie from '../../assets/illustrations/banniere-pharmacie.webp';
import pharmacien from '../../assets/illustrations/banniere-pharmacien.webp';
import preparateur from '../../assets/illustrations/banniere-preparateur.webp';
import titulaire2 from '../../assets/illustrations/banniere-titulaire2.webp';

/**
 * Les illustrations de l'application : une par profil, pour la bannière d'accueil.
 *
 * - `pharmacie` : la pharmacie de quartier du titulaire principal (maquette « Bannière 01 ») ;
 * - `titulaire2`, `pharmacien`, `preparateur`, `animateur`, `apprenti`, `etudiant` : le dessin de chaque profil.
 *
 * Un profil sans dessin (le rayonniste, pour l'instant) garde l'aplat de sa couleur. Pour en ajouter un : déposer
 * le fichier (WebP, PNG ou SVG, au format 3 pour 1) dans `src/assets/illustrations/`, l'importer ici, l'inscrire
 * dans `DESSINS` et, si besoin, dans `illustrationDuProfil`.
 */
export type NomIllustration = 'pharmacie' | 'titulaire2' | 'pharmacien' | 'preparateur' | 'animateur' | 'apprenti' | 'etudiant';

const DESSINS: Partial<Record<NomIllustration, string>> = { pharmacie, titulaire2, pharmacien, preparateur, animateur, apprenti, etudiant };

/** L'illustration de la bannière d'une personne, d'après son profil. */
export function illustrationDuProfil(data: Pick<AppData, 'officine' | 'personnes'>, p: Person | undefined): NomIllustration | undefined {
  if (!p) return undefined;
  if (estResponsable(data, p)) return 'pharmacie';
  if (estSecondaire(data, p)) return 'titulaire2';
  const parMetier: Partial<Record<Person['qualification'], NomIllustration>> = { adjoint: 'pharmacien', preparateur: 'preparateur', animateur: 'animateur', apprenti: 'apprenti', etudiant: 'etudiant' };
  return parMetier[p.qualification];
}

/** Décorative : elle n'est jamais lue par un lecteur d'écran. */
export function Illustration({ nom, className }: { nom: NomIllustration; className?: string }): JSX.Element | null {
  const src = DESSINS[nom];
  if (!src) return null;
  return <img className={`illus illus-${nom}${className ? ` ${className}` : ''}`} src={src} alt="" aria-hidden="true" decoding="async" draggable={false} />;
}
