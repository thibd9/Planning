import { ArrowLeftRight, ArrowRight, Building2, CalendarRange, Check, Handshake, Hourglass, MoonStar, ShieldCheck, UserMinus } from 'lucide-react';
import { useMemo } from 'react';
import { libelleRole, memeIdentifiant } from '../../domain/acces';
import { addDays, fmtDateCourt, fmtDateLong, fmtHeure, fmtSemaine, mondayOf, totalDuree, weekDates } from '../../domain/time';
import type { AppData } from '../../domain/types';
import { nomCourt } from '../../domain/types';
import { ouverture, shiftsSemaine, trousPharmacien } from '../../engine/core';
import { decisions } from '../../engine/decisions';
import { aRegulariser, semaineLibre } from '../../engine/heures';
import { estCollaboratif, moisDe, reponses } from '../../engine/souhaits';
import { validateWeek } from '../../engine/validate';
import { useStore } from '../../store/store';
import { ListeAnnonces, annoncesDe } from '../components/Annonces';
import { Solvi } from '../Solvi';
import { useUi } from '../../store/ui';
import { Avatar, Pill, momentDe } from '../kit';

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
  const { aller, setSemaine, session, setSujet, voirJour } = useUi();
  const moi = data.personnes.find((p) => p.id === personId);
  const lundi = mondayOf(today);
  const d = useMemo(() => decisions(data, today), [data, today]);
  const lireAnnonces = useStore((x) => x.lireAnnonces);
  // Les six dernières décisions annoncées, lues ou non.
  const recentes = annoncesDe(data, personId).slice(0, 6);
  const cetteSemaine = couverture(data, lundi);
  const heures = useMemo(() => aRegulariser(data, today).length, [data, today]);
  const suivante = addDays(lundi, 7);
  const etatSuivante = data.semaines[suivante]?.statut === 'publie' ? 'Publiée' : shiftsSemaine(data, suivante).length ? 'Brouillon' : 'À construire';
  const prochaineGarde = data.gardes.filter((g) => g.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const duJour = data.shifts.filter((s) => s.date === today).sort((a, b) => a.start - b.start);
  const absents = data.absences.filter((a) => a.statut === 'approuvee' && a.from <= today && today <= a.to);
  const pharmacies = [{ id: officineId, d: data }, ...Object.entries(autres).map(([id, x]) => ({ id, d: x }))].filter(({ d: x }) => x.personnes.some((p) => memeIdentifiant(p.identifiant, session ?? '')));

  // Les décisions, rangées par sujet : chaque ligne ouvre le bon onglet de « Résoudre ».
  const sujets: { cle: string; label: string; nombre: number; icone: JSX.Element }[] = [
    { cle: 'accords', label: 'Accords à donner', nombre: d.accords.length, icone: <Handshake size={18} /> },
    { cle: 'absences', label: 'Absences à couvrir', nombre: d.trous.length, icone: <UserMinus size={18} /> },
    { cle: 'remplacements', label: 'Remplacements', nombre: d.remplacements.length, icone: <ArrowLeftRight size={18} /> },
    { cle: 'demandes', label: 'Demandes de l’équipe', nombre: d.absences.length + d.besoins.length, icone: <Check size={18} /> },
    { cle: 'gardes', label: 'Gardes', nombre: d.gardesAAffecter.length + d.gardesRepos.length + d.gardesAbsence.length + d.gardesAValider.length, icone: <MoonStar size={18} /> },
    { cle: 'publications', label: 'Plannings à publier', nombre: d.publications.length, icone: <CalendarRange size={18} /> },
  ].filter((x) => x.nombre > 0);
  const ouvrir = (cle: string): void => {
    setSujet(cle);
    aller('resoudre');
  };
  const enPoste = [...new Map(duJour.map((s) => [s.personId, s])).values()];
  const ouvertAuj = ouverture(data.officine, today).length > 0;
  const presenceAuj = (() => {
    const total = totalDuree(ouverture(data.officine, today));
    return total ? Math.round(((total - totalDuree(trousPharmacien(data, today))) / total) * 100) : 0;
  })();

  // Le cycle d'une semaine : préférences, brouillon, contrôles, publication. On montre la première semaine à traiter.
  const cycle = useMemo(() => {
    const cible = semaineLibre(data, today);
    const postes = shiftsSemaine(data, cible).length;
    const bloquants = postes ? validateWeek(data, cible).filter((i) => i.gravite === 'bloquant').length : 0;
    const collaboratif = estCollaboratif(data.officine);
    const r = reponses(data, moisDe(addDays(cible, 3)));
    const recues = r.repondu.length;
    const attendues = recues + r.attendus.length;
    const voir = (): void => {
      setSemaine(cible);
      aller('construire');
    };
    const etapes: { nom: string; detail: string; etat: 'fait' | 'cours' | 'attente' }[] = [
      ...(collaboratif ? [{ nom: 'Préférences', detail: `${recues}/${attendues} reçues`, etat: recues >= attendues || postes ? ('fait' as const) : ('cours' as const) }] : []),
      { nom: 'Brouillon', detail: postes ? `${postes} postes` : 'À construire', etat: postes ? ('fait' as const) : ('attente' as const) },
      { nom: 'Contrôles', detail: !postes ? 'Après le brouillon' : bloquants ? `${bloquants} à corriger` : 'Tout est bon', etat: postes && !bloquants ? ('fait' as const) : ('attente' as const) },
      { nom: 'Publication', detail: 'À envoyer à l’équipe', etat: 'attente' as const },
    ];
    // L'étape en cours est la première qui n'est pas faite.
    const premiere = etapes.findIndex((e) => e.etat !== 'fait');
    if (premiere >= 0) etapes[premiere] = { ...etapes[premiere], etat: 'cours' };
    const bouton = !postes ? 'Construire' : bloquants ? 'Corriger' : 'Publier';
    return { semaine: cible, etapes, bouton, action: voir };
  }, [data, today, aller, setSemaine]);

  return (
    <div className="tb">
      <div className="hero tb-hero">
        <div className="tbh-texte">
          <div className="eyebrow">{fmtDateLong(today)}</div>
          <h1>Bonjour {moi?.prenom}</h1>
          <p>{data.officine.nom}</p>
        </div>
        <section className="tb-auj" aria-label="L’équipe aujourd’hui">
          <div className="eyebrow">L’équipe aujourd’hui</div>
          {ouvertAuj ? (
            <>
              <div className="tb-auj-n">
                <b className="num">{enPoste.length}</b> en poste
              </div>
              <div className="tb-auj-d">
                {absents.length ? `${absents.length} absent${absents.length > 1 ? 's' : ''}` : 'Aucun absent'} · pharmacien présent {presenceAuj} %
              </div>
            </>
          ) : (
            <div className="tb-auj-n">Pharmacie fermée</div>
          )}
          <button type="button" className="btn primary" onClick={() => voirJour(today)}>
            Voir la journée <ArrowRight size={16} aria-hidden="true" />
          </button>
        </section>
      </div>

      <section className="card cycle" aria-labelledby="tb-cycle" data-focus="cycle">
        <div className="cycle-tete">
          <div className="grow">
            <div className="eyebrow">Où en est le planning</div>
            <h2 id="tb-cycle">Semaine du {fmtSemaine(cycle.semaine)}</h2>
          </div>
          <button type="button" className="btn primary" onClick={cycle.action}>
            {cycle.bouton} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <ol className="cycle-etapes">
          {cycle.etapes.map((e, i) => (
            <li key={e.nom} className={e.etat} aria-current={e.etat === 'cours' ? 'step' : undefined}>
              <span className="cycle-pastille" aria-hidden="true">
                {e.etat === 'fait' ? <Check size={15} /> : i + 1}
              </span>
              <span>
                <b>{e.nom}</b>
                <span className="small soft">{e.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="tb-grille">
        <section className="card tb-faire" aria-labelledby="tb-faire">
          <div className="card-head">
            <div className="grow">
              <h2 id="tb-faire">{d.total ? `${d.total} décision${d.total > 1 ? 's' : ''} à prendre` : 'Tout est à jour'}</h2>
              <div className="small soft">{d.total ? 'La plus urgente d’abord.' : 'Rien n’attend votre décision.'}</div>
            </div>
            {d.total ? (
              <button type="button" className="btn primary" onClick={() => aller('resoudre')}>
                Tout voir <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {sujets.length ? (
            <div className="tb-sujets">
              {sujets.map((x) => (
                <button key={x.cle} type="button" className="tb-sujet" onClick={() => ouvrir(x.cle)}>
                  <span className="ico" aria-hidden="true">{x.icone}</span>
                  <span className="grow">{x.label}</span>
                  <span className="compte num">{x.nombre}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <p className="card-body soft tb-ajour">
              <Solvi size={54} humeur="satisfait" />
              <span>Absences couvertes, demandes arbitrées, plannings publiés.</span>
            </p>
          )}
        </section>

        <div className="tb-chiffres">
          <button type="button" className="tb-chiffre" onClick={() => { setSemaine(lundi); aller('construire'); }}>
            <span className="ico" aria-hidden="true"><ShieldCheck size={18} /></span>
            <span className="grow">
              <span className="l">Pharmacien présent cette semaine</span>
              <span className="v num">{cetteSemaine === null ? '—' : `${cetteSemaine} %`}</span>
            </span>
          </button>
          <button type="button" className="tb-chiffre" onClick={() => { setSemaine(suivante); aller('construire'); }}>
            <span className="ico" aria-hidden="true"><CalendarRange size={18} /></span>
            <span className="grow">
              <span className="l">Semaine prochaine</span>
              <span className="v">{etatSuivante}</span>
            </span>
          </button>
          <button type="button" className="tb-chiffre" onClick={() => aller('heures')}>
            <span className="ico" aria-hidden="true"><Hourglass size={18} /></span>
            <span className="grow">
              <span className="l">Compteurs d’heures</span>
              <span className="v">{heures ? `${heures} à régulariser` : 'À jour'}</span>
            </span>
          </button>
          <button type="button" className="tb-chiffre" onClick={() => aller('gardes')}>
            <span className="ico" aria-hidden="true"><MoonStar size={18} /></span>
            <span className="grow">
              <span className="l">Prochaine garde</span>
              <span className="v cap1">{prochaineGarde ? fmtDateCourt(prochaineGarde.date) : 'Aucune'}</span>
              {prochaineGarde ? <span className="d">{prochaineGarde.personId ? nomCourt(data.personnes.find((p) => p.id === prochaineGarde.personId) ?? data.personnes[0]) : 'À affecter'}</span> : null}
            </span>
          </button>
        </div>
      </div>

      {recentes.length ? (
        <section className="card tb-annonces" aria-labelledby="tb-annonces" data-focus="annonces" style={{ marginTop: 24 }}>
          <div className="card-head">
            <div className="grow">
              <h2 id="tb-annonces">Décisions récentes</h2>
              <div className="small soft">Ce qui a été décidé, et ce que cela change dans les plannings. Les personnes concernées sont prévenues.</div>
            </div>
            {recentes.some((a) => !a.luPar.includes(personId)) ? (
              <button type="button" className="btn sm" onClick={() => lireAnnonces(personId)}>
                Tout marquer comme lu
              </button>
            ) : null}
          </div>
          <ListeAnnonces data={data} annonces={recentes} moi={personId} onLu={(id) => lireAnnonces(personId, id)} />
        </section>
      ) : null}

      <section className="card" aria-labelledby="tb-jour" style={{ marginTop: 24 }}>
        <div className="card-head">
          <div className="grow">
            <h2 id="tb-jour">Aujourd’hui</h2>
            <div className="small soft">
              {enPoste.length ? `${enPoste.length} personne${enPoste.length > 1 ? 's' : ''} en poste` : 'Aucun poste planifié'}
              {absents.length ? ` · ${absents.length} absent${absents.length > 1 ? 's' : ''}` : ''}
            </div>
          </div>
          <button type="button" className="btn" onClick={() => voirJour(today)}>
            Voir la journée <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        {duJour.length ? (
          <div className="tb-equipe">
            {duJour.map((s) => {
              const p = data.personnes.find((x) => x.id === s.personId);
              if (!p) return null;
              return (
                <div key={s.id} className="tb-personne">
                  <Avatar person={p} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <b>{nomCourt(p)}</b>
                    <span className="small soft" style={{ display: 'block' }}>{libelleRole(data, p)}</span>
                  </span>
                  <span className={`tb-h ${momentDe(s)} num`}>
                    {fmtHeure(s.start)} – {fmtHeure(s.end)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="card-body soft">Construisez ou publiez la semaine pour voir ici l’équipe du jour.</p>
        )}
      </section>

      {pharmacies.length > 1 ? (
        <section className="card" aria-labelledby="tb-pharmacies" style={{ marginTop: 24 }}>
          <div className="card-head">
            <span className="ico" aria-hidden="true"><Building2 size={18} /></span>
            <h2 id="tb-pharmacies" className="h3 grow">Mes pharmacies</h2>
          </div>
          <div className="card-body col">
            {pharmacies.map(({ id, d: x }) => {
              const n = decisions(x, today).total;
              return (
                <div key={id} className="row wrap">
                  <div className="grow">
                    <b>{x.officine.nom}</b>
                    <div className="small soft">
                      {x.personnes.filter((p) => !p.externe).length} personnes · {n} décision{n > 1 ? 's' : ''}
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
      ) : null}
    </div>
  );
}
