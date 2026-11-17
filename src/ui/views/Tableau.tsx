import { ArrowRight, Building2, CalendarRange, ListChecks, MessageSquare, MoonStar, Plus, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { memeIdentifiant } from '../../domain/acces';
import { addDays, dayIndex, fmtDateCourt, fmtDateLong, fmtDuree, fmtHeure, mondayOf, totalDuree, weekDates } from '../../domain/time';
import type { AppData } from '../../domain/types';
import { GARDE_LABEL, nomCourt } from '../../domain/types';
import { minutesTravail, ouverture, shiftsSemaine, trousPharmacien } from '../../engine/core';
import { decisions } from '../../engine/decisions';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Tuile } from '../components/Tuile';
import { EtiquetteRole } from '../icons';
import { Avatar, Pill } from '../kit';
import { echelleOfficine } from './Construire';

/** Part des minutes d'ouverture d'une semaine où un pharmacien est planifié ; null si rien n'est posé. */
function couverture(data: AppData, monday: string): number | null {
  if (!shiftsSemaine(data, monday).length) return null;
  let total = 0;
  let sans = 0;
  for (const d of weekDates(monday)) {
    total += totalDuree(ouverture(data.officine, d));
    sans += totalDuree(trousPharmacien(data, d));
  }
  return total ? Math.round(((total - sans) / total) * 100) : null;
}

