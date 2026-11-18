import { Boxes, CalendarHeart, Check, ChevronLeft, ChevronRight, CircleCheck, FlaskConical, GraduationCap, History, Hourglass, Lock, Megaphone, Pill as PillIcon, Plus, Sprout } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { JOURS, JOURS_COURT, MOIS, addDays, fmtDateCourt, fmtHeure, isoWeek, mondayOf, weekday } from '../../domain/time';
import type { ISODate, Person, Qualification } from '../../domain/types';
import { ABSENCE_LABEL, SOUHAIT_LABEL, classeAbsence, couleurDuPoste, libelleGarde, nomCourt, nomGarde } from '../../domain/types';
import { IconeGarde } from '../icons';
import { ouverture } from '../../engine/core';
import { semainesDuMois } from '../../engine/payroll';
import type { Correction } from '../../engine/souhaits';
import { corrigerMois, datesDuMois, estCollaboratif, joursRestants, limiteSouhaits, moisDe, moisDecale, objectifJour, planifieMois, reponses, souhaitDe, souhaitRespecte } from '../../engine/souhaits';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Avatar, BoutonAuto, MOMENT_LABEL, Pill, momentDe } from '../kit';

const titreMois = (mois: string): string => {
  const [y, m] = mois.split('-').map(Number);
  return `${MOIS[m - 1].charAt(0).toUpperCase()}${MOIS[m - 1].slice(1)} ${y}`;
};
/** « 8h30 », « 14h » : l'heure au plus court, pour tenir dans une case. */
const court = (min: number): string => `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`;
const ABSENCE_COURT: Record<string, string> = { conge: 'Congé', arret: 'Arrêt', formation: 'Form.', absence: 'Abs.' };
const SOUHAIT_COURT: Record<string, string> = { matin: 'Matin', journee: 'Jour', soir: 'Ap.-m.', repos: 'Repos' };

/** Les lignes se rangent par poste, comme dans la grille de la semaine. */
const GROUPES: { titre: string; cles: Qualification[]; couleur: string; icone: JSX.Element }[] = [
  { titre: 'Pharmaciens', cles: ['titulaire', 'adjoint'], couleur: 'r-adjoint', icone: <PillIcon size={14} /> },
  { titre: 'Préparateurs', cles: ['preparateur'], couleur: 'r-prepa', icone: <FlaskConical size={14} /> },
  { titre: 'Animateurs', cles: ['animateur'], couleur: 'r-anim', icone: <Megaphone size={14} /> },
  { titre: 'Apprentis', cles: ['apprenti'], couleur: 'r-apprenti', icone: <Sprout size={14} /> },
  { titre: 'Étudiants', cles: ['etudiant'], couleur: 'r-etudiant', icone: <GraduationCap size={14} /> },
  { titre: 'Rayonnistes', cles: ['rayonniste'], couleur: 'r-rayon', icone: <Boxes size={14} /> },
];

