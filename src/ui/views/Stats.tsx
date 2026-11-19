import './stats.css';
import type { LucideIcon } from 'lucide-react';
import { Activity, AlarmClockCheck, ChartNoAxesColumn, Check, GraduationCap, Hand, HandHelping, Scale, Sparkles, UsersRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { libelleRole } from '../../domain/acces';
import { addDays, fmtDecimal, fmtDuree, fmtJourMois } from '../../domain/time';
import type { ISODate, Person } from '../../domain/types';
import { nomComplet, nomCourt } from '../../domain/types';
import { COMPTEUR_LABEL } from '../../engine/equity';
import type { CompetenceCouverte, CompteurActivite } from '../../engine/stats';
import { COMPTEURS_ACTIVITE, statsEquipe } from '../../engine/stats';
import type { PointFortCle } from '../../engine/suivi';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Accordeon } from '../components/Accordeon';
import { Onglets } from '../components/Onglets';
import { Avatar, Empty, Pill } from '../kit';

/** Une icône par nature de point fort : les mêmes que sur la fiche d'une personne. */
const ICONE_FORT: Record<PointFortCle, LucideIcon> = { ponctuel: AlarmClockCheck, entraide: HandHelping, volontaire: Hand, part: Scale };
/** Ce que chaque point fort constate, d'après les faits des douze derniers mois. */
const CRITERE_FORT: Record<PointFortCle, string> = {
  ponctuel: 'Aucun retard ni départ anticipé noté en 12 mois, sur au moins 20 postes tenus',
  entraide: 'Au moins 2 postes repris au pied levé en 12 mois',
  volontaire: 'Au moins 2 propositions pour remplacer un collègue en 12 mois',
  part: 'Samedis et fermetures : au moins sa part sur 3 mois',
};
const COMPTEUR_COURT: Record<CompteurActivite, string> = { samedis: 'Samedis', fermetures: 'Fermetures', gardes: 'Gardes', depannages: 'Dépannages' };

const pluriel = (n: number, un: string, plusieurs: string): string => `${n} ${n > 1 ? plusieurs : un}`;
const jourMoisAn = (d: ISODate): string => `${fmtJourMois(d)} ${d.slice(0, 4)}`;
const ecartEnClair = (minutes: number): string => (minutes === 0 ? 'au contrat' : `${fmtDuree(Math.abs(minutes))} de ${minutes > 0 ? 'plus' : 'moins'}`);

const fmtPourcent = (part: number): string => `${Math.round(part * 1000) / 10}%`;

/** Une barre horizontale : la part de `valeur` dans `max`. Elle illustre ; la valeur est toujours écrite à côté. */
function Barre({ valeur, max, alerte }: { valeur: number; max: number; alerte?: boolean }): JSX.Element {
  const part = max > 0 ? Math.max(0, Math.min(1, valeur / max)) : 0;
  return (
    <span className={`st-barre${alerte ? ' alerte' : ''}`} aria-hidden="true">
      <i style={{ width: part > 0 ? `max(${fmtPourcent(part)}, 4px)` : 0 }} />
    </span>
  );
}
/** Une personne, cliquable : le clic ouvre sa fiche dans « Équipe ». */
function Qui({ p, sous, onOuvrir }: { p: Person; sous?: string; onOuvrir: (id: string) => void }): JSX.Element {
  return (
    <button type="button" className="st-qui" data-personne={p.id} onClick={() => onOuvrir(p.id)} title="Ouvrir sa fiche">
      <Avatar person={p} />
      <span className="st-qui-nom">
        <b>{nomComplet(p)}</b>
        {sous ? <span className="small soft">{sous}</span> : null}
      </span>
      <span className="sr"> : ouvrir sa fiche</span>
    </button>
  );
}

/** Un bloc de la page : une carte avec son titre, sa phrase d'explication et son contenu. */
function Bloc({ id, icone: Icone, titre, sous, children }: { id: string; icone: LucideIcon; titre: string; sous: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <section className="card st-bloc" id={id} data-focus={id} aria-labelledby={`${id}-titre`}>
      <div className="card-head st-tete">
        <span className="st-ico" aria-hidden="true">
          <Icone size={20} />
        </span>
        <div className="grow">
          <h2 className="h3" id={`${id}-titre`}>
            {titre}
          </h2>
          <p className="small soft">{sous}</p>
        </div>
      </div>
      <div className="card-body st-corps">{children}</div>
    </section>
  );
}

