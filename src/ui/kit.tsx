import { createPortal } from 'react-dom';
import { AlarmClock, ArrowRight, CalendarCheck, Eye, EyeOff, HeartPulse, Hourglass, Sparkles, X } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { dayIndex, fmtHeure, ferie } from '../domain/time';
import type { ISODate, Interval, Mission, Person, Shift, Urgence } from '../domain/types';
import { URGENCE_LABEL, estPharmacien } from '../domain/types';
import { couleurDe } from './icons';

export type Role = 'pharma' | 'prepa' | 'autre' | 'externe';

export function roleDe(p: Person | undefined): Role {
  if (!p) return 'autre';
  if (p.externe) return 'externe';
  if (estPharmacien(p)) return 'pharma';
  if (p.qualification === 'preparateur') return 'prepa';
  return 'autre';
}

/** Champ de mot de passe avec un œil pour l'afficher : on vérifie sa saisie sans la retaper. */
export function MotDePasse(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>): JSX.Element {
  const [visible, setVisible] = useState(false);
  return (
    <span className="mdp">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button type="button" className="mdp-oeil" onClick={() => setVisible((v) => !v)} aria-pressed={visible} aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </span>
  );
}

export function Avatar({ person, lg }: { person: Person | undefined; lg?: boolean }): JSX.Element {
  const initiales = person ? `${person.prenom.charAt(0)}${person.nom.charAt(0)}` : '?';
  return (
    <span className={`avatar c ${couleurDe(person)}${lg ? ' lg' : ''}`} aria-hidden="true">
      {initiales}
    </span>
  );
}

export function Pill({ tone, children, title }: { tone?: string; children: ReactNode; title?: string }): JSX.Element {
  return (
    <span className={`pill${tone ? ` ${tone}` : ''}`} data-aide={title}>
      {children}
    </span>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}): JSX.Element {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === value ? 'on' : ''} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AvantApres({ avant, apres }: { avant: string; apres: string }): JSX.Element {
  return (
    <span className="avant-apres">
      <span className="avant">
        <span className="sr">Avant : </span>
        {avant}
      </span>
      <ArrowRight size={14} aria-hidden="true" />
      <span className="apres">
        <span className="sr">Après : </span>
        {apres}
      </span>
    </span>
  );
}