/** Le mois, lisible comme la semaine : une ligne par personne, une case par jour, l'horaire écrit dedans. */
export function VueMois({ moiId }: { moiId?: string }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const appliquer = useStore((s) => s.appliquerCorrection);
  const { semaine, setSemaine, setPlanVue, voirJour, dire, seulementMoi } = useUi();
  const [mois, setMois] = useState(() => moisDe(addDays(semaine, 3)));
  const [calcul, setCalcul] = useState(false);
  const [bilan, setBilan] = useState<Correction | null>(null);
  const [preferences, setPreferences] = useState(false);
  /** Les semaines déjà passées sont rangées : elles ne reviennent que sur demande, en grisé. */
  const [anciennes, setAnciennes] = useState(false);

  const dates = useMemo(() => datesDuMois(mois), [mois]);
  const lundis = useMemo(() => semainesDuMois(mois), [mois]);
  const collaboratif = estCollaboratif(data.officine);
  const equipe = reponses(data, mois);
  const restants = joursRestants(data.officine, mois, today);
  const personnes = data.personnes.filter((p) => !p.externe && (!seulementMoi || p.id === moiId));
  const brouillons = lundis.filter((l) => data.semaines[l]?.statut !== 'publie' && addDays(l, 6) >= today);
  const fermes = useMemo(() => new Set(dates.filter((d) => ouverture(data.officine, d).length === 0)), [data.officine, dates]);
  const objectifs = useMemo(() => new Map(dates.map((d) => [d, objectifJour(data, d)])), [data, dates]);
  const parCase = useMemo(() => {
    const m = new Map<string, typeof data.shifts>();
    for (const s of data.shifts) {
      if (!s.date.startsWith(mois)) continue;
      const k = `${s.personId}|${s.date}`;
      m.set(k, (m.get(k) ?? []).concat(s));
    }
    return m;
  }, [data.shifts, mois]);
  /** Chaque semaine du mois, réduite aux jours qui tombent dans le mois, avec l'état de son planning. */
  const semaines = useMemo(
    () =>
      lundis
        .map((l) => {
          const jours = dates.filter((d) => mondayOf(d) === l);
          const construit = data.shifts.some((s) => s.date >= l && s.date <= addDays(l, 6));
          const etat = data.semaines[l]?.statut === 'publie' ? 'publie' : construit ? 'brouillon' : 'vide';
          return { lundi: l, jours, etat, passee: addDays(l, 6) < today };
        })
        .filter((s) => s.jours.length),
    [lundis, dates, data.shifts, data.semaines, today],
  );
  const passees = semaines.filter((s) => s.passee);
  // Un mois entièrement passé s'affiche en entier : il n'y aurait rien d'autre à montrer.
  const toutPasse = passees.length === semaines.length;
  const affichees = semaines.filter((s) => anciennes || toutPasse || !s.passee);
  /** Une semaine sans aucun poste tient en une colonne étroite, sauf si on regarde les préférences. */
  const repliee = (s: (typeof semaines)[number]): boolean => s.etat === 'vide' && !(collaboratif && preferences);
  const colonnes = affichees.flatMap((s) => (repliee(s) ? [{ cle: `r${s.lundi}`, sem: s, date: null as ISODate | null }] : s.jours.map((d) => ({ cle: d, sem: s, date: d as ISODate | null }))));
  const nbJours = colonnes.filter((c) => c.date).length;
  const debuts = new Set(affichees.map((s) => s.jours[0]));
  const grises = new Set(toutPasse ? [] : passees.flatMap((s) => s.jours));
  const etatDe = (d: ISODate): string => semaines.find((s) => s.lundi === mondayOf(d))?.etat ?? 'vide';

  // Le mois en cours s'ouvre sur la semaine d'aujourd'hui, sans avoir à faire défiler.
  const grille = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const zone = grille.current;
    const jour = zone?.querySelector<HTMLElement>('th.auj');
    if (zone) zone.scrollLeft = jour ? Math.max(0, jour.offsetLeft - zone.clientWidth * 0.62) : 0;
  }, [mois, anciennes]);

  const corriger = (): void => {
    setCalcul(true);
    // Le calcul prend une à deux secondes : on laisse l'écran afficher l'attente avant de le lancer.
    window.setTimeout(() => {
      const c = corrigerMois(useStore.getState().data, mois);
      appliquer(mois, c);
      setBilan(c);
      setCalcul(false);
      dire('Mois recalculé en brouillon. Rien n’est publié.', true);
    }, 60);
  };
  const ouvrirSemaine = (date: ISODate): void => {
    setSemaine(mondayOf(date));
    setPlanVue('semaine');
  };
  const changer = (n: number): void => {
    setMois(moisDecale(mois, n));
    setBilan(null);
  };
  const classeJour = (d: ISODate): string => `${fermes.has(d) ? 'ferme ' : ''}${d === today ? 'auj ' : ''}${debuts.has(d) ? 'debut ' : ''}${grises.has(d) ? 'passe ' : ''}`;

  const ligne = (p: Person): JSX.Element => {
    const h = planifieMois(data, p, mois);
    const fait = Math.round(h.minutes / 60);
    const prevu = Math.round(h.cible / 60);
    const ecart = fait - prevu;
    const ton = !h.construit ? 'vide' : Math.abs(ecart) <= 2 ? 'ok' : ecart < 0 ? 'moins' : 'plus';
    return (
      <tr key={p.id}>
        <th scope="row" className="mo-qui">
          <span className="mo-personne">
            <Avatar person={p} />
            <span className="grow" style={{ minWidth: 0 }}>
              <b>{nomCourt(p)}</b>
              {h.construit ? (
                <span className={`mo-heures num ${ton}`} title={ton === 'ok' ? 'Dans son contrat' : ton === 'moins' ? `${Math.abs(ecart)} h de moins que son contrat sur les semaines construites` : `${ecart} h de plus que son contrat sur les semaines construites`}>
                  <b>{fait} h</b> sur {prevu} h
                  <span className="mo-jauge" aria-hidden="true">
                    <i style={{ width: `${Math.min(100, prevu ? (fait / prevu) * 100 : 0)}%` }} />
                  </span>
                </span>
              ) : (
                <span className="mo-heures vide">Pas encore planifié</span>
              )}
            </span>
          </span>
        </th>
        {colonnes.map((col) => {
          if (!col.date) return <td key={col.cle} className="replie debut" />;
          const d = col.date;
          const cls = classeJour(d);
          const jour = `${JOURS[weekday(d)]} ${Number(d.slice(8))}`;
          if (fermes.has(d)) return <td key={d} className={cls} />;
          const postes = parCase.get(`${p.id}|${d}`) ?? [];
          const absence = data.absences.find((a) => a.personId === p.id && a.statut === 'approuvee' && a.from <= d && d <= a.to);
          const choix = collaboratif && preferences ? souhaitDe(data, p.id, d) : undefined;
          const garde = data.gardes.find((g) => g.personId === p.id && g.date === d);
          const marque = garde ? (
            <i className="mo-garde" title={`${libelleGarde(garde)}, à partir de ${fmtHeure(garde.start)}`}>
              <IconeGarde garde={garde} size={11} />
              <span className="sr">{nomGarde(garde)}</span>
            </i>
          ) : null;
          if (absence) {
            const c = classeAbsence(absence.type);
            return (
              <td key={d} className={cls}>
                <span className={`mo-c abs ${c}`} title={`${nomCourt(p)}, ${jour} : ${ABSENCE_LABEL[absence.type].toLowerCase()}`}>
                  {ABSENCE_COURT[c]}
                </span>
              </td>
            );
          }
          if (postes.length) {
            const debut = Math.min(...postes.map((s) => s.start));
            const fin = Math.max(...postes.map((s) => s.end));
            const choisie = postes.length === 1 ? couleurDuPoste(data.officine.postes, postes[0]) : undefined;
            const m = choisie ? `k-${choisie}` : momentDe({ start: debut, end: fin });
            const suivi = choix ? souhaitRespecte({ personId: p.id, date: d, choix }, postes) : true;
            return (
              <td key={d} className={cls}>
                <button type="button" className={`mo-c ${m}${suivi ? '' : ' ecart'}`} onClick={() => ouvrirSemaine(d)} title={`${fmtHeure(debut)} – ${fmtHeure(fin)}${choix && !suivi ? ` · préférait : ${SOUHAIT_LABEL[choix].toLowerCase()}` : ''}`}>
                  <span>{court(debut)}</span>
                  <span>{court(fin)}</span>
                  <span className="sr">
                    , {nomCourt(p)}, {jour}
                    {choix && !suivi ? `, préférence non suivie (${SOUHAIT_LABEL[choix]})` : ''}. Ouvrir la semaine
                  </span>
                </button>
                {marque}
              </td>
            );
          }
          if (garde) {
            return (
              <td key={d} className={cls}>
                <span className="mo-c garde" title={`${libelleGarde(garde)}, de ${fmtHeure(garde.start)} à ${fmtHeure(garde.end)}`}>
                  <IconeGarde garde={garde} size={13} />
                  <span>{court(garde.start)}</span>
                  <span className="sr">{nomGarde(garde)}</span>
                </span>
              </td>
            );
          }
          return (
            <td key={d} className={cls}>
              {choix ? (
                <span className="mo-c souhait" title={`Préférence : ${SOUHAIT_LABEL[choix]}`}>
                  {SOUHAIT_COURT[choix]}
                </span>
              ) : etatDe(d) !== 'vide' ? (
                <span className="mo-repos" aria-hidden="true" />
              ) : null}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="plan mois">
      <div className="plan-bar">
        <div className="week-nav">
          <button type="button" className="btn ghost icon" onClick={() => changer(-1)} aria-label="Mois précédent">
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="btn ghost icon" onClick={() => changer(1)} aria-label="Mois suivant">
            <ChevronRight size={18} />
          </button>
          <div className="label" aria-live="polite">
            {titreMois(mois)}
            <small>{brouillons.length ? `${brouillons.length} semaine${brouillons.length > 1 ? 's' : ''} en brouillon` : 'Tout est publié'}</small>
          </div>
        </div>
        {collaboratif ? (
          <>
            <span className="mo-reponses" title={equipe.attendus.length ? `Sans réponse : ${equipe.attendus.map((id) => nomCourt(data.personnes.find((p) => p.id === id)!)).join(', ')}` : 'Toute l’équipe a répondu'}>
              <CalendarHeart size={16} aria-hidden="true" />
              <span>
                <b className="num">
                  {equipe.repondu.length}/{equipe.repondu.length + equipe.attendus.length}
                </b>{' '}
                préférences reçues
              </span>
            </span>
            {restants >= 0 ? (
              <Pill tone={restants <= 3 ? 'warn' : 'ok'}>
                <Hourglass size={13} aria-hidden="true" /> {restants === 0 ? 'Dernier jour' : `${restants} j restants`}
              </Pill>
            ) : (
              <Pill tone="neutral">
                <Lock size={13} aria-hidden="true" /> Closes le {fmtDateCourt(limiteSouhaits(data.officine, mois))}
              </Pill>
            )}
          </>
        ) : null}
        <div className="right row wrap no-print" style={{ gap: 8 }}>
          <BoutonAuto onClick={corriger} disabled={calcul || !brouillons.length} occupe={calcul} focus="corriger" title={brouillons.length ? 'Recalcule les semaines en brouillon en suivant les préférences. Calcul fait sur cet appareil.' : 'Toutes les semaines du mois sont publiées'}>
            {calcul ? 'Calcul en cours…' : 'Corriger automatiquement'}
          </BoutonAuto>
        </div>
      </div>

      <div className="mo-legende">
        <span><i className="mo-pastille matin" /> {MOMENT_LABEL.matin}</span>
        <span><i className="mo-pastille milieu" /> {MOMENT_LABEL.milieu}</span>
        <span><i className="mo-pastille journee" /> {MOMENT_LABEL.journee}</span>
        <span><i className="mo-pastille soir" /> {MOMENT_LABEL.soir}</span>
        <span><i className="mo-pastille conge" /> Congé</span>
        <span><i className="mo-pastille arret" /> Arrêt</span>
        <span><i className="mo-pastille formation" /> Formation</span>
        <span><i className="mo-pastille garde" /> Garde</span>
        {passees.length && !toutPasse ? (
          <button type="button" className={`btn sm mo-anciennes no-print${anciennes ? ' on' : ''}`} aria-pressed={anciennes} onClick={() => setAnciennes(!anciennes)}>
            <History size={15} aria-hidden="true" /> {anciennes ? 'Masquer les semaines passées' : `Semaines passées (${passees.length})`}
          </button>
        ) : null}
        {collaboratif ? (
          <label className="check mo-pref no-print">
            <input type="checkbox" checked={preferences} onChange={(e) => setPreferences(e.target.checked)} />
            <span>Afficher les préférences</span>
          </label>
        ) : null}
      </div>
      {preferences ? (
        <div className="mo-legende bis small">
          <span><i className="mo-c souhait mini">Repos</i> Préférence sans poste</span>
          <span><i className="mo-point" /> Poste différent de la préférence</span>
        </div>
      ) : null}

      {bilan ? (
        <div className="notice ok mo-bilan" role="status">
          <CircleCheck size={18} aria-hidden="true" />
          <div>
            <b>Mois recalculé</b>
            <div>
              {bilan.corrigees.length} semaine{bilan.corrigees.length > 1 ? 's' : ''} en brouillon
              {bilan.souhaitsTotal ? ` · ${Math.round((bilan.souhaitsSuivis / bilan.souhaitsTotal) * 100)} % des préférences suivies` : ''}
              {bilan.publiees.length ? ` · ${bilan.publiees.length} déjà publiée${bilan.publiees.length > 1 ? 's' : ''}, non modifiée${bilan.publiees.length > 1 ? 's' : ''}` : ''}
              {bilan.bloquants ? ` · ${bilan.bloquants} point${bilan.bloquants > 1 ? 's' : ''} bloquant${bilan.bloquants > 1 ? 's' : ''} à voir` : ' · aucune règle enfreinte'}
            </div>
          </div>
        </div>
      ) : null}

      <div className="plan-scroll" data-tour="grille" data-focus="mois" tabIndex={0} ref={grille}>
        <table className={`mo ${nbJours <= 14 ? 'aise' : nbJours <= 21 ? 'moyen' : 'serre'}`} aria-label={`Planning de ${titreMois(mois)}`}>
          <thead>
            <tr className="mo-semaines">
              <th scope="col" rowSpan={2} className="mo-qui">
                Équipe
              </th>
              {affichees.map((s) =>
                repliee(s) ? (
                  <th key={s.lundi} rowSpan={2} className="debut replie">
                    <button type="button" className="mo-semaine vide" onClick={() => ouvrirSemaine(s.lundi)} title="Construire cette semaine">
                      <b>Sem. {isoWeek(s.lundi)}</b>
                      <span>
                        <Plus size={13} aria-hidden="true" /> À construire
                      </span>
                      <span className="sr"> : ouvrir la semaine</span>
                    </button>
                  </th>
                ) : (
                  <th key={s.lundi} colSpan={s.jours.length} className={`debut${s.passee && !toutPasse ? ' passe' : ''}`}>
                    <button type="button" className={`mo-semaine ${s.etat}`} onClick={() => ouvrirSemaine(s.lundi)} title="Ouvrir cette semaine">
                      <b>Sem. {isoWeek(s.lundi)}</b>
                      {s.jours.length > 2 ? <span>{s.etat === 'publie' ? 'Publiée' : s.etat === 'brouillon' ? 'Brouillon' : 'À construire'}</span> : null}
                      <span className="sr">{s.jours.length > 2 ? '' : s.etat === 'publie' ? ', publiée' : s.etat === 'brouillon' ? ', brouillon' : ', à construire'} : ouvrir la semaine</span>
                    </button>
                  </th>
                ),
              )}
            </tr>
            <tr className="mo-jours">
              {colonnes.map((col) => {
                const d = col.date;
                return !d ? null : (
                <th key={d} scope="col" className={classeJour(d)}>
                  <button type="button" className="mo-jour" onClick={() => voirJour(d)} title="Voir la journée">
                    <span>{JOURS_COURT[weekday(d)].slice(0, 3)}</span>
                    <b className="num">{Number(d.slice(8))}</b>
                    <span className="sr">, {JOURS[weekday(d)]} : voir la journée</span>
                  </button>
                </th>
                );
              })}
            </tr>
            <tr className="mo-effectif">
              <th scope="row" className="mo-qui">
                Équipe au complet ?
              </th>
              {colonnes.map((col) => {
                if (!col.date) return <td key={col.cle} className="replie debut" />;
                const d = col.date;
                const o = objectifs.get(d);
                const vide = !o || fermes.has(d) || !data.shifts.some((s) => s.date === d);
                const manque = o ? o.requis - o.present : 0;
                return (
                  <td key={d} className={classeJour(d)}>
                    {vide ? null : manque <= 0 ? (
                      <span className="mo-obj ok" title="Effectif atteint toute la journée">
                        <Check size={13} strokeWidth={3} aria-hidden="true" />
                        <span className="sr">Complet</span>
                      </span>
                    ) : (
                      <span className="mo-obj ko num" title={`Il manque ${manque} personne${manque > 1 ? 's' : ''} au comptoir au moment le plus tendu`}>
                        −{manque}
                        <span className="sr"> au comptoir</span>
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          </thead>
          {GROUPES.map((g) => {
            const membres = personnes.filter((p) => g.cles.includes(p.qualification));
            if (!membres.length) return null;
            return (
              <tbody key={g.titre}>
                {seulementMoi ? null : (
                  <tr className="mo-groupe">
                    <th scope="colgroup" colSpan={colonnes.length + 1}>
                      <span>
                        <span className={`chip-i ${g.couleur}`} aria-hidden="true">
                          {g.icone}
                        </span>
                        {g.titre}
                      </span>
                    </th>
                  </tr>
                )}
                {membres.map(ligne)}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}