/** Statistiques d'équipe : composition, compétences, points forts et activité, d'après ce qui est déjà saisi. */
export function Stats(): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const stats = useMemo(() => statsEquipe(data, today), [data, today]);
  const personne = (id: string): Person | undefined => data.personnes.find((p) => p.id === id);
  const noms = (ids: string[]): string =>
    ids
      .map(personne)
      .filter((p): p is Person => !!p)
      .map(nomCourt)
      .join(', ');
  const ouvrir = (id: string): void => {
    useUi.getState().ouvrirPersonne(id);
    useUi.getState().aller('equipe');
  };

  const { composition: c, competences: k, pointsForts: f, activite: a } = stats;
  const entete = (
    <div className="page-head">
      <span className="page-ico" aria-hidden="true">
        <ChartNoAxesColumn size={26} />
      </span>
      <div className="grow">
        <div className="eyebrow">Statistiques</div>
        <h1>
          Que disent <span className="hl">les chiffres de l’équipe</span> ?
        </h1>
        <p>Composition, compétences, points forts et activité : tout est calculé à partir de ce qui est déjà saisi. Rien n’est estimé.</p>
      </div>
    </div>
  );

  if (!c.effectif) {
    return (
      <div className="page page-stats">
        {entete}
        <Empty icon={<UsersRound size={30} />} title="Aucune personne dans l’équipe">
          Les statistiques se remplissent dès que l’équipe est saisie dans « Équipe » et qu’un planning est publié.
        </Empty>
      </div>
    );
  }

  const maxFonction = Math.max(...c.parFonction.map((x) => x.effectif));
  const h = a.heures;
  const nbSemaines = h.semaines.length;
  const periodeHeures = nbSemaines ? `entre le ${fmtJourMois(h.semaines[0])} et le ${fmtJourMois(addDays(h.semaines[nbSemaines - 1], 6))}` : '';
  // Seules les personnes pour lesquelles un point fort est relevé sont nommées : l'absence de point fort ne dit rien d'une personne.
  const enAvant = f.parPersonne.filter((x) => x.points.length > 0);
  const observees = f.parPersonne.length;
  const historiqueCourt = a.periode.premierPoste !== null && a.periode.premierPoste > addDays(a.periode.from, 31);

  /** Qui détient une compétence, en clair. */
  const detenteurs = (x: CompetenceCouverte): string => (x.nombre ? `${pluriel(x.nombre, 'personne', 'personnes')} : ${noms(x.detenteurs)}` : 'Personne dans l’équipe');
  const renforts = (x: CompetenceCouverte): string => (x.renforts.length ? `Aussi détenue par ${noms(x.renforts)}, ${x.renforts.length > 1 ? 'remplaçants habituels' : 'remplaçant habituel'}.` : '');

  return (
    <div className="page page-stats">
      {entete}

      <ul className="card st-cles" id="stats-cles" data-focus="stats-cles" aria-label="Chiffres clés">
        <li className="st-cle" data-cle="effectif">
          <span className="st-cle-nom">Effectif</span>
          <b className="st-cle-valeur num">{c.effectif}</b>
          <span className="st-cle-detail">
            {c.effectif > 1 ? 'personnes' : 'personne'} dans l’équipe{c.externes ? `, plus ${pluriel(c.externes, 'remplaçant habituel', 'remplaçants habituels')}` : ''}.
          </span>
        </li>
        <li className="st-cle" data-cle="etp">
          <span className="st-cle-nom">Temps de travail</span>
          <b className="st-cle-valeur num">{fmtDecimal(c.etp, 1)}</b>
          <span className="st-cle-detail">
            {c.etp >= 2 ? 'équivalents' : 'équivalent'} temps plein. {c.tempsPartiels ? `${pluriel(c.tempsPartiels, 'salarié', 'salariés')} à temps partiel.` : 'Aucun temps partiel.'}
          </span>
        </li>
        <li className="st-cle" data-cle="competences">
          <span className="st-cle-nom">Compétences couvertes</span>
          <b className="st-cle-valeur num">
            {k.couvertes} <small>sur {k.total}</small>
          </b>
          <span className="st-cle-detail">{k.fragiles.length ? `${k.fragiles.length} ${k.fragiles.length > 1 ? 'reposent' : 'repose'} sur une seule personne.` : 'Aucune ne repose sur une seule personne.'}</span>
        </li>
        <li className="st-cle" data-cle="points-forts">
          <span className="st-cle-nom">Points forts relevés</span>
          <b className="st-cle-valeur num">{f.total}</b>
          <span className="st-cle-detail">{f.total ? `sur 12 mois, pour ${pluriel(f.avecPoint, 'personne', 'personnes')}.` : 'Rien n’est encore relevé sur 12 mois.'}</span>
        </li>
        <li className="st-cle" data-cle="heures">
          <span className="st-cle-nom">Heures planifiées</span>
          <b className="st-cle-valeur num">{fmtDuree(h.planifie)}</b>
          <span className="st-cle-detail">{nbSemaines ? `pour ${fmtDuree(h.contrat)} de contrat, sur ${nbSemaines > 1 ? `les ${nbSemaines} dernières semaines publiées` : 'la dernière semaine publiée'}.` : 'Aucune semaine publiée pour l’instant.'}</span>
        </li>
      </ul>

      {/* Quatre onglets plutôt qu'une longue page : une famille de chiffres à la fois, sous les chiffres clés. */}
      <Onglets
        id="stats"
        label="Familles de statistiques"
        onglets={[
          { cle: 'composition', titre: 'Composition', icone: UsersRound, contenu: <>
      <Bloc id="stats-composition" icone={UsersRound} titre="La composition de l’équipe" sous="Les personnes de l’officine, hors remplaçants extérieurs. Un temps plein compte pour 35 heures par semaine.">
        <div className="st-colonnes">
          <div>
            <h3 className="st-h3">Par fonction</h3>
            <ul className="st-barres">
              {c.parFonction.map((x) => (
                <li key={x.qualification}>
                  <span className="st-b-nom">{x.label}</span>
                  <span className="st-b-val num">
                    <b>{x.effectif}</b> <span className="small soft">· {fmtDecimal(x.etp, 1)} ETP</span>
                  </span>
                  <Barre valeur={x.effectif} max={maxFonction} />
                </li>
              ))}
            </ul>
            <p className="tiny muted st-note">ETP : équivalent temps plein, plafonné à 1 par personne.</p>
          </div>
          <div>
            <h3 className="st-h3">Par contrat</h3>
            <ul className="st-barres">
              {c.parContrat.map((x) => (
                <li key={x.contrat}>
                  <span className="st-b-nom">{x.label}</span>
                  <span className="st-b-val num">
                    <b>{x.effectif}</b> <span className="small soft">sur {c.effectif}</span>
                  </span>
                  <Barre valeur={x.effectif} max={c.effectif} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="st-h3">Repères</h3>
            <dl className="st-reperes">
              <div>
                <dt>Salariés à temps partiel</dt>
                <dd>
                  <span className="num">
                    {c.tempsPartiels} sur {c.salaries}
                  </span>
                  <span className="small soft">Contrat de moins de 35 heures par semaine.</span>
                </dd>
              </div>
              <div>
                <dt>Ancienneté moyenne</dt>
                <dd>
                  {c.anciennete.moyenne ?? 'Non renseignée'}
                  <span className="small soft">
                    {c.anciennete.moyenne
                      ? c.anciennete.manquantes
                        ? `Calculée sur ${pluriel(c.anciennete.renseignees, 'personne', 'personnes')} : le jour d’entrée manque pour ${c.anciennete.manquantes}.`
                        : 'Calculée sur toute l’équipe, d’après le jour d’entrée.'
                      : 'Le jour d’entrée se saisit sur la fiche de chaque personne.'}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Remplaçants habituels</dt>
                <dd>
                  <span className="num">{c.externes}</span>
                  <span className="small soft">Extérieurs à l’équipe : comptés à part.</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </Bloc>
          </> },
          { cle: 'competences', titre: 'Compétences', icone: GraduationCap, note: `${k.couvertes} / ${k.total}`, contenu: <>
      <Bloc
        id="stats-competences"
        icone={GraduationCap}
        titre="La couverture des compétences"
        sous={`${pluriel(k.couvertes, 'compétence est détenue', 'compétences sont détenues')} par au moins une personne, sur ${k.total} suivies. Une compétence détenue par une seule personne se perd dès qu’elle est absente.`}
      >
        <div className="st-colonnes deux" id="stats-competences-signal" data-focus="stats-competences-signal">
          <div>
            <h3 className="st-h3">
              Reposent sur une seule personne <span className="st-compte num">{k.fragiles.length}</span>
            </h3>
            {k.fragiles.length ? (
              <ul className="st-fragiles">
                {k.fragiles.map((x) => {
                  const p = personne(x.detenteurs[0]);
                  return (
                    <li key={x.cle}>
                      <span className="st-f-nom">
                        <b>{x.label}</b>
                        {x.renforts.length ? <span className="small soft">{renforts(x)}</span> : null}
                      </span>
                      {p ? <Qui p={p} sous={libelleRole(data, p)} onOuvrir={ouvrir} /> : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="small soft">Aucune : chaque compétence présente est détenue par au moins deux personnes.</p>
            )}
          </div>
          <div>
            <h3 className="st-h3">
              Que personne ne détient <span className="st-compte num">{k.absentes.length}</span>
            </h3>
            {k.absentes.length ? (
              <ul className="st-absentes">
                {k.absentes.map((x) => (
                  <li key={x.cle}>
                    {x.label}
                    {x.renforts.length ? <span className="small soft"> ({noms(x.renforts)}, hors équipe)</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small soft">Aucune : toutes les compétences suivies sont présentes dans l’équipe.</p>
            )}
          </div>
        </div>
        <div className="st-accs">
          {k.familles.map((fam, i) => (
            <Accordeon key={fam.titre} id={`stats-competences-${i + 1}`} focus={`stats-competences-${i + 1}`} titre={fam.titre} resume={`${fam.couvertes} sur ${fam.competences.length} détenues par au moins une personne`} droite={<span className="num">{fam.couvertes} / {fam.competences.length}</span>} ouvert={i === 0}>
              <ul className="st-rangs">
                {fam.competences.map((x) => (
                  <li key={x.cle} data-etat={x.etat}>
                    <span className="st-r-nom">
                      <b>{x.label}</b>
                      {x.etat === 'fragile' ? <Pill tone="warn">Une seule personne</Pill> : null}
                    </span>
                    <Barre valeur={x.nombre} max={c.effectif} alerte={x.etat === 'fragile'} />
                    <span className={`st-r-val small${x.nombre ? '' : ' soft'}`}>
                      {detenteurs(x)}
                      {x.renforts.length ? <span className="soft"> {renforts(x)}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Accordeon>
          ))}
        </div>
      </Bloc>
          </> },
          { cle: 'points-forts', titre: 'Points forts', icone: Sparkles, note: f.total, contenu: <>
      <Bloc id="stats-points-forts" icone={Sparkles} titre="Les points forts de l’équipe" sous="Ce qui a été noté de positif pour chacun sur douze mois. Ce n’est ni une note, ni un classement.">
        <div>
          <h3 className="st-h3">Par nature</h3>
          <ul className="st-natures" id="stats-points-forts-totaux" data-focus="stats-points-forts-totaux">
            {f.totaux.map((t) => {
              const Icone = ICONE_FORT[t.cle];
              return (
                <li key={t.cle} data-nature={t.cle}>
                  <span className="st-n-ico" aria-hidden="true">
                    <Icone size={18} />
                  </span>
                  <span className="st-n-nom">
                    <b>{t.titre}</b>
                    <span className="small soft">{CRITERE_FORT[t.cle]}</span>
                  </span>
                  <span className="st-n-val num">
                    <b>{t.nombre}</b> <span className="small soft">sur {observees}</span>
                  </span>
                  <Barre valeur={t.nombre} max={observees} />
                </li>
              );
            })}
          </ul>
          <p className="tiny muted st-note">Nombre de personnes concernées, sur {pluriel(observees, 'personne suivie', 'personnes suivies')} (l’équipe, hors titulaires).</p>
        </div>
        <div className="st-accs">
          <Accordeon id="stats-points-forts-detail" focus="stats-points-forts-detail" titre="Le détail par personne" resume={enAvant.length ? `${pluriel(enAvant.length, 'personne', 'personnes')} avec au moins un point fort relevé` : 'Rien n’est encore relevé'} droite={<span className="num">{enAvant.length}</span>} ouvert>
            {enAvant.length ? (
              <ul className="st-personnes">
                {enAvant.map(({ personId, points }) => {
                  const p = personne(personId);
                  if (!p) return null;
                  return (
                    <li key={personId}>
                      <Qui p={p} sous={libelleRole(data, p)} onOuvrir={ouvrir} />
                      <ul className="st-points" aria-label={`Points forts de ${nomComplet(p)}`}>
                        {points.map((pt) => (
                          <li key={pt.cle}>
                            <Check size={16} aria-hidden="true" />
                            <b>{pt.titre}</b>
                            <span className="small soft">{pt.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="small soft">Les points forts apparaissent après quelques semaines de planning publié.</p>
            )}
            <p className="tiny muted st-note">Par ordre alphabétique. Les arrêts, les congés et les absences n’entrent jamais en compte.</p>
          </Accordeon>
        </div>
      </Bloc>
          </> },
          { cle: 'activite', titre: 'Activité', icone: Activity, contenu: <>
      <Bloc id="stats-activite" icone={Activity} titre="Les repères d’activité" sous="Les heures planifiées face aux contrats, puis ce que l’équipe a porté sur douze mois.">
        <div id="stats-heures" data-focus="stats-heures">
          <h3 className="st-h3">Heures planifiées face aux contrats</h3>
          {nbSemaines ? (
            <>
              <p className="st-phrase">
                Sur {nbSemaines > 1 ? `les ${nbSemaines} dernières semaines publiées` : 'la dernière semaine publiée'} ({periodeHeures}) : <b className="num">{fmtDuree(h.planifie)}</b> planifiées pour <b className="num">{fmtDuree(h.contrat)}</b> de contrat, soit <b className="num">{ecartEnClair(h.ecart)}</b>.
              </p>
              <div className="st-accs">
                <Accordeon id="stats-heures-detail" focus="stats-heures-detail" titre="Les heures par personne" resume={`${pluriel(h.parPersonne.length, 'salarié', 'salariés')}, par ordre alphabétique`}>
                  <ul className="st-rangs">
                    {h.parPersonne.map((x) => {
                      const p = personne(x.personId);
                      if (!p) return null;
                      return (
                        <li key={x.personId}>
                          <Qui p={p} sous={`${p.heuresHebdo} h par semaine`} onOuvrir={ouvrir} />
                          <Barre valeur={x.planifie} max={x.contrat} alerte={x.ecart > 0} />
                          <span className="st-r-val small num">
                            <b>{fmtDuree(x.planifie)}</b> pour {fmtDuree(x.contrat)} <span className="soft">· {ecartEnClair(x.ecart)}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="tiny muted st-note">Les absences approuvées sont déduites du contrat. Un titulaire non salarié est hors décompte.</p>
                </Accordeon>
              </div>
            </>
          ) : (
            <p className="small soft">Aucune semaine n’est encore publiée : les heures apparaîtront dès la première publication.</p>
          )}
        </div>
        <div id="stats-compteurs" data-focus="stats-compteurs">
          <h3 className="st-h3">Samedis, fermetures, gardes et dépannages sur 12 mois</h3>
          <dl className="st-totaux">
            {COMPTEURS_ACTIVITE.map((cle) => (
              <div key={cle} data-compteur={cle}>
                <dt>{COMPTEUR_LABEL[cle]}</dt>
                <dd className="num">{a.totaux[cle]}</dd>
              </div>
            ))}
          </dl>
          <ul className="st-faits small soft">
            <li>
              Compté du {jourMoisAn(a.periode.from)} au {jourMoisAn(a.periode.to)}.{historiqueCourt && a.periode.premierPoste ? ` Le premier poste connu date du ${jourMoisAn(a.periode.premierPoste)}.` : ''}
            </li>
            <li>{a.gardesAVenir.total ? `${pluriel(a.gardesAVenir.total, 'garde programmée', 'gardes programmées')} à venir${a.gardesAVenir.sansPersonne ? `, dont ${a.gardesAVenir.sansPersonne} sans personne désignée` : ''}.` : 'Aucune garde programmée à venir.'}</li>
            <li>
              {a.remplacements.demandes
                ? `${pluriel(a.remplacements.demandes, 'demande de remplacement', 'demandes de remplacement')} en 12 mois : ${pluriel(a.remplacements.pourvues, 'pourvue', 'pourvues')}, ${a.remplacements.enCours} en cours.`
                : 'Aucune demande de remplacement en 12 mois.'}
            </li>
          </ul>
          <div className="st-accs">
            <Accordeon id="stats-compteurs-detail" focus="stats-compteurs-detail" titre="Le détail par personne" resume={`${pluriel(a.compteurs.length, 'personne', 'personnes')}, par ordre alphabétique`}>
              <div className="st-cpt">
                <div className="st-cpt-tete" aria-hidden="true">
                  <span />
                  {COMPTEURS_ACTIVITE.map((cle) => (
                    <span key={cle}>{COMPTEUR_COURT[cle]}</span>
                  ))}
                </div>
                <ul className="st-cpt-liste">
                  {a.compteurs.map((x) => {
                    const p = personne(x.personId);
                    if (!p) return null;
                    return (
                      <li key={x.personId}>
                        <Qui p={p} sous={libelleRole(data, p)} onOuvrir={ouvrir} />
                        {COMPTEURS_ACTIVITE.map((cle) => (
                          <span key={cle} className="st-cpt-case">
                            <span className="st-cpt-lib">{COMPTEUR_COURT[cle]} : </span>
                            <b className="num">{x[cle]}</b>
                          </span>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <p className="tiny muted st-note">Ce sont des décomptes, pas une comparaison : la part attendue de chacun, selon son contrat, se lit dans « Équité ». Les gardes ne concernent que les pharmaciens.</p>
            </Accordeon>
          </div>
        </div>
      </Bloc>
          </> },
        ]}
      />
    </div>
  );
}
