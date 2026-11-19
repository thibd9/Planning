/**
 * Les illustrations de l'application.
 *
 * Chaque emplacement a un nom. Tant qu'aucun dessin n'est enregistré pour lui, rien ne s'affiche et la mise en
 * page n'en dépend pas. Pour en ajouter un : déposer le fichier (SVG, WebP ou PNG) dans
 * `src/assets/illustrations/`, l'importer ici et l'inscrire dans `DESSINS`.
 *
 * `banniere` : la pharmacie de quartier, issue de la maquette (page « Bannières »), en 1448 × 483.
 */
import banniere from '../../assets/illustrations/banniere-pharmacie.webp';

export type NomIllustration = 'banniere' | 'agenda' | 'comptoir' | 'prochain' | 'priorite';

const DESSINS: Partial<Record<NomIllustration, string>> = { banniere };

/** Décorative : elle n'est jamais lue par un lecteur d'écran. */
export function Illustration({ nom, className }: { nom: NomIllustration; className?: string }): JSX.Element | null {
  const src = DESSINS[nom];
  if (!src) return null;
  return <img className={`illus illus-${nom}${className ? ` ${className}` : ''}`} src={src} alt="" aria-hidden="true" decoding="async" draggable={false} />;
}
