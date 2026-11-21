/**
 * Vrai quand l'application est publiée dans un cadre hébergé restreint (page claude.ai) :
 * l'impression et les téléchargements lancés par la page y sont bloqués.
 */
export const HEBERGE: boolean = import.meta.env.VITE_ARTIFACT === '1';

/**
 * Lance l'impression. Dans un aperçu hébergé, le navigateur peut la bloquer sans le dire :
 * on prévient alors la personne plutôt que de laisser un bouton sans effet.
 */
export function imprimer(prevenir: (message: string) => void): void {
  try {
    window.print();
  } catch {
    // Le blocage se traduit parfois par une exception : le message ci-dessous l'explique.
  }
  if (HEBERGE) prevenir('Si rien ne s’ouvre, l’aperçu hébergé bloque l’impression : elle fonctionne dans l’application installée.');
}

/**
 * Réglages réservés aux contrôles automatiques : le navigateur de test les pose avant le chargement de la page.
 * Un utilisateur n'en a jamais : Solvéa démarre alors sur la connexion, avec la fenêtre « Version de test ».
 * garderSession : les contrôles rechargent la page en cours de route et doivent rester connectés.
 * sansAvis : la fenêtre « Version de test » ne s'ouvre pas.
 */
export interface ReglagesTest {
  garderSession?: boolean;
  sansAvis?: boolean;
}
export function reglagesTest(): ReglagesTest {
  if (typeof window === 'undefined') return {};
  return (window as unknown as { __solveaTest?: ReglagesTest }).__solveaTest ?? {};
}
