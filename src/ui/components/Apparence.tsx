import { Check } from 'lucide-react';
import type { Mode } from '../../store/ui';

/** Les couleurs de chaque maquette : elles montrent un thème, elles ne suivent donc pas le thème courant. */
const MAQUETTES: Record<Exclude<Mode, 'auto'>, { fond: string; menu: string; menuTrait: string; actif: string; carte: string; trait: string; banniere: string; texte: string }> = {
  clair: { fond: '#f3f6fa', menu: '#ffffff', menuTrait: '#c9d6e4', actif: '#1a6ddb', carte: '#ffffff', trait: '#d9e2ec', banniere: '#1a6ddb', texte: '#9db0c4' },
  mixte: { fond: '#f3f6fa', menu: '#102f6b', menuTrait: '#5d7fbe', actif: '#3d8df5', carte: '#ffffff', trait: '#d9e2ec', banniere: '#1a6ddb', texte: '#9db0c4' },
  sombre: { fond: '#0e141a', menu: '#172029', menuTrait: '#3b4a5a', actif: '#4b93ee', carte: '#172029', trait: '#2a3643', banniere: '#1c4f96', texte: '#4d5f72' },
};

/** Une petite maquette de l'écran : le menu à gauche, la barre du haut, la bannière, les cartes. */
function Maquette({ mode }: { mode: Exclude<Mode, 'auto'> }): JSX.Element {
  const c = MAQUETTES[mode];
  return (
    <svg className="app-maquette" viewBox="0 0 176 112" aria-hidden="true" focusable="false">
      <rect width="176" height="112" fill={c.fond} />
      {/* Le menu */}
      <rect width="44" height="112" fill={c.menu} />
      {mode === 'clair' ? <rect x="43.5" width="0.8" height="112" fill={c.trait} /> : null}
      <circle cx="11" cy="11" r="4" fill={c.actif} />
      <rect x="18" y="8.5" width="17" height="5" rx="2.5" fill={c.menuTrait} />
      <rect x="6" y="24" width="32" height="9" rx="3" fill={c.actif} />
      {[38, 50, 62, 74, 86].map((y) => (
        <g key={y}>
          <rect x="8" y={y + 1} width="5" height="5" rx="1.5" fill={c.menuTrait} />
          <rect x="16" y={y + 2} width={y % 24 === 2 ? 14 : 19} height="3" rx="1.5" fill={c.menuTrait} opacity="0.75" />
        </g>
      ))}
      {/* La barre du haut */}
      <rect x="50" y="6" width="120" height="11" rx="3" fill={c.carte} stroke={c.trait} strokeWidth="0.8" />
      <rect x="54" y="9.5" width="20" height="4" rx="2" fill={c.actif} />
      <rect x="140" y="9.5" width="12" height="4" rx="2" fill={c.actif} />
      <circle cx="162" cy="11.5" r="2.6" fill={c.texte} />
      {/* La bannière */}
      <rect x="50" y="22" width="120" height="22" rx="4" fill={c.banniere} />
      <rect x="56" y="28" width="10" height="10" rx="2.5" fill="#fff" opacity="0.3" />
      <rect x="70" y="29" width="34" height="4" rx="2" fill="#fff" opacity="0.95" />
      <rect x="70" y="35.5" width="24" height="2.6" rx="1.3" fill="#fff" opacity="0.6" />
      {/* Les repères */}
      {[50, 81, 112, 143].map((x) => (
        <g key={x}>
          <rect x={x} y="49" width="27" height="14" rx="3" fill={c.carte} stroke={c.trait} strokeWidth="0.8" />
          <rect x={x + 3} y="53" width="6" height="6" rx="1.8" fill={c.actif} opacity="0.35" />
          <rect x={x + 11} y="54.5" width="12" height="3" rx="1.5" fill={c.texte} />
        </g>
      ))}
      {/* Les cartes */}
      <rect x="50" y="68" width="70" height="38" rx="4" fill={c.carte} stroke={c.trait} strokeWidth="0.8" />
      <rect x="55" y="74" width="30" height="3.4" rx="1.7" fill={c.texte} />
      <rect x="55" y="82" width="56" height="2.6" rx="1.3" fill={c.texte} opacity="0.55" />
      <rect x="55" y="88" width="48" height="2.6" rx="1.3" fill={c.texte} opacity="0.55" />
      <rect x="96" y="96" width="19" height="6" rx="2" fill={c.actif} />
      <rect x="125" y="68" width="45" height="38" rx="4" fill={c.carte} stroke={c.trait} strokeWidth="0.8" />
      <rect x="130" y="74" width="22" height="3.4" rx="1.7" fill={c.texte} />
      <rect x="130" y="82" width="34" height="2.6" rx="1.3" fill={c.texte} opacity="0.55" />
      <rect x="130" y="88" width="28" height="2.6" rx="1.3" fill={c.texte} opacity="0.55" />
    </svg>
  );
}

const CHOIX: { cle: Mode; nom: string; phrase: string }[] = [
  { cle: 'clair', nom: 'Clair', phrase: 'Tout l’écran est clair. Le plus lisible en plein jour.' },
  { cle: 'mixte', nom: 'Mixte', phrase: 'Le menu est foncé, le contenu reste clair.' },
  { cle: 'sombre', nom: 'Sombre', phrase: 'Tout l’écran est foncé. Repose les yeux le soir.' },
  { cle: 'auto', nom: 'Comme l’appareil', phrase: 'Clair le jour, sombre la nuit, selon le réglage de l’appareil.' },
];

/**
 * Le choix de l'apparence : une carte par thème, avec une petite maquette qui montre la différence d'un coup d'œil.
 * `auto` : proposer aussi « Comme l'appareil » (dans le compte ; inutile à la création).
 */
export function ChoixApparence({ valeur, onChange, nom = 'apparence', auto = false }: { valeur: Mode; onChange: (m: Mode) => void; nom?: string; auto?: boolean }): JSX.Element {
  return (
    <div className="app-choix" role="radiogroup" aria-label="Apparence">
      {CHOIX.filter((c) => auto || c.cle !== 'auto').map((c) => (
        <label key={c.cle} className={`app-carte${valeur === c.cle ? ' on' : ''}`} htmlFor={`${nom}-${c.cle}`}>
          <input id={`${nom}-${c.cle}`} type="radio" name={nom} checked={valeur === c.cle} onChange={() => onChange(c.cle)} />
          {c.cle === 'auto' ? (
            <span className="app-duo" aria-hidden="true">
              <Maquette mode="clair" />
              <Maquette mode="sombre" />
            </span>
          ) : (
            <Maquette mode={c.cle} />
          )}
          <span className="app-nom">
            {c.nom}
            <Check size={16} className="coche" aria-hidden="true" />
          </span>
          <span className="app-phrase">{c.phrase}</span>
        </label>
      ))}
    </div>
  );
}

/** Applique une apparence au document : le mode (clair ou sombre) et le menu foncé du thème mixte. */
export function appliquerApparence(mode: Mode, appareilSombre: boolean): void {
  const racine = document.documentElement;
  racine.dataset.mode = mode === 'sombre' || (mode === 'auto' && appareilSombre) ? 'sombre' : 'clair';
  if (mode === 'mixte') racine.dataset.menu = 'sombre';
  else delete racine.dataset.menu;
}
