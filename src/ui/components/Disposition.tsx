import { Check } from 'lucide-react';
import type { Disposition } from '../../store/ui';

/** Les couleurs des maquettes : elles montrent une disposition, elles ne suivent donc pas le thème courant. */
const C = { fond: '#f3f6fa', carte: '#ffffff', trait: '#d9e2ec', banniere: '#1a6ddb', texte: '#9db0c4', actif: '#1a6ddb', alerte: '#f6d9d5', alerteTrait: '#e3a59d', barre: '#ffd9a8', barre2: '#d9c9f5' };

function Carte({ x, y, w, h, alerte = false }: { x: number; y: number; w: number; h: number; alerte?: boolean }): JSX.Element {
  return <rect x={x} y={y} width={w} height={h} rx="3" fill={alerte ? C.alerte : C.carte} stroke={alerte ? C.alerteTrait : C.trait} strokeWidth="0.8" />;
}
/** Quelques lignes de texte dans une carte. */
function Lignes({ x, y, w, n = 2 }: { x: number; y: number; w: number; n?: number }): JSX.Element {
  return (
    <>
      <rect x={x} y={y} width={w * 0.5} height="2.6" rx="1.3" fill={C.texte} />
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={x} y={y + 6 + i * 5} width={w * (i % 2 ? 0.7 : 0.9)} height="2" rx="1" fill={C.texte} opacity="0.5" />
      ))}
    </>
  );
}
/** L'équipe du jour : une barre par personne. */
function Equipe({ x, y, w, n }: { x: number; y: number; w: number; n: number }): JSX.Element {
  return (
    <>
      <rect x={x} y={y} width={w * 0.4} height="2.6" rx="1.3" fill={C.texte} />
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <rect x={x} y={y + 7 + i * 5.5} width="9" height="2.4" rx="1.2" fill={C.texte} opacity="0.6" />
          <rect x={x + 13 + (i > 1 ? w * 0.18 : 0)} y={y + 6.4 + i * 5.5} width={w * (i > 1 ? 0.5 : 0.42)} height="3.6" rx="1.2" fill={i > 1 ? C.barre2 : C.barre} />
        </g>
      ))}
    </>
  );
}

function Maquette({ disposition }: { disposition: Disposition }): JSX.Element {
  return (
    <svg className="app-maquette" viewBox="0 0 176 112" aria-hidden="true" focusable="false">
      <rect width="176" height="112" fill={C.fond} />
      {/* La bannière et les repères, communs aux deux dispositions */}
      <rect x="6" y="6" width="164" height="18" rx="3" fill={C.banniere} />
      <rect x="12" y="11" width="34" height="3.4" rx="1.7" fill="#fff" opacity="0.95" />
      <rect x="12" y="17" width="22" height="2.4" rx="1.2" fill="#fff" opacity="0.6" />
      {[6, 39.5, 73, 106.5, 140].map((x) => (
        <rect key={x} x={x} y="28" width="30" height="9" rx="2.5" fill={C.carte} stroke={C.trait} strokeWidth="0.8" />
      ))}
      {disposition === 'comptoir' ? (
        <>
          {/* L'équipe du jour à gauche, les décisions à droite */}
          <Carte x={6} y={41} w={104} h={38} />
          <Equipe x={11} y={46} w={92} n={5} />
          <Carte x={114} y={41} w={56} h={14} alerte />
          <rect x="118" y="45" width="24" height="2.6" rx="1.3" fill={C.alerteTrait} />
          <rect x="118" y="49.5" width="18" height="3" rx="1.5" fill={C.actif} />
          <Carte x={114} y={58} w={56} h={21} />
          <Lignes x={118} y={62} w={46} n={2} />
          {/* Le planning à préparer et mon agenda */}
          <Carte x={6} y={83} w={104} h={23} />
          <Lignes x={11} y={88} w={60} n={2} />
          <rect x="88" y="87" width="17" height="5" rx="2" fill={C.actif} opacity="0.35" />
          <Carte x={114} y={83} w={56} h={23} />
          <Lignes x={118} y={88} w={46} n={2} />
        </>
      ) : (
        <>
          {/* La priorité et mon agenda d'abord */}
          <Carte x={6} y={41} w={92} h={14} alerte />
          <rect x="11" y="45" width="34" height="2.6" rx="1.3" fill={C.alerteTrait} />
          <rect x="74" y="45" width="19" height="5" rx="2" fill={C.actif} />
          <Carte x={6} y={58} w={92} h={12} />
          <rect x="11" y="62.5" width="40" height="2.6" rx="1.3" fill={C.texte} />
          <Carte x={102} y={41} w={68} h={29} />
          <Lignes x={107} y={46} w={56} n={3} />
          {/* Les décisions, puis l'équipe du jour */}
          <Carte x={6} y={74} w={70} h={32} />
          <Lignes x={11} y={79} w={58} n={3} />
          <Carte x={80} y={74} w={90} h={32} />
          <Equipe x={85} y={79} w={78} n={4} />
        </>
      )}
    </svg>
  );
}

const CHOIX: { cle: Disposition; nom: string; phrase: string }[] = [
  { cle: 'comptoir', nom: 'Comptoir et décisions', phrase: 'L’équipe du jour à gauche, ce qui attend votre décision à droite. Dessous, le planning à préparer et votre agenda.' },
  { cle: 'classique', nom: 'Priorité d’abord', phrase: 'La chose à faire en premier et votre agenda en tête. Dessous, les décisions, puis l’équipe du jour.' },
];

/** Le choix de la disposition du tableau de bord : une carte par disposition, avec une petite maquette. */
export function ChoixDisposition({ valeur, onChange }: { valeur: Disposition; onChange: (d: Disposition) => void }): JSX.Element {
  return (
    <div className="app-choix" id="choix-disposition" role="radiogroup" aria-label="Disposition du tableau de bord">
      {CHOIX.map((c) => (
        <label key={c.cle} className={`app-carte${valeur === c.cle ? ' on' : ''}`} htmlFor={`disposition-${c.cle}`}>
          <input id={`disposition-${c.cle}`} type="radio" name="disposition" checked={valeur === c.cle} onChange={() => onChange(c.cle)} />
          <Maquette disposition={c.cle} />
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
