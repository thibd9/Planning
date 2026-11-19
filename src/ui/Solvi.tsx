import { useEffect, useId, useState } from 'react';

const CORPS =
  'M13.12 -51.25 A27 27 0 1 1 51.25 -13.12 A19.6 19.6 0 0 0 51.25 13.12 A27 27 0 1 1 13.12 51.25 A19.6 19.6 0 0 0 -13.12 51.25 A27 27 0 1 1 -51.25 13.12 A19.6 19.6 0 0 0 -51.25 -13.12 A27 27 0 1 1 -13.12 -51.25 A19.6 19.6 0 0 0 13.12 -51.25 Z';
const VISAGE =
  'M90.5 64.5 Q100 53 109.5 64.5 C117 76 125 82 134.5 86.5 Q147 97.5 134.5 108.5 C125 113 117 119 109.5 130.5 Q100 142 90.5 130.5 C83 119 75 113 65.5 108.5 Q53 97.5 65.5 86.5 C75 82 83 76 90.5 64.5 Z';

/** Les humeurs de Solvi : chacune change ses yeux, et parfois ajoute un petit signe au-dessus de lui. */
export type Humeur =
  | 'neutre'
  | 'heureux'
  | 'content'
  | 'excite'
  | 'surpris'
  | 'intrigue'
  | 'reflechi'
  | 'satisfait'
  | 'confiant'
  | 'concentre'
  | 'inquiet'
  | 'triste'
  | 'fatigue'
  | 'confus'
  | 'joyeux';