export function Dialog({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'mid' | 'wide';
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = (): HTMLElement[] =>
      el ? Array.from(el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((x) => !x.hasAttribute('disabled')) : [];
    (focusables().find((x) => x.dataset.autofocus !== undefined) ?? focusables()[1] ?? focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      precedent?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // La fenêtre est posée à la racine de la page : une carte qui la contient ne peut ni la rogner ni la déplacer.
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog${size ? ` ${size}` : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="dialog-head">
          <span className="dialog-filigrane" aria-hidden="true">
            <Logo size={190} />
          </span>
          <div className="grow">
            <h2>{title}</h2>
            {subtitle ? <p style={{ marginTop: 5 }}>{subtitle}</p> : null}
          </div>
          <button type="button" className="dialog-fermer" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer ? <div className="dialog-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export interface Echelle {
  start: number;
  end: number;
}

const pct = (e: Echelle, m: number): number => Math.max(0, Math.min(100, ((m - e.start) / (e.end - e.start)) * 100));

/** Barre de poste dessinée à l'échelle du temps, pause visible. */
/**
 * Moment d'un poste, le même partout (grille, frise, calendrier) : matin s'il finit avant 14 h 30,
 * soir s'il commence après 11 h 30, journée s'il finit avant 18 h, journée longue sinon.
 */
export type Moment = 'matin' | 'journee' | 'milieu' | 'soir';
export function momentDe(s: { start: number; end: number }): Moment {
  if (s.end <= 14 * 60 + 30) return 'matin';
  if (s.start >= 11 * 60 + 30) return 'soir';
  return s.end < 18 * 60 ? 'milieu' : 'journee';
}
export const MOMENT_LABEL: Record<Moment, string> = { matin: 'Matin', journee: 'Journée longue', milieu: 'Journée', soir: 'Soir' };

/** Heures rondes affichées sous une frise : toutes les deux heures, de l'ouverture à la fermeture. */
const graduations = (e: Echelle): number[] => {
  const out: number[] = [];
  for (let h = Math.ceil(e.start / 120) * 120; h <= e.end; h += 120) out.push(h);
  return out;
};

/** Règle graduée, posée une fois au-dessus d'une liste de frises : « 8 h · 10 h · 12 h… ». */
export function Graduations({ echelle }: { echelle: Echelle }): JSX.Element {
  return (
    <span className="graduations" aria-hidden="true">
      {graduations(echelle).map((h) => (
        <i key={h} style={{ left: `${pct(echelle, h)}%` }}>
          {fmtHeure(h)}
        </i>
      ))}
    </span>
  );
}

/**
 * Frise d'une journée : chaque poste est un bloc posé sur des repères horaires, avec son heure
 * de début et de fin écrites dedans ; la pause est hachurée. L'horaire complet est toujours écrit à côté.
 */
export function Frise({ shifts, echelle, missions = [], nuit }: { shifts: Pick<Shift, 'start' | 'end' | 'pauseStart' | 'pauseEnd'>[]; echelle: Echelle; missions?: Pick<Mission, 'start' | 'end'>[]; nuit?: boolean }): JSX.Element {
  return (
    <span className="frise" aria-hidden="true">
      {graduations(echelle).map((h) => (
        <i key={h} className="trait" style={{ left: `${pct(echelle, h)}%` }} />
      ))}
      {shifts.map((s, i) => (
        <span key={i} className={`bloc ${nuit ? 'garde' : momentDe(s)}`} style={{ left: `${pct(echelle, s.start)}%`, width: `${pct(echelle, s.end) - pct(echelle, s.start)}%` }}>
          {/* Les heures ne s'écrivent dans le bloc que s'il est assez large pour les deux. */}
          {(s.end - s.start) / (echelle.end - echelle.start) >= 0.3 ? (
            <>
              <em className="deb">{fmtHeure(s.start)}</em>
              <em className="fin">{fmtHeure(s.end)}</em>
            </>
          ) : null}
          {s.pauseStart !== undefined && s.pauseEnd !== undefined ? (
            <i className="pause" style={{ left: `${((s.pauseStart - s.start) / (s.end - s.start)) * 100}%`, width: `${((s.pauseEnd - s.pauseStart) / (s.end - s.start)) * 100}%` }} />
          ) : null}
        </span>
      ))}
      {missions.map((m, i) => (
        <i key={`m${i}`} className="rdv" style={{ left: `${pct(echelle, m.start)}%`, width: `${pct(echelle, m.end) - pct(echelle, m.start)}%` }} />
      ))}
    </span>
  );
}

export function Track({
  shifts,
  echelle,
  role,
  missions = [],
}: {
  shifts: Pick<Shift, 'start' | 'end' | 'pauseStart' | 'pauseEnd' | 'activite'>[];
  echelle: Echelle;
  role: Role | 'nuit';
  missions?: Pick<Mission, 'start' | 'end'>[];
}): JSX.Element {
  return (
    <span className="track" aria-hidden="true">
      {shifts.map((s, i) => (
        <i
          key={i}
          className={`bar-${role === 'nuit' ? 'nuit' : momentDe(s)}${s.activite !== 'comptoir' ? ' bar-back' : ''}`}
          style={{ left: `${pct(echelle, s.start)}%`, width: `${pct(echelle, s.end) - pct(echelle, s.start)}%` }}
        />
      ))}
      {shifts.map((s, i) =>
        s.pauseStart !== undefined && s.pauseEnd !== undefined ? (
          <i key={`p${i}`} className="pause" style={{ left: `${pct(echelle, s.pauseStart)}%`, width: `${pct(echelle, s.pauseEnd) - pct(echelle, s.pauseStart)}%` }} />
        ) : null,
      )}
      {missions.map((m, i) => (
        <i key={`m${i}`} className="rdvm" style={{ left: `${pct(echelle, m.start)}%`, width: `${pct(echelle, m.end) - pct(echelle, m.start)}%` }} />
      ))}
    </span>
  );
}

export function Strip({ echelle, parts }: { echelle: Echelle; parts: { cls: string; list: Interval[] }[] }): JSX.Element {
  return (
    <span className="strip" aria-hidden="true">
      {parts.flatMap((p) =>
        p.list.map((i, k) => (
          <i key={`${p.cls}${k}`} className={p.cls} style={{ left: `${pct(echelle, i.start)}%`, width: `${pct(echelle, i.end) - pct(echelle, i.start)}%` }} />
        )),
      )}
    </span>
  );
}

const SYMBOLE = 'M276.329 278.824C248.72 303.422 208.837 303.837 179.87 282.54C161.649 269.147 139.222 269.939 121.383 282.993C89.6065 306.251 47.2181 301.762 21.1007 274.466C-6.20222 245.945 -6.46992 205.162 18.3283 173.83C30.584 158.343 26.9895 135.499 15.6515 120.409C-7.90394 89.0388 -4.4432 48.0863 23.1465 21.47C50.7362 -5.14634 91.8243 -7.22132 122.989 16.3957C138.457 28.091 161.057 29.6756 176.888 17.5086C208.645 -6.86291 250.709 -5.74997 279.063 21.5831C307.246 48.7465 309.311 90.9062 284.933 122.182C270.765 140.347 274.283 162.531 287.227 179.979C310.42 211.217 305.946 252.49 276.329 278.861V278.824ZM238.759 174.679C250.441 170.434 256.789 158.796 256.349 147.761C255.928 137.386 248.644 127.747 237.574 123.634C209.544 113.184 188.36 93.698 178.092 65.5349C173.79 53.7264 164.02 45.3888 152.032 44.8983C140.044 44.4079 129.375 52.4249 124.863 64.3465C114.328 92.0758 94.4246 112.429 66.2039 122.993C54.0247 127.558 45.5356 137.216 45.6885 149.553C45.8224 160.739 53.0878 171 64.7508 175.452C93.2391 186.317 114.844 205.935 125.073 234.627C129.222 246.265 140.121 254.15 151.917 253.66C187.442 252.132 169.833 199.824 238.778 174.716L238.759 174.679Z';
const LETTRES = [
  'M520.613 226.807C503.758 252.077 465.469 262.454 435.928 259.546C403.603 256.998 374.001 243 352 219.277L373.664 183.392C383.453 192.231 392.928 200.535 404.33 206.986C417.1 213.965 430.514 218.618 445.097 219.016C461.355 219.674 481.49 214.692 483.279 198.461C485.16 181.356 467.518 173.681 451.314 169.211L415.984 159.462C394.228 153.454 372.969 140.674 366.92 118.281C359.456 90.6467 372.364 62.8438 397.371 49.3441C434.123 29.5001 481.237 34.8878 518.158 53.2088C522.869 55.5506 526.746 58.1832 530.76 61.4127L511.887 99.1721L488.28 87.0575C468.658 78.8766 442.856 72.8538 424.296 83.1469C416.06 87.7157 411.839 96.8456 415.571 105.509C417.926 110.965 422.576 115.465 428.135 117.325L449.93 124.633L484.151 134.758C492.945 137.36 500.646 141.523 508.125 146.75C521.79 156.293 530.21 170.711 531.082 187.571C531.793 201.399 528.543 214.937 520.62 226.815L520.613 226.807Z',
  'M1229.75 261.949C1199.75 259.24 1174.77 240.773 1175.56 208.976C1175.88 195.935 1180.63 184.502 1190.98 176.206C1207.76 162.752 1231.09 160.808 1252.7 161.183L1290.31 161.842C1291.82 148.212 1283.66 136.61 1271.02 132.477C1264.56 130.365 1258.12 129.37 1251.13 129.432C1232.86 129.646 1215.83 134.781 1199.57 144.707L1182.15 114.195C1194.12 105.654 1207.2 100.611 1221.35 97.1899C1248.13 91.3202 1279.72 91.0829 1304.66 102.692C1322.17 110.835 1334.2 126.317 1337.81 145.288C1339.25 152.865 1339.63 159.905 1339.66 167.795L1340.01 260.105L1293.45 260.066L1293.15 240.115C1277.74 260.273 1254.24 264.153 1229.75 261.941V261.949ZM1276.78 225.192C1284.1 220.631 1289.67 214.325 1290.89 205.968L1291.18 190.241L1250.41 188.65C1244.44 188.42 1238.77 189.736 1233.38 192.002C1223.01 196.348 1219.23 208.203 1224.61 218.06C1233.28 233.924 1260.48 234.146 1276.78 225.2V225.192Z',
  'M1122.22 208.157L1148.97 234.024C1138.68 245.687 1125.36 253.37 1110.35 257.954C1079.45 266.043 1044.67 263.112 1018.02 244.967C993.744 228.445 980.392 200.955 982.227 171.576C983.817 146.214 997.108 123.822 1018.57 110.085C1048.72 90.7768 1086.73 88.6723 1118.59 105.953C1149.69 122.819 1164.6 155.092 1159.73 190.111H1031.61C1035.82 211.769 1056.41 224.396 1078.34 224.572C1095.11 225.498 1110.17 219.33 1122.22 208.157ZM1113.92 162.653C1112.05 148.656 1103.75 139.35 1092.5 133.495C1072.43 123.883 1047.98 130.87 1036.08 149.811C1033.55 153.837 1032.05 158.115 1031.93 162.791L1113.92 162.645V162.653Z',
  'M689.845 239.656C655.7 268.247 599.967 268.041 566.679 237.368C548.662 220.761 539.731 196.991 541.023 172.456C542.484 144.63 557.457 119.177 581.805 105.493C605.275 92.3074 632.996 89.9274 658.598 97.9093C676.898 103.618 692.911 114.141 703.992 129.784C728.348 164.168 722.146 212.618 689.845 239.656ZM674.137 177.277C674.038 162.308 668.777 148.901 657.252 139.732C645.728 130.564 630.365 127.664 615.384 132.784C590.783 141.186 579.756 168.584 587.801 192.591C594.89 213.751 615.965 225.935 637.538 222.223C658.904 218.542 674.298 199.953 674.145 177.277H674.137Z',
  'M940.726 98.7282L986.991 98.9119L939.716 205.67L915.498 259.508L866.265 259.6L833.451 186.943L793.586 98.9807L841.947 98.667L865.814 152.375L891.333 210.078L940.726 98.7282Z',
  'M778.583 259.125L733.709 259.561L733.648 41.0943L778.552 40.8876L778.583 259.125Z'
];
const ACCENT = 'M1082.21 78.1572C1080.34 80.2541 1077.33 81.4173 1074.55 81.4173L1044.72 81.4403C1042.83 81.4403 1041.48 79.9021 1040.85 78.8995C1039.92 77.4225 1039.89 74.6598 1041.19 73.1369L1068.32 41.408C1071.07 38.1785 1073.72 35.4847 1078.37 35.5L1108.18 35.5765C1110.36 35.5765 1112.04 36.625 1112.97 37.9566C1113.83 39.1887 1114.52 41.959 1113.2 43.4361L1082.21 78.1496V78.1572Z';

/** Symbole Solvéa : le dessin du logo fourni, dans un dégradé qui suit la couleur du thème. Décoratif : le nom est porté par le texte voisin. */
export function Logo({ size = 38 }: { size?: number }): JSX.Element {
  const id = useId();
  return (
    <svg width={size} height={(size * 298) / 302} viewBox="0 0 302 298" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="23.8" y1="177.2" x2="285.3" y2="244.2" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: 'var(--logo-1)' }} />
          <stop offset="0.34" style={{ stopColor: 'var(--logo-2)' }} />
          <stop offset="0.74" style={{ stopColor: 'var(--logo-3)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-4)' }} />
        </linearGradient>
      </defs>
      <path d={SYMBOLE} fill={`url(#${id})`} />
    </svg>
  );
}

/** Le nom « Solvéa » dans son dessin d'origine ; les lettres prennent la couleur du texte. */
const URGENCE_TON: Record<Urgence, string> = { prevu: 'info', urgent: 'warn', medical: 'danger' };
/** Niveau d'urgence d'une demande : bleu pour le prévu, orange pour l'urgent, rouge pour l'urgence médicale. */
export function PastilleUrgence({ urgence }: { urgence: Urgence }): JSX.Element {
  const Icone = urgence === 'medical' ? HeartPulse : urgence === 'urgent' ? AlarmClock : CalendarCheck;
  return (
    <span className={`pill ${URGENCE_TON[urgence]}`}>
      <Icone size={13} aria-hidden="true" /> {URGENCE_LABEL[urgence]}
    </span>
  );
}

/** Dans combien de jours : plus c'est proche, plus la couleur est chaude. */
export function Delai({ date, today }: { date: ISODate; today: ISODate }): JSX.Element {
  const j = dayIndex(date) - dayIndex(today);
  const ton = j <= 2 ? 'danger' : j < 7 ? 'warn' : 'info';
  return (
    <span className={`pill ${ton}`}>
      <Hourglass size={12} aria-hidden="true" /> {j <= 0 ? 'Aujourd’hui' : j === 1 ? 'Demain' : `Dans ${j} jours`}
    </span>
  );
}

/** Le bouton qui lance un calcul automatique : action principale de l'écran, avec sa baguette. */
export function BoutonAuto({ onClick, disabled, occupe, children, title, focus }: { onClick: () => void; disabled?: boolean; occupe?: boolean; children: ReactNode; title?: string; focus?: string }): JSX.Element {
  return (
    <button type="button" className="btn magic" onClick={onClick} disabled={disabled} title={title} data-focus={focus}>
      {occupe ? <span className="spinner" /> : <Sparkles size={16} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

export function LogoNom({ hauteur = 22 }: { hauteur?: number }): JSX.Element {
  return (
    <svg height={hauteur} width={(hauteur * 988) / 228} viewBox="352 35 988 228" role="img" aria-label="Solvéa" focusable="false" style={{ display: 'block' }}>
      {LETTRES.map((d, i) => (
        <path key={i} d={d} fill="currentColor" />
      ))}
      <path d={ACCENT} style={{ fill: 'var(--a-deep)' }} />
    </svg>
  );
}

/** État vide illustré : dit ce qui apparaîtra ici et comment commencer. */
export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }): JSX.Element {
  return (
    <div className="card empty">
      <span className="blob" aria-hidden="true">{icon}</span>
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

/** Un jour férié se signale par son nom, partout où une date est affichée. */
export function Ferie({ date, court }: { date: ISODate; court?: boolean }): JSX.Element | null {
  const nom = ferie(date);
  if (!nom) return null;
  return (
    <span className="ferie-tag" title={`Jour férié : ${nom}`}>
      {court ? 'Férié' : nom}
      {court ? <span className="sr"> : {nom}</span> : null}
    </span>
  );
}
