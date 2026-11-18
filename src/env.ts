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