const OEIL = { stroke: 'var(--solvi-oeil)', strokeWidth: 3.6, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
/** Une étoile à quatre branches. */
const etoile = (x: number, y: number, r: number): string => `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`;

/** Les yeux ouverts, en amande, avec leur reflet. `h` : hauteur ; `dy` : décalage vers le bas. */
function Ouverts({ fond, h = 18.8, dy = 0, gauche = true, droite = true }: { fond: string; h?: number; dy?: number; gauche?: boolean; droite?: boolean }): JSX.Element {
  const y = 96.8 - h / 2 + dy;
  return (
    <>
      {[gauche ? 77.8 : null, droite ? 108.2 : null].map((x) =>
        x === null ? null : (
          <g key={x}>
            <rect x={x} y={y} width="14" height={h} rx="7" fill={fond} />
            <rect x={x + 2.8} y={y + 3.2} width="5.6" height="2.4" rx="1.2" fill="#fff" transform={`rotate(-42 ${x + 5.6} ${y + 4.4})`} />
            <circle cx={x + 9.8} cy={y + h - 4.6} r="1.1" fill="#fff" opacity="0.55" />
          </g>
        ),
      )}
    </>
  );
}

/** Les yeux de chaque humeur. */
function Yeux({ humeur, fond }: { humeur: Humeur; fond: string }): JSX.Element {
  const arcs = (
    <>
      <path d="M78 100.5 Q84.8 89 91.6 100.5" {...OEIL} />
      <path d="M108.4 100.5 Q115.2 89 122 100.5" {...OEIL} />
    </>
  );
  const fermes = (
    <>
      <path d="M78 94.5 Q84.8 103.5 91.6 94.5" {...OEIL} />
      <path d="M108.4 94.5 Q115.2 103.5 122 94.5" {...OEIL} />
    </>
  );
  const miClos = (
    <>
      <path d="M78.6 97 h12.4 v2.4 a6.2 6.2 0 0 1 -12.4 0 Z" fill={fond} />
      <path d="M109 97 h12.4 v2.4 a6.2 6.2 0 0 1 -12.4 0 Z" fill={fond} />
      <path d="M76.6 95.6 H93" {...OEIL} />
      <path d="M107 95.6 H123.4" {...OEIL} />
    </>
  );
  switch (humeur) {
    case 'heureux':
    case 'joyeux':
      return arcs;
    case 'content':
      return (
        <>
          <path d="M78.4 100.8 L84.8 92.6 L91.2 100.8" {...OEIL} />
          <path d="M108.8 100.8 L115.2 92.6 L121.6 100.8" {...OEIL} />
        </>
      );
    case 'satisfait':
      return fermes;
    case 'triste':
      return (
        <>
          {fermes}
          <path d="M118.6 104 C121.6 108.4 121.8 111 118.6 112.4 C115.4 111 115.6 108.4 118.6 104 Z" style={{ fill: 'var(--solvi-3)' }} />
        </>
      );
    case 'reflechi':
    case 'fatigue':
      return miClos;
    case 'confiant':
      return (
        <>
          <Ouverts fond={fond} droite={false} />
          <path d="M108.4 99.5 Q115.2 90 122 99.5" {...OEIL} />
        </>
      );
    case 'excite':
      return (
        <>
          <rect x="77.8" y="87.4" width="14" height="18.8" rx="7" fill={fond} />
          <rect x="108.2" y="87.4" width="14" height="18.8" rx="7" fill={fond} />
          <path d={etoile(84.8, 96.8, 5.2)} fill="#fff" />
          <path d={etoile(115.2, 96.8, 5.2)} fill="#fff" />
        </>
      );
    case 'surpris':
      return (
        <>
          <Ouverts fond={fond} h={20.4} dy={-1.6} />
          <circle cx="100" cy="112.4" r="2.6" style={{ fill: 'var(--solvi-oeil)' }} />
        </>
      );
    case 'concentre':
      return (
        <>
          <Ouverts fond={fond} h={14} dy={2.6} />
          <path d="M76.4 87.6 L92.4 92.4" {...OEIL} />
          <path d="M123.6 87.6 L107.6 92.4" {...OEIL} />
        </>
      );
    case 'inquiet':
      return (
        <>
          <Ouverts fond={fond} h={16} dy={2} />
          <path d="M77 90.6 L90.6 86.2" {...OEIL} strokeWidth={3} />
          <path d="M123 90.6 L109.4 86.2" {...OEIL} strokeWidth={3} />
        </>
      );
    case 'confus':
      return (
        <>
          {[84.8, 115.2].map((x) => (
            <g key={x} {...OEIL} strokeWidth={2.2}>
              <circle cx={x} cy="96.8" r="7.4" />
              <circle cx={x} cy="96.8" r="3.3" />
            </g>
          ))}
        </>
      );
    case 'intrigue':
      // Un sourcil haut, l'autre froncé, un œil plissé et la bouche de côté : Solvi se pose la question.
      return (
        <g transform="translate(1.4 -0.8)">
          <Ouverts fond={fond} h={13.6} dy={2.8} droite={false} />
          <Ouverts fond={fond} h={21} dy={-1} gauche={false} />
          <path d="M76.6 88.8 L92 91.6" {...OEIL} strokeWidth={3.2} />
          <path d="M107 81.6 Q115.6 75.6 124 80.4" {...OEIL} strokeWidth={3.2} />
          <path d="M96.4 113.6 Q100.4 110.8 104.6 112.4" {...OEIL} strokeWidth={2.8} />
        </g>
      );
    default:
      return <Ouverts fond={fond} />;
  }
}

/** Le petit signe qui accompagne certaines humeurs, au-dessus de Solvi, à droite. */
function Signe({ humeur }: { humeur: Humeur }): JSX.Element | null {
  const trait = { stroke: 'var(--solvi-signe)', strokeWidth: 3.4, strokeLinecap: 'round', fill: 'none' } as const;
  const plein = { fill: 'var(--solvi-signe)' } as const;
  const traits = (
    <g className="solvi-signe eclat">
      <path d="M143 46 L146 36" {...trait} />
      <path d="M151 51 L159 44" {...trait} />
      <path d="M154 60 L164 58" {...trait} />
    </g>
  );
  switch (humeur) {
    case 'content':
    case 'confiant':
    case 'surpris':
      return traits;
    case 'joyeux':
      return (
        <>
          {traits}
          <g className="solvi-signe eclat">
            <path d="M50 148 L41 151" {...trait} />
            <path d="M56 156 L49 163" {...trait} />
          </g>
        </>
      );
    case 'excite':
      return (
        <g className="solvi-signe scintille">
          <path d={etoile(150, 40, 8)} style={plein} />
          <path d={etoile(161, 54, 4.6)} style={plein} />
        </g>
      );
    case 'intrigue':
      return (
        <g className="solvi-signe doute">
          <path d="M144.6 38.6 a8.4 8.4 0 1 1 11.6 7.7 q-3.4 1.7 -3.4 5.6" {...trait} strokeWidth={4.8} />
          <circle cx="152.8" cy="60.6" r="3" style={plein} />
          <path d="M165.4 30.6 a4.6 4.6 0 1 1 6.3 4.2 q-1.8 0.9 -1.8 3" {...trait} strokeWidth={2.8} opacity="0.55" />
          <circle cx="169.9" cy="42.6" r="1.7" style={plein} opacity="0.55" />
        </g>
      );
    case 'reflechi':
      return (
        <g className="solvi-signe hoche">
          <path d="M139 30 h20 a9 9 0 0 1 0 18 h-10 l-7 6 l1.4 -6 h-4.4 a9 9 0 0 1 0 -18 Z" style={plein} />
          {[143, 149, 155].map((x, i) => (
            <circle key={x} className={`solvi-point p${i}`} cx={x} cy="39" r="1.9" fill="#fff" />
          ))}
        </g>
      );
    case 'inquiet':
      return (
        <g className="solvi-signe tombe">
          <path d="M152 34 C159 44 160 50 152 54 C144 50 145 44 152 34 Z" style={plein} />
        </g>
      );
    case 'fatigue':
      return (
        <g className="solvi-signe monte">
          <path d="M142 48 h7 l-7 8 h7" {...trait} strokeWidth={2.8} strokeLinejoin="round" />
          <path d="M153 32 h9 l-9 10 h9" {...trait} strokeWidth={3.2} strokeLinejoin="round" />
        </g>
      );
    case 'confus':
      return (
        <g className="solvi-signe tourne">
          <path d="M152 46 a3 3 0 1 1 3 -3 a6.4 6.4 0 1 1 -6.4 -6.4 a9.6 9.6 0 0 1 9.6 9.6" {...trait} strokeWidth={3} />
        </g>
      );
    default:
      return null;
  }
}

/**
 * Solvi, la mascotte de l'aide. Un corps en volume (bords ombrés, reflets), un visage en creux,
 * des yeux qui clignent ; elle flotte sur place et prend la couleur du thème.
 * Purement décorative : son nom est porté par le texte qui l'accompagne.
 */
/** Un geste que l'on demande à Solvi : il le joue une fois. `cle` change à chaque demande. */
export interface GesteSolvi {
  nom: 'atterrit' | 'hoche' | 'bond' | 'salue';
  cle: number;
}
/** Les petits gestes qu'il fait de lui-même quand il attend : un coup d'œil, la tête qui penche, un petit saut, un double clin. */
const TICS = ['oeil-g', 'oeil-d', 'penche-g', 'penche-d', 'saut', 'double', 'oeil-h'] as const;
type Tic = (typeof TICS)[number];

export function Solvi({
  size = 56,
  calme = false,
  humeur = 'neutre',
  vivant = false,
  regard,
  geste,
}: {
  size?: number;
  calme?: boolean;
  humeur?: Humeur;
  /** Solvi vit sa vie quand il attend : il regarde autour de lui, penche la tête, sautille. */
  vivant?: boolean;
  /** Où il regarde, de -1 à 1 sur chaque axe : ses yeux suivent ce qu'il montre. */
  regard?: { x: number; y: number };
  geste?: GesteSolvi;
}): JSX.Element {
  const id = useId();
  const u = (nom: string): string => `url(#${id}${nom})`;
  const [tic, setTic] = useState<{ nom: Tic; cle: number } | null>(null);
  // De lui-même, à intervalles irréguliers, un petit geste : jamais deux fois le même de suite, jamais pendant un geste demandé.
  useEffect(() => {
    if (!vivant || calme) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let minuterie = 0;
    let fin = 0;
    let dernier: Tic | null = null;
    let n = 0;
    const prochain = (): void => {
      minuterie = window.setTimeout(
        () => {
          const possibles = TICS.filter((t) => t !== dernier);
          dernier = possibles[Math.floor(Math.random() * possibles.length)];
          setTic({ nom: dernier, cle: ++n });
          fin = window.setTimeout(() => setTic(null), 900);
          prochain();
        },
        2600 + Math.random() * 3200,
      );
    };
    prochain();
    return () => {
      window.clearTimeout(minuterie);
      window.clearTimeout(fin);
      setTic(null);
    };
  }, [vivant, calme]);
  // Les yeux : ce qu'on lui demande de regarder, sauf le temps d'un coup d'œil spontané.
  const coup = tic?.nom === 'oeil-g' ? { x: -1, y: 0 } : tic?.nom === 'oeil-d' ? { x: 1, y: 0 } : tic?.nom === 'oeil-h' ? { x: 0, y: -1 } : null;
  const vise = coup ?? regard ?? { x: 0, y: 0 };
  const borne = (v: number): number => Math.max(-1, Math.min(1, v));
  const mouvement = geste ? `g-${geste.nom}` : tic && !coup ? `t-${tic.nom}` : '';
  return (
    <span className={`solvi${calme ? ' calme' : ''}${vivant ? ' vivant' : ''} h-${humeur}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className="solvi-ombre" />
      <span className="solvi-corps">
        {/* Le flottement porte le corps ; les gestes se jouent à l'intérieur, sans l'interrompre. */}
        <span key={geste ? `g${geste.cle}` : tic && !coup ? `t${tic.cle}` : 'repos'} className={`solvi-geste ${mouvement}`}>
        <svg width={size} height={size} viewBox="34 32 132 132" focusable="false">
          <defs>
            <linearGradient id={`${id}c`} x1="-58" y1="14" x2="60" y2="-10" gradientUnits="userSpaceOnUse">
              <stop style={{ stopColor: 'var(--solvi-1)' }} />
              <stop offset="0.4" style={{ stopColor: 'var(--solvi-2)' }} />
              <stop offset="0.72" style={{ stopColor: 'var(--solvi-3)' }} />
              <stop offset="1" style={{ stopColor: 'var(--solvi-4)' }} />
            </linearGradient>
            {/* Le volume : le bord s'assombrit, le bas plus que le haut. */}
            <radialGradient id={`${id}v`} cx="0" cy="-8" r="66" gradientUnits="userSpaceOnUse">
              <stop offset="0.55" style={{ stopColor: 'var(--solvi-ombre)' }} stopOpacity="0" />
              <stop offset="0.86" style={{ stopColor: 'var(--solvi-ombre)' }} stopOpacity="0.18" />
              <stop offset="1" style={{ stopColor: 'var(--solvi-ombre)' }} stopOpacity="0.38" />
            </radialGradient>
            <linearGradient id={`${id}b`} x1="0" y1="-52" x2="0" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0.45" style={{ stopColor: 'var(--solvi-ombre)' }} stopOpacity="0" />
              <stop offset="1" style={{ stopColor: 'var(--solvi-ombre)' }} stopOpacity="0.26" />
            </linearGradient>
            {/* Les reflets : un grand, doux, en haut à droite ; un plus discret en haut à gauche. */}
            <radialGradient id={`${id}r`} cx="40" cy="-38" r="26" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fff" stopOpacity="0.62" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.2" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${id}q`} cx="-40" cy="-40" r="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fff" stopOpacity="0.3" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${id}o`} x1="0" y1="0" x2="0" y2="1">
              <stop style={{ stopColor: 'var(--solvi-oeil)' }} />
              <stop offset="0.55" style={{ stopColor: 'var(--solvi-oeil)' }} />
              <stop offset="1" style={{ stopColor: 'var(--solvi-oeil-2)' }} />
            </linearGradient>
            <linearGradient id={`${id}f`} x1="0" y1="56" x2="0" y2="140" gradientUnits="userSpaceOnUse">
              <stop offset="0.3" stopColor="#fff" />
              <stop offset="1" style={{ stopColor: 'var(--solvi-joue)' }} />
            </linearGradient>
            <clipPath id={`${id}k`}>
              <path d={VISAGE} />
            </clipPath>
            <filter id={`${id}fl`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.2" />
            </filter>
            <filter id={`${id}fr`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="1.1" />
            </filter>
          </defs>
          <g transform="translate(100 98)">
            {/* Sur un fond sombre, un fin contour blanc détache Solvi (voir --solvi-contour). */}
            <path className="solvi-bord" d={CORPS} fill={u('c')} />
            <path d={CORPS} fill={u('b')} />
            <path d={CORPS} fill={u('v')} />
            <path d={CORPS} fill={u('r')} />
            <path d={CORPS} fill={u('q')} />
            {/* Un éclat net sur le lobe en haut à droite. */}
            <ellipse cx="42" cy="-41" rx="9" ry="4.2" transform="rotate(38 42 -41)" fill="#fff" opacity="0.5" filter={u('fr')} />
          </g>
          {/* Le visage est en creux : le corps y porte une ombre douce, plus marquée en haut. */}
          <path d={VISAGE} fill={u('f')} />
          <g clipPath={u('k')}>
            <path d={VISAGE} fill="none" style={{ stroke: 'var(--solvi-1)' }} strokeOpacity="0.36" strokeWidth="5.5" filter={u('fl')} transform="translate(1 2.4)" />
          </g>
          {/* Les yeux changent avec l'humeur ; seuls les yeux ouverts clignent. */}
          <g className="solvi-regard" style={{ transform: `translate(${(borne(vise.x) * 3.4).toFixed(2)}px, ${(borne(vise.y) * 2.6).toFixed(2)}px)` }}>
            <g key={`${humeur}${tic?.nom === 'double' ? tic.cle : ''}`} className={`solvi-yeux${humeur === 'neutre' || humeur === 'intrigue' ? ' cligne' : ''}${tic?.nom === 'double' ? ' double' : ''}`}>
              <g transform="translate(-13 -12.6) scale(1.13)">
                <Yeux humeur={humeur} fond={u('o')} />
              </g>
            </g>
          </g>
          {/* Le signe se tient au-dessus de Solvi, à droite, hors de son corps. */}
          <g transform="translate(-7 -23) scale(1.14)">
            <Signe key={`s-${humeur}`} humeur={humeur} />
          </g>
        </svg>
        </span>
      </span>
    </span>
  );
}

/** Le nom « Solvi », dans son dessin d'origine : S, o, v, l et le fût du i ; le point du i est à part, pour porter la couleur du thème. */
const NOM_LETTRES = [
  'M129.13 191.96C97.09 212.44 44.27 208.08 14.24 185.39C7.91 180.6 2.02 175.26 0 167.25C6.66 158.49 13.27 150.15 21.41 143.59C24.99 140.7 29.34 143.79 31.91 146.32C47.77 161.92 71.09 169.12 92.49 163.7C102.6 161.14 109.59 151.76 105.56 142.27C103.11 136.5 96.95 132.91 91.22 131.23L51.43 119.59C37.06 115.39 23.77 106.69 16.79 92.9598C5.36 70.4698 13.61 43.6098 33.83 28.9998C65.89 5.83978 118.69 10.4398 147.53 36.0898C149.85 38.1498 151.79 40.7098 152.19 42.6198C152.84 45.7298 151.5 48.2298 149.53 50.6098L136.61 66.2298C135.25 67.8798 133.87 69.2398 132.22 69.7098C130.24 70.2798 127.95 69.5498 125.97 67.8298C102.15 47.0998 64.55 46.1298 58.75 65.1798C51.76 88.1298 103.45 85.9298 132.3 104.2C144.34 111.83 152.96 123.15 154.54 137.33C156.97 159.16 147.97 179.92 129.12 191.97L129.13 191.96Z',
  'M307.39 145.83C300.02 187.8 257.86 212.68 214.06 202.44C187.39 196.2 167.12 176.04 160.86 151.31C153.92 123.87 162.81 96.28 184.38 78.4C210.33 56.88 246.87 54.32 275.41 72.47C300.34 88.33 312.52 116.64 307.39 145.85V145.83ZM263.74 151.24C274.11 136.13 270.11 116.73 256.49 105.51C245.04 96.08 229.32 94.95 216.4 102.14C204.39 108.82 196.37 122.02 198.32 137C200.27 151.98 212.14 163.17 225.59 166.22C240.15 169.52 254.82 164.25 263.75 151.25L263.74 151.24Z',
  'M514.92 63.4499C518.33 63.4299 520.68 64.5399 521.74 66.3899C522.86 68.3399 522.61 70.6599 521.45 73.2799L473.66 181.92C467.81 195.21 457.87 203.11 442.77 202.49C432.77 202.07 420.42 199.13 415.68 188.77L362.07 71.4599C360.25 67.4899 364.16 63.4899 367.48 63.5099L398.54 63.7399C402.25 63.7699 406.44 66.1799 407.98 69.6999L442.53 149.06L474.26 73.1299C476.46 67.8599 480.13 64.3399 486.06 63.6399L514.93 63.4399L514.92 63.4499Z',
  'M373.61 167.41C376.64 167.21 378.73 167.41 380.17 168.02C381.38 168.53 382.23 170.82 382.2 172.8L381.71 201.38C365.5 205.87 348.19 205.56 333.58 196.48C324.11 190.59 315.66 178.59 315.42 166.13L312.42 8.99024L346.18 8.56024C350.39 8.51024 355.73 11.2502 355.78 16.4502L357.2 152.73C357.3 162.02 364.47 168.02 373.61 167.41Z',
  'M560.77 201.57L539.96 201.81C532.35 201.9 527.76 195.93 527.77 188.58L527.96 74.59C527.97 68.48 533.09 63.56 538.72 63.54L561.35 63.46C566.37 63.44 572.26 67.74 572.26 73.41L572.32 189.73C572.32 195.75 567.19 201.49 560.77 201.56V201.57Z',
];
const NOM_POINT = 'M550.04 53C564.676 53 576.54 41.1355 576.54 26.5C576.54 11.8645 564.676 0 550.04 0C535.404 0 523.54 11.8645 523.54 26.5C523.54 41.1355 535.404 53 550.04 53Z';

/**
 * Le nom de Solvi, comme un logo : les lettres prennent la couleur du texte, le point du « i » celle du thème.
 * Sa hauteur suit la taille du texte qui l'entoure.
 */
export function NomSolvi({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={`solvi-nom${className ? ` ${className}` : ''}`} viewBox="0 0 577 206" role="img" aria-label="Solvi" focusable="false">
      {NOM_LETTRES.map((d, i) => (
        <path key={i} d={d} fill="currentColor" />
      ))}
      <path d={NOM_POINT} style={{ fill: 'var(--solvi-point, var(--a-plein-2))' }} />
    </svg>
  );
}
