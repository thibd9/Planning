import { mondayOf } from '../domain/time';
import type { ISODate } from '../domain/types';
import { useUi } from '../store/ui';
import { deplier } from './components/Accordeon';

/** Les endroits du planning que l'on peut désigner. */
export const CIBLE = {
  /** La case signalée dans la grille (voir `focus` dans le magasin d'interface). */
  case: '.pg-c.flag, .pg-o.flag',
  publier: "[data-focus='publier']",
  grille: "[data-tour='grille']",
} as const;

let enCours: { el: HTMLElement; fin: number } | null = null;

/**
 * Amène un endroit de l'écran sous les yeux : on le fait défiler au centre, on l'entoure quelques secondes
 * et on y place le clavier. L'endroit peut ne pas être encore affiché : on l'attend un court instant.
 */
export function viser(selecteur: string, essais = 25): void {
  const tenter = (reste: number): void => {
    const el = document.querySelector<HTMLElement>(selecteur);
    // L'endroit peut être dans une rubrique repliée : on l'ouvre d'abord.
    deplier(el);
    if (!el) {
      if (reste > 0) window.setTimeout(() => tenter(reste - 1), 80);
      return;
    }
    if (enCours) {
      window.clearTimeout(enCours.fin);
      enCours.el.classList.remove('vise');
    }
    const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Un grand bloc (la grille) se cale en haut ; un petit se centre.
    const grand = el.getBoundingClientRect().height > window.innerHeight * 0.6;
    el.scrollIntoView({ block: grand ? 'start' : 'center', inline: 'center', behavior: calme ? 'auto' : 'smooth' });
    el.classList.add('vise');
    if (!el.matches('button, a, input, select, textarea, [tabindex]')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    const fin = window.setTimeout(() => {
      el.classList.remove('vise');
      enCours = null;
    }, 4200);
    enCours = { el, fin };
  };
  // Le temps que l'écran de destination s'affiche.
  window.requestAnimationFrame(() => tenter(essais));
}

/**
 * Ouvre « Construire » sur la semaine voulue et désigne l'endroit à régler :
 * la case d'une personne un jour donné, la ligne d'un jour, le bouton « Publier » ou la grille entière.
 */
export function montrerDansPlanning(ou: { date: ISODate; personId?: string; cible?: keyof typeof CIBLE }): void {
  const ui = useUi.getState();
  ui.setPlanVue('semaine');
  ui.setSeulementMoi(false);
  ui.setSemaine(mondayOf(ou.date));
  ui.aller('construire');
  const cible = ou.cible ?? 'case';
  if (cible === 'case') ui.setFocus({ ...(ou.personId ? { personId: ou.personId } : {}), date: ou.date });
  viser(CIBLE[cible]);
}
