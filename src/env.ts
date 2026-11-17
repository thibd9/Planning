/**
 * Vrai quand l'application est publiée dans un cadre hébergé restreint (page claude.ai) :
 * l'impression et les téléchargements lancés par la page y sont bloqués.
 */
export const HEBERGE: boolean = import.meta.env.VITE_ARTIFACT === '1';