/** Tableau de bord du responsable : l'état de l'officine en un écran. */
export function Tableau({ personId }: { personId: string }): JSX.Element {
  const { data, autres, officineId, today, changerOfficine } = useStore();
  const { aller, setSemaine, session } = useUi();
  const moi = data.personnes.find((p) => p.id === personId);
  const lundi = mondayOf(today);
  const d = useMemo(() => decisions(data, today), [data, today]);
  const cetteSemaine = couverture(data, lundi);
  const suivante = addDays(lundi, 7);
  const etatSuivante = data.semaines[suivante]?.statut === 'publie' ? 'Publiée' : shiftsSemaine(data, suivante).length ? 'Brouillon' : 'À construire';
  const prochaineGarde = data.gardes.filter((g) => g.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const echelle = echelleOfficine(data);
  const duJour = data.shifts.filter((s) => s.date === today).sort((a, b) => a.start - b.start);
  const absents = data.absences.filter((a) => a.statut === 'approuvee' && a.from <= today && today <= a.to);
  const nonLus = data.messages.filter((m) => !m.luPar.includes(personId) && (m.a === 'equipe' || m.a === personId)).length;
  const mesPostes = data.shifts.filter((s) => s.personId === personId && s.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const pharmacies = [{ id: officineId, d: data }, ...Object.entries(autres).map(([id, x]) => ({ id, d: x }))].filter(({ d: x }) => x.personnes.some((p) => memeIdentifiant(p.identifiant, session ?? '')));

  return (
    <div>
      <div className="hero" style={{ marginBottom: 20 }}>
        <div className="eyebrow">Tableau de bord · {fmtDateLong(today)}</div>
        <h1>Bonjour {moi?.prenom}</h1>
        <p style={{ fontSize: 16, maxWidth: '62ch' }}>{data.officine.nom} en un coup d’œil : ce qui attend une décision, la couverture de la semaine, l’équipe du jour.</p>
        <div className="row wrap" style={{ marginTop: 16 }}>
          <button type="button" className="btn primary" onClick={() => aller('resoudre')}>
            <ListChecks size={16} aria-hidden="true" /> {d.total ? `${d.total} décision${d.total > 1 ? 's' : ''} à prendre` : 'Rien à décider'}
          </button>
          <button type="button" className="btn" onClick={() => aller('construire')}>
            <CalendarRange size={16} aria-hidden="true" /> Construire la semaine
          </button>
        </div>
      </div>

      <div className="kpis">
        <button type="button" className="kpi-card" onClick={() => aller('resoudre')}>
          <span className="row">
            <span className="ico" aria-hidden="true"><ListChecks size={18} /></span>
            <span className="l">Décisions en attente</span>
          </span>
          <span className="v num">{d.total}</span>
          <span className="d">{d.total ? `${d.trous.length} absence${d.trous.length > 1 ? 's' : ''} à couvrir · ${d.remplacements.length} remplacement${d.remplacements.length > 1 ? 's' : ''} · ${d.absences.length + d.besoins.length} demande${d.absences.length + d.besoins.length > 1 ? 's' : ''}` : 'Rien à décider aujourd’hui'}</span>
        </button>
        <button type="button" className="kpi-card" onClick={() => { setSemaine(lundi); aller('construire'); }}>
          <span className="row">
            <span className="ico" aria-hidden="true"><ShieldCheck size={18} /></span>
            <span className="l">Pharmacien présent, cette semaine</span>
          </span>
          <span className="v num">{cetteSemaine === null ? '—' : `${cetteSemaine} %`}</span>
          <span className="d">{cetteSemaine === null ? 'Aucun poste posé cette semaine' : cetteSemaine === 100 ? 'Toute l’ouverture est couverte' : 'Des plages restent sans pharmacien'}</span>
        </button>
        <button type="button" className="kpi-card" onClick={() => { setSemaine(suivante); aller('construire'); }}>
          <span className="row">
            <span className="ico" aria-hidden="true"><CalendarRange size={18} /></span>
            <span className="l">Semaine prochaine</span>
          </span>
          <span className="v">{etatSuivante}</span>
          <span className="d">Commence dans {dayIndex(suivante) - dayIndex(today)} jours, le {fmtDateCourt(suivante)}</span>
        </button>
        <button type="button" className="kpi-card" onClick={() => aller('gardes')}>
          <span className="row">
            <span className="ico" aria-hidden="true"><MoonStar size={18} /></span>
            <span className="l">Prochaine garde</span>
          </span>
          <span className="v">{prochaineGarde ? fmtDateCourt(prochaineGarde.date) : 'Aucune'}</span>
          <span className="d">{prochaineGarde ? `${GARDE_LABEL[prochaineGarde.type]} · ${prochaineGarde.personId ? nomCourt(data.personnes.find((p) => p.id === prochaineGarde.personId) ?? data.personnes[0]) : 'à affecter'}` : 'Aucune garde au calendrier'}</span>
        </button>
      </div>

      <div className="dash">
        <section className="card" aria-labelledby="tb-jour">
          <div className="card-head">
            <div className="grow">
              <h2 id="tb-jour" className="h3">Aujourd’hui à l’officine</h2>
              <div className="small soft">
                {duJour.length ? `${new Set(duJour.map((s) => s.personId)).size} personnes en poste` : 'Aucun poste planifié aujourd’hui'}
                {absents.length ? ` · ${absents.length} absent${absents.length > 1 ? 's' : ''}` : ''}
              </div>
            </div>
            <button type="button" className="btn sm" onClick={() => { setSemaine(lundi); aller('construire'); }}>
              Ouvrir la semaine <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
          {duJour.length ? (
            <div>
              {duJour.map((s) => {
                const p = data.personnes.find((x) => x.id === s.personId);
                if (!p) return null;
                return (
                  <div key={s.id} className="ligne-jour">
                    <span className="row" style={{ gap: 10, minWidth: 0 }}>
                      <Avatar person={p} />
                      <span style={{ minWidth: 0 }}>
                        <b>{nomCourt(p)}</b>
                        <span style={{ display: 'block', marginTop: 3 }}>
                          <EtiquetteRole person={p} />
                        </span>
                      </span>
                    </span>
                    <Tuile data={data} s={s} person={p} echelle={echelle} />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="card-body soft">Construisez ou publiez la semaine pour voir ici l’équipe du jour.</p>
          )}
        </section>

        <div className="col" style={{ gap: 20 }}>
          <section className="card" aria-labelledby="tb-moi">
            <div className="card-head">
              <h2 id="tb-moi" className="h3 grow">Mes prochains horaires</h2>
              <button type="button" className="btn sm" onClick={() => aller('moi')}>
                Mon planning <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="card-body col">
              {mesPostes.length ? (
                mesPostes.map((s) => (
                  <div key={s.id} className="row">
                    <b className="grow cap1">{s.date === today ? 'Aujourd’hui' : fmtDateCourt(s.date)}</b>
                    <span>
                      {fmtHeure(s.start)} – {fmtHeure(s.end)}
                    </span>
                    <span className="small soft">{fmtDuree(minutesTravail(s))}</span>
                  </div>
                ))
              ) : (
                <p className="soft small">Aucun poste à venir à votre nom.</p>
              )}
            </div>
          </section>

          <section className="card pad row wrap">
            <span className="ico" aria-hidden="true"><MessageSquare size={18} /></span>
            <div className="grow">
              <h2 className="h3">Messages</h2>
              <p className="small soft">{nonLus ? `${nonLus} message${nonLus > 1 ? 's' : ''} non lu${nonLus > 1 ? 's' : ''}` : 'Aucun nouveau message'}</p>
            </div>
            {nonLus ? <Pill tone="iris">{nonLus}</Pill> : null}
            <button type="button" className="btn sm" onClick={() => aller('messages')}>
              Ouvrir
            </button>
          </section>

          <section className="card" aria-labelledby="tb-pharmacies">
            <div className="card-head">
              <span className="ico" aria-hidden="true"><Building2 size={18} /></span>
              <h2 id="tb-pharmacies" className="h3 grow">Mes pharmacies</h2>
              <button type="button" className="btn sm" onClick={() => aller('nouvelle')}>
                <Plus size={14} aria-hidden="true" /> Ajouter
              </button>
            </div>
            <div className="card-body col">
              {pharmacies.map(({ id, d: x }) => {
                const n = decisions(x, today).total;
                return (
                  <div key={id} className="row wrap">
                    <div className="grow">
                      <b>{x.officine.nom}</b>
                      <div className="small soft">
                        {x.personnes.filter((p) => !p.externe).length} personnes · {n} décision{n > 1 ? 's' : ''} en attente
                      </div>
                    </div>
                    {id === officineId ? <Pill tone="ok">Ouverte</Pill> : (
                      <button type="button" className="btn sm" onClick={() => changerOfficine(id)}>
                        Ouvrir
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
