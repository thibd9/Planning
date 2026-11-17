import { ArrowRight, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { Interval, Mission, Person, Shift } from '../domain/types';
import { estPharmacien } from '../domain/types';

export type Role = 'pharma' | 'prepa' | 'autre' | 'externe';

export function roleDe(p: Person | undefined): Role {
  if (!p) return 'autre';
  if (p.externe) return 'externe';
  if (estPharmacien(p)) return 'pharma';
  if (p.qualification === 'preparateur') return 'prepa';
  return 'autre';
}

export function Avatar({ person, lg }: { person: Person | undefined; lg?: boolean }): JSX.Element {
  const initiales = person ? `${person.prenom.charAt(0)}${person.nom.charAt(0)}` : '?';
  return (
    <span className={`avatar role-${roleDe(person)}${lg ? ' lg' : ''}`} aria-hidden="true">
      {initiales}
    </span>
  );
}

export function Pill({ tone, children, title }: { tone?: string; children: ReactNode; title?: string }): JSX.Element {
  return (
    <span className={`pill${tone ? ` ${tone}` : ''}`} title={title}>
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
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog${size ? ` ${size}` : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="dialog-head">
          <div className="grow">
            <h2>{title}</h2>
            {subtitle ? <p className="soft" style={{ marginTop: 5 }}>{subtitle}</p> : null}
          </div>
          <button type="button" className="btn ghost icon" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer ? <div className="dialog-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export interface Echelle {
  start: number;
  end: number;
}

const pct = (e: Echelle, m: number): number => Math.max(0, Math.min(100, ((m - e.start) / (e.end - e.start)) * 100));

/** Barre de poste dessinée à l'échelle du temps, pause visible. */
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
          className={`bar-${role}${s.activite !== 'comptoir' ? ' bar-back' : ''}`}
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

export function Logo({ size = 22 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 21.5c3.6 0 5-11 10-11s6.4 11 10 11" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="16" cy="10.5" r="2.7" fill="#FFE58A" />
    </svg>
  );
}

/** État vide illustré : dit ce qui apparaîtra ici et comment commencer. */
export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }): JSX.Element {
  return (
    <div className="card empty">
      <span className="blob">{icon}</span>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}
