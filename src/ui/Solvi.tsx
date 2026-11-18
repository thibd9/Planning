import { useId } from 'react';

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
        <g className="solvi-signe hoche">
          <path d="M146 40 a7 7 0 1 1 9.6 6.4 q-2.8 1.4 -2.8 4.6" {...trait} strokeWidth={4} />
          <circle cx="152.8" cy="58.4" r="2.5" style={plein} />
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
export function Solvi({ size = 56, calme = false, humeur = 'neutre' }: { size?: number; calme?: boolean; humeur?: Humeur }): JSX.Element {
  const id = useId();
  const u = (nom: string): string => `url(#${id}${nom})`;
  return (
    <span className={`solvi${calme ? ' calme' : ''} h-${humeur}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className="solvi-ombre" />
      <span className="solvi-corps">
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
            <path d={CORPS} fill={u('c')} />
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
          <g key={humeur} className={`solvi-yeux${humeur === 'neutre' || humeur === 'intrigue' ? ' cligne' : ''}`}>
            <g transform="translate(-13 -12.6) scale(1.13)">
              <Yeux humeur={humeur} fond={u('o')} />
            </g>
          </g>
          {/* Le signe se tient au-dessus de Solvi, à droite, hors de son corps. */}
          <g transform="translate(-7 -23) scale(1.14)">
            <Signe key={`s-${humeur}`} humeur={humeur} />
          </g>
        </svg>
      </span>
    </span>
  );
}
