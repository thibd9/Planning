import './officine.css';
import { memeIdentifiant } from '../../domain/acces';
import { Accordeon } from '../components/Accordeon';
import { Dimensionnement, joursEnClair } from '../components/Dimensionnement';
import { ArrowDownToLine, CalendarCheck, CalendarDays, Check, Clock, Copy, CopyPlus, DoorClosed, DoorOpen, LayoutList, Plus, RotateCcw, Ruler, Settings2, SlidersHorizontal, Store, Trash2, UserRound, UserRoundCheck, Users, Utensils, UtensilsCrossed } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { JOURS, MOIS, fmtDateCourt, fmtDecimal, fmtDuree, fmtHHMM, fmtHeure, parseHHMM, fmtDateLong, joursFeries } from '../../domain/time';
import type { BesoinEffectif, CouleurPoste, InfosOfficine, Interval, PosteType } from '../../domain/types';
import { COULEUR_POSTE_LABEL } from '../../domain/types';
import { minutesTravail } from '../../engine/core';
import { chiffresOfficine, remarquesOfficine } from '../../engine/officine';
import { estCollaboratif, limiteSouhaits, moisDe, moisDecale } from '../../engine/souhaits';
import { COULEURS_POSTE, DialoguePosteType, classePoste } from '../components/PosteTypeDialogue';
import { useStore } from '../../store/store';
import { SEMAINES_DE_REFERENCE, etatPublication, reglagePublication } from '../../engine/echeance';
import { useUi } from '../../store/ui';

function Heure({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }): JSX.Element {
  return (
    <input
      type="time"
      step={900}
      className="input num"
      aria-label={label}
      value={fmtHHMM(value)}
      onChange={(e) => {
        const v = parseHHMM(e.target.value);
        if (v !== null) onChange(v);
      }}
      style={{ padding: '5px 8px', width: 112 }}
    />
  );
}

/** Le titre d'une rubrique : un intertitre de niveau 3, pour passer de l'une à l'autre au lecteur d'écran. */
function Titre({ id, children }: { id?: string; children: ReactNode }): JSX.Element {
  return (
    <span id={id} role="heading" aria-level={3}>
      {children}
    </span>
  );
}

const compte = (n: number, un: string, plusieurs: string): string => `${n} ${n > 1 ? plusieurs : un}`;
const majuscule = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
/** « lundi, mardi et jeudi ». */
const enListe = (mots: string[]): string => (mots.length > 1 ? `${mots.slice(0, -1).join(', ')} et ${mots[mots.length - 1]}` : (mots[0] ?? ''));
/** « 8 h 30 - 12 h 30 et 14 h - 19 h 30 ». */
const plagesEnClair = (plages: Interval[]): string => plages.map((p) => `${fmtHeure(p.start)} - ${fmtHeure(p.end)}`).join(' et ');
const memesPlages = (a: Interval[], b: Interval[]): boolean => a.length === b.length && a.every((x, k) => x.start === b[k].start && x.end === b[k].end);

/** Les horaires de la semaine en une ligne : les jours qui ont les mêmes heures sont réunis. */
function resumeHoraires(horaires: Interval[][]): string {
  const groupes: { plages: Interval[]; jours: number[] }[] = [];
  horaires.forEach((plages, j) => {
    const groupe = groupes.find((g) => memesPlages(g.plages, plages));
    if (groupe) groupe.jours.push(j);
    else groupes.push({ plages, jours: [j] });
  });
  const ouverts = groupes.filter((g) => g.plages.length).map((g) => `${joursEnClair(g.jours)} ${plagesEnClair(g.plages)}`);
  if (!ouverts.length) return 'Fermée toute la semaine';
  const fermes = groupes.find((g) => !g.plages.length)?.jours ?? [];
  const ferme = fermes.length === 1 ? `fermé le ${JOURS[fermes[0]]}` : fermes.length ? `fermé ${enListe(fermes.map((j) => JOURS[j]))}` : null;
  return majuscule([...ouverts, ...(ferme ? [ferme] : [])].join(', '));
}

/** Le minimum attendu au comptoir, du plus bas au plus haut. */
function resumeEffectifs(effectifs: BesoinEffectif[]): string {
  if (!effectifs.length) return 'Aucun minimum réglé';
  const bas = Math.min(...effectifs.map((e) => e.minEquipe));
  const haut = Math.max(...effectifs.map((e) => e.minEquipe));
  const plages = compte(effectifs.length, 'plage réglée', 'plages réglées');
  return bas === haut ? `${compte(bas, 'personne', 'personnes')} au minimum à toute heure · ${plages}` : `De ${bas} à ${haut} personnes au minimum, selon le jour et l’heure · ${plages}`;
}

export function Officine(): JSX.Element {
  const officine = useStore((s) => s.data.officine);
  const { majOfficine, reinitialiser } = useStore();
  const collaboratif = estCollaboratif(useStore((s) => s.data.officine));
  const donnees = useStore((s) => s.data);
  const aujourdhui = useStore((s) => s.today);
  const pub = reglagePublication(donnees.officine);
  const etatPub = etatPublication(donnees, aujourdhui);
  const [confirmation, setConfirmation] = useState(false);
  const [nouveauPoste, setNouveauPoste] = useState(false);
  // Le jour dont les options « Recopier » sont dépliées : un seul à la fois.
  const [recopie, setRecopie] = useState<number | null>(null);
  const today = useStore((s) => s.today);
  const moisSuivant = moisDecale(moisDe(today), 1);
  // Les jours fériés des douze prochains mois.
  const feries = [Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1].flatMap((y) => [...joursFeries(y).entries()]).filter(([d]) => d >= today && d < `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`).sort((a, b) => a[0].localeCompare(b[0]));
  const dire = useUi((s) => s.dire);
  const session = useUi((s) => s.session);
  const titulaire = donnees.personnes.some((p) => !p.externe && p.qualification === 'titulaire' && memeIdentifiant(p.identifiant, session ?? ''));
  const infos: InfosOfficine = officine.infos ?? {};
  // Une valeur vidée disparaît de la fiche, plutôt que d'y rester à zéro.
  const majInfos = (patch: Partial<InfosOfficine>): void => {
    const suite = Object.fromEntries(Object.entries({ ...infos, ...patch }).filter(([, v]) => v !== undefined && v !== false && v !== 0));
    majOfficine({ infos: Object.keys(suite).length ? (suite as InfosOfficine) : undefined });
  };
  const remarques = remarquesOfficine(officine);
  const chiffres = chiffresOfficine(officine);
  const setPoste = (id: string, patch: Partial<PosteType>): void => {
    majOfficine({ postes: officine.postes.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  };

  // Ce que dit chaque rubrique quand elle est repliée : une ligne, tirée des réglages eux-mêmes.
  const resumeFeries = `${officine.fermeJoursFeries ? 'Fermée les jours fériés, hors gardes' : 'Ouverte les jours fériés'}${feries.length ? ` · prochain : ${feries[0][1]}, ${fmtDateLong(feries[0][0]).replace(/ \d{4}$/, '')}` : ''}`;
  const resumeChiffres = `${remarques.length ? `${compte(remarques.length, 'point', 'points')} à vérifier · ` : ''}${chiffres.length ? chiffres.join(' · ') : 'Facultatif : aucun repère renseigné'}`;
  const resumePostes = officine.postes.length ? `${compte(officine.postes.length, 'poste type', 'postes types')} : ${officine.postes.map((p) => p.label).join(', ')}` : 'Aucun poste type';
  const resumeModele = collaboratif ? `Avec l’équipe · préférences à donner avant le ${officine.souhaitsLimite ?? 20} du mois précédent` : 'Vous seul · sans recueil de préférences';
  const resumePublication = `Au plus tard ${compte(pub.delai, 'jour', 'jours')} avant le 1er du mois · ${pub.rappel > 0 ? `rappel ${compte(pub.rappel, 'jour', 'jours')} avant` : 'sans rappel'} · ${pub.relais ? 'Solvéa prend le relais passé l’échéance' : 'sans relais de Solvéa'}`;
  const resumeParametres = `Valeur du point : ${officine.valeurPoint != null ? `${fmtDecimal(officine.valeurPoint, 3)} €` : 'à saisir'} · ${compte(officine.plafondPrioritaires, 'demande prioritaire', 'demandes prioritaires')} par personne · coûts estimés ${officine.couts ? 'affichés' : 'masqués'}`;

  return (
    <div className="page page-officine">
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <Settings2 size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">Officine</div>
          <h1>{officine.nom || 'Mon officine'}</h1>
          {chiffres.length ? <p className="page-fait num">{chiffres.slice(0, 3).join(' · ')}</p> : null}
          <p>Horaires d'ouverture, effectif attendu et postes types. Ces réglages sont des choix d'organisation : ils se modifient librement. Dépliez une rubrique pour la régler.</p>
        </div>
      </div>

      <h2 className="of-groupe" id="of-g-pharmacie">
        La pharmacie
      </h2>
      <section className="card of-carte" aria-labelledby="of-g-pharmacie">
        <Accordeon id="acc-identite" icone={Store} ouvert titre={<Titre>Nom de la pharmacie</Titre>} resume={officine.nom || 'Nom à renseigner'}>
          <label className="field of-nom">
            Nom de la pharmacie
            <input id="officine-nom" value={officine.nom} onChange={(e) => majOfficine({ nom: e.target.value })} placeholder="Pharmacie du Marché" />
            <span className="aide">Il s’affiche en haut de l’écran et sur les plannings imprimés.</span>
          </label>
        </Accordeon>

        {/* « .split » : le repère de la visite guidée « Horaires et effectif ». Il réunit les horaires, les jours fériés et le minimum au comptoir. */}
        <div className="split of-duo">
          <Accordeon id="acc-horaires" icone={Clock} ouvert titre={<Titre>Horaires d'ouverture</Titre>} resume={resumeHoraires(officine.horaires)}>
            <p className="of-intro">Une ligne par jour. « Recopier » reprend les horaires de la veille, ou applique ceux du jour aux autres jours ouverts.</p>
            <div className="horaires" role="list" aria-label="Horaires d’ouverture par jour">
              {JOURS.map((j, i) => {
                const plages = officine.horaires[i];
                const setPlages = (p: Interval[]): void => majOfficine({ horaires: officine.horaires.map((h, k) => (k === i ? p : h)) });
                const ouvert = plages.length > 0;
                const veille = i > 0 ? officine.horaires[i - 1] : [];
                // Les autres jours où la pharmacie ouvre : eux seuls reprennent les horaires de celui-ci, un jour fermé le reste.
                const autres = JOURS.map((_, k) => k).filter((k) => k !== i && officine.horaires[k].length > 0);
                const versAutres = ouvert && autres.length > 0;
                const depuisVeille = veille.length > 0;
                const deplie = recopie === i && (versAutres || depuisVeille);
                // Les options se referment une fois le choix fait, et le clavier revient au bouton « Recopier ».
                const refermer = (): void => {
                  document.getElementById(`jl-recopier-${i}`)?.focus();
                  setRecopie(null);
                };
                return (
                  <div key={j} className="jour-ligne" role="listitem">
                    <div className="jl-nom cap1">{j}</div>
                    <div className="jl-heures">
                      {ouvert ? (
                        <div className="jl-plages">
                          {plages.map((h, k) => (
                            <div key={k} className="row" style={{ gap: 6 }}>
                              <Heure label={`${k === 0 ? 'Ouverture' : 'Réouverture'} le ${j}`} value={h.start} onChange={(v) => setPlages(plages.map((x, n) => (n === k ? { ...x, start: v } : x)))} />
                              <span className="muted" aria-hidden="true">→</span>
                              <Heure label={`${k === plages.length - 1 ? 'Fermeture' : 'Fermeture du midi'} le ${j}`} value={h.end} onChange={(v) => setPlages(plages.map((x, n) => (n === k ? { ...x, end: v } : x)))} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">Fermé</span>
                      )}
                    </div>
                    <div className="jl-actions">
                      {plages.length === 1 && plages[0].end - plages[0].start > 240 ? (
                        <button
                          type="button"
                          className="btn sm jl-action"
                          title="Ajouter une coupure le midi"
                          aria-label={`Coupure le midi : ${j}`}
                          onClick={() => setPlages([{ start: plages[0].start, end: Math.max(plages[0].start + 60, Math.min(750, plages[0].end - 120)) }, { start: Math.max(plages[0].start + 120, Math.min(840, plages[0].end - 60)), end: plages[0].end }])}
                        >
                          <Utensils size={16} aria-hidden="true" />
                          <span className="jl-lib">Coupure le midi</span>
                        </button>
                      ) : null}
                      {plages.length === 2 ? (
                        <button type="button" className="btn sm jl-action" title="Retirer la coupure du midi" aria-label={`Retirer la coupure : ${j}`} onClick={() => setPlages([{ start: plages[0].start, end: plages[1].end }])}>
                          <UtensilsCrossed size={16} aria-hidden="true" />
                          <span className="jl-lib">Retirer la coupure</span>
                        </button>
                      ) : null}
                      {versAutres || depuisVeille ? (
                        <button
                          type="button"
                          id={`jl-recopier-${i}`}
                          className={`btn sm jl-action${deplie ? ' on' : ''}`}
                          title="Recopier des horaires : depuis la veille, ou vers les autres jours ouverts"
                          aria-label={`Recopier les horaires : ${j}`}
                          aria-expanded={deplie}
                          aria-controls={`jl-recopie-${i}`}
                          onClick={() => setRecopie(deplie ? null : i)}
                        >
                          <Copy size={16} aria-hidden="true" />
                          <span className="jl-lib">Recopier</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn sm jl-action"
                        title={ouvert ? 'Fermer la pharmacie ce jour-là' : 'Ouvrir la pharmacie ce jour-là'}
                        aria-label={ouvert ? `Fermer ce jour : ${j}` : `Ouvrir ce jour : ${j}`}
                        onClick={() => setPlages(ouvert ? [] : [{ start: 9 * 60, end: 19 * 60 }])}
                      >
                        {ouvert ? <DoorClosed size={16} aria-hidden="true" /> : <DoorOpen size={16} aria-hidden="true" />}
                        <span className="jl-lib">{ouvert ? 'Fermer ce jour' : 'Ouvrir ce jour'}</span>
                      </button>
                    </div>
                    {deplie ? (
                      <div
                        className="jl-recopie"
                        id={`jl-recopie-${i}`}
                        role="group"
                        aria-label={`Recopier les horaires, ${j}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') refermer();
                        }}
                      >
                        {versAutres ? (
                          autres.every((k) => memesPlages(officine.horaires[k], plages)) ? (
                            <span className="small soft">Les autres jours ouverts ont déjà ces horaires.</span>
                          ) : (
                            <button
                              type="button"
                              className="btn sm"
                              onClick={() => {
                                majOfficine({ horaires: officine.horaires.map((h, k) => (autres.includes(k) ? plages.map((x) => ({ ...x })) : h)) });
                                refermer();
                                dire(`Horaires du ${j} recopiés sur ${autres.length > 1 ? `les ${autres.length} autres jours ouverts` : `le ${JOURS[autres[0]]}`}.`, true);
                              }}
                            >
                              <CopyPlus size={15} aria-hidden="true" /> Appliquer ces horaires aux autres jours ouverts
                            </button>
                          )
                        ) : null}
                        {depuisVeille ? (
                          memesPlages(veille, plages) ? (
                            <span className="small soft">Mêmes horaires que la veille.</span>
                          ) : (
                            <button
                              type="button"
                              className="btn sm"
                              onClick={() => {
                                setPlages(veille.map((x) => ({ ...x })));
                                refermer();
                                dire(`Horaires du ${JOURS[i - 1]} recopiés sur le ${j}.`, true);
                              }}
                            >
                              <ArrowDownToLine size={15} aria-hidden="true" /> Copier la veille ({JOURS[i - 1]})
                            </button>
                          )
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Accordeon>

          <Accordeon id="acc-feries" icone={CalendarDays} titre={<Titre>Jours fériés</Titre>} resume={resumeFeries}>
            <label className="check">
              <input type="checkbox" checked={officine.fermeJoursFeries} onChange={(e) => majOfficine({ fermeJoursFeries: e.target.checked })} />
              Officine fermée les jours fériés (hors gardes)
            </label>
            <p className="of-intro">{officine.fermeJoursFeries ? 'L’officine est fermée ces jours-là, hors gardes : aucun poste n’y est proposé.' : 'L’officine reste ouverte ces jours-là : ils sont signalés dans les plannings.'}</p>
            <ul className="feries">
              {feries.map(([date, nom]) => (
                <li key={date}>
                  <b>{nom}</b>
                  <span className="cap1">{fmtDateLong(date).replace(/ \d{4}$/, '')}</span>
                </li>
              ))}
            </ul>
          </Accordeon>

          <Accordeon id="acc-effectif" icone={Users} titre={<Titre>Combien de personnes au comptoir ?</Titre>} resume={resumeEffectifs(officine.effectifs)}>
            <p className="of-intro">Le minimum à tenir, selon le jour et l’heure. En dessous, le planning vous prévient.</p>
            <div className="of-defile">
              <table className="t of-effectifs">
                <thead>
                  <tr>
                    <th scope="col">Jours</th>
                    <th scope="col">Horaire</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Personnes au minimum</th>
                  </tr>
                </thead>
                <tbody>
                  {officine.effectifs.map((e, i) => (
                    <tr key={i}>
                      <td className="cap1">{e.jours.length === 5 && e.jours[0] === 0 ? 'Lundi à vendredi' : e.jours.map((j) => JOURS[j]).join(', ')}</td>
                      <td className="num of-plage">
                        {fmtHHMM(e.start)} → {fmtHHMM(e.end)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="eff-min">
                          <input
                            type="number"
                            min={0}
                            max={12}
                            className="input num"
                            aria-label={`Nombre minimum de personnes, ${e.jours.length === 5 && e.jours[0] === 0 ? 'lundi à vendredi' : e.jours.map((j) => JOURS[j]).join(', ')}, de ${fmtHHMM(e.start)} à ${fmtHHMM(e.end)}`}
                            value={e.minEquipe}
                            onChange={(ev) => majOfficine({ effectifs: officine.effectifs.map((x, k) => (k === i ? { ...x, minEquipe: Number(ev.target.value) } : x)) })}
                            style={{ width: 70, textAlign: 'right', padding: '5px 7px' }}
                          />
                          <span className="small soft" aria-hidden="true">{e.minEquipe > 1 ? 'personnes' : 'personne'}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tiny muted of-note">Un pharmacien doit être présent à chaque minute d’ouverture : c’est contrôlé à part, quel que soit ce minimum.</p>
          </Accordeon>
        </div>

        {/* L'officine en chiffres : des repères facultatifs, que l'on complète quand on les connaît. */}
        <Accordeon id="acc-chiffres" focus="infos-officine" icone={Ruler} titre={<Titre id="of-infos">L’officine en chiffres</Titre>} resume={resumeChiffres}>
          <p className="of-intro">Facultatif. Ces repères décrivent vos locaux ; complétez ceux que vous connaissez.</p>
          <div className="of-grille">
            {(
              [
                { cle: 'surface', nom: 'Surface totale', unite: 'm²', max: 5000, valeur: officine.surface, ecrire: (v: number | undefined) => majOfficine({ surface: v }) },
                { cle: 'surfaceVente', nom: 'Surface de vente', unite: 'm²', max: 5000, valeur: infos.surfaceVente, ecrire: (v: number | undefined) => majInfos({ surfaceVente: v }) },
                { cle: 'reserve', nom: 'Réserve et préparatoire', unite: 'm²', max: 5000, valeur: infos.reserve, ecrire: (v: number | undefined) => majInfos({ reserve: v }) },
                { cle: 'caisses', nom: 'Caisses', unite: '', max: 40, valeur: infos.caisses, ecrire: (v: number | undefined) => majInfos({ caisses: v }) },
                { cle: 'comptoirs', nom: 'Postes de comptoir', unite: '', max: 40, valeur: infos.comptoirs, ecrire: (v: number | undefined) => majInfos({ comptoirs: v }) },
                { cle: 'confidentialite', nom: 'Espaces de confidentialité', unite: '', max: 20, valeur: infos.confidentialite, ecrire: (v: number | undefined) => majInfos({ confidentialite: v }) },
              ] as const
            ).map((c) => (
              <label key={c.cle} className="field" htmlFor={`officine-${c.cle}`}>
                {c.nom}
                <span className={c.unite ? 'champ-unite' : undefined}>
                  <input
                    id={`officine-${c.cle}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={c.max}
                    step={1}
                    className="num"
                    value={c.valeur ?? ''}
                    onChange={(e) => {
                      const v = Math.round(Number(e.target.value));
                      c.ecrire(e.target.value.trim() && v > 0 ? Math.min(v, c.max) : undefined);
                    }}
                    placeholder="-"
                  />
                  {c.unite ? <span className="unite">{c.unite}</span> : null}
                </span>
              </label>
            ))}
            <label className="check of-robot" htmlFor="officine-robot">
              <input id="officine-robot" type="checkbox" checked={!!infos.robot} onChange={(e) => majInfos({ robot: e.target.checked || undefined })} />
              <span>Robot ou automate de dispensation</span>
            </label>
          </div>
          {remarques.length ? (
            <ul className="of-remarques" id="of-remarques">
              {remarques.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
        </Accordeon>

        {/* Le dimensionnement de l'équipe : un repère réservé aux titulaires. */}
        {titulaire ? <Dimensionnement /> : null}
      </section>

      <h2 className="of-groupe" id="of-g-planning">
        Le planning et les données
      </h2>
      <section className="card of-carte" aria-labelledby="of-g-planning">
        <Accordeon id="acc-postes" icone={LayoutList} titre={<Titre>Postes types</Titre>} resume={resumePostes}>
          <div className="of-entete">
            <p className="of-intro">Vos horaires habituels, chacun avec sa couleur. Ils servent à la saisie rapide et aux propositions de planning.</p>
            <button type="button" className="btn primary sm" onClick={() => setNouveauPoste(true)}>
              <Plus size={14} aria-hidden="true" /> Ajouter un poste type
            </button>
          </div>
          <div className="of-defile">
            <table className="t pt-table">
              <thead>
                <tr>
                  <th scope="col">Poste</th>
                  <th scope="col">Couleur</th>
                  <th scope="col">Horaires</th>
                  <th scope="col">Pause</th>
                  <th scope="col">Jours</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Travail effectif</th>
                  <td />
                </tr>
              </thead>
              <tbody>
                {officine.postes.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input className="input pt-nom" aria-label="Nom du poste" value={p.label} onChange={(e) => setPoste(p.id, { label: e.target.value })} />
                    </td>
                    <td>
                      <span className="pt-couleur">
                        <i className={`pt-pastille ${classePoste(p)}`} aria-hidden="true" />
                        <select aria-label={`Couleur du poste ${p.label}`} value={p.couleur ?? ''} onChange={(e) => setPoste(p.id, { couleur: (e.target.value || undefined) as CouleurPoste | undefined })}>
                          <option value="">Automatique</option>
                          {COULEURS_POSTE.map((c) => (
                            <option key={c} value={c}>
                              {COULEUR_POSTE_LABEL[c]}
                            </option>
                          ))}
                        </select>
                      </span>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <Heure label={`Début du poste ${p.label}`} value={p.start} onChange={(v) => setPoste(p.id, { start: v })} />
                        <span className="muted" aria-hidden="true">→</span>
                        <Heure label={`Fin du poste ${p.label}`} value={p.end} onChange={(v) => setPoste(p.id, { end: v })} />
                      </div>
                    </td>
                    <td>
                      {p.pauseStart !== undefined && p.pauseEnd !== undefined ? (
                        <div className="row" style={{ gap: 6 }}>
                          <Heure label={`Début de pause du poste ${p.label}`} value={p.pauseStart} onChange={(v) => setPoste(p.id, { pauseStart: v })} />
                          <span className="muted" aria-hidden="true">→</span>
                          <Heure label={`Fin de pause du poste ${p.label}`} value={p.pauseEnd} onChange={(v) => setPoste(p.id, { pauseEnd: v })} />
                        </div>
                      ) : (
                        <span className="muted">Sans pause</span>
                      )}
                    </td>
                    <td className="small cap1">{p.jours.length === 5 && p.jours[0] === 0 ? 'Lundi à vendredi' : p.jours.map((j) => JOURS[j]).join(', ')}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{fmtDuree(minutesTravail(p))}</td>
                    <td style={{ textAlign: 'right', width: 48 }}>
                      <button type="button" className="btn ghost icon" aria-label={`Retirer le poste ${p.label}`} title={`Retirer le poste ${p.label}`} onClick={() => majOfficine({ postes: officine.postes.filter((x) => x.id !== p.id) })}>
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Accordeon>

        <Accordeon id="acc-modele" focus="modele" icone={UserRoundCheck} titre={<Titre>Qui prépare le planning ?</Titre>} resume={resumeModele}>
          <fieldset className="qui-prepare">
            <legend className="sr">Façon de construire le planning</legend>
            <label className={collaboratif ? 'on' : ''}>
              <input type="radio" name="modele" checked={collaboratif} onChange={() => majOfficine({ modele: 'collaboratif' })} />
              <span className="qp-pic" aria-hidden="true">
                <Users size={22} />
              </span>
              <span className="qp-texte">
                <b>Avec l’équipe</b>
                <span>Chacun dit ce qui l’arrange pour le mois suivant, puis vous construisez.</span>
              </span>
              <span className="qp-coche" aria-hidden="true">
                <Check size={15} strokeWidth={3} />
              </span>
            </label>
            <label className={collaboratif ? '' : 'on'}>
              <input type="radio" name="modele" checked={!collaboratif} onChange={() => majOfficine({ modele: 'classique' })} />
              <span className="qp-pic" aria-hidden="true">
                <UserRound size={22} />
              </span>
              <span className="qp-texte">
                <b>Vous seul</b>
                <span>Vous construisez sans recueillir de préférences ; l’équipe consulte le planning publié.</span>
              </span>
              <span className="qp-coche" aria-hidden="true">
                <Check size={15} strokeWidth={3} />
              </span>
            </label>
          </fieldset>
          {collaboratif ? (
            <div className="qp-limite">
              <label htmlFor="souhaits-limite">Préférences à donner avant le</label>
              <select id="souhaits-limite" value={officine.souhaitsLimite ?? 20} onChange={(e) => majOfficine({ souhaitsLimite: Number(e.target.value) })}>
                {Array.from({ length: 28 }, (_, k) => k + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span>du mois précédent</span>
              <span className="qp-exemple">
                Pour {MOIS[Number(moisSuivant.slice(5)) - 1]} : jusqu’au {fmtDateCourt(limiteSouhaits(officine, moisSuivant))}
              </span>
            </div>
          ) : null}
          <div className="qp-effets" id="qp-effets" role="status">
            <h3>Ce que ce choix change dans l’application</h3>
            <div className="qp-effets-cols">
              <div>
                <span className="eyebrow">Pour l’équipe</span>
                {collaboratif ? (
                  <ul>
                    <li>« Mes demandes » propose la carte « Mes préférences » : chacun y indique, jour par jour, s’il préfère le matin, la journée, l’après-midi ou un repos.</li>
                    <li>Les préférences du mois suivant se donnent jusqu’à la date limite ci-dessus.</li>
                  </ul>
                ) : (
                  <ul>
                    <li>La carte « Mes préférences » disparaît de « Mes demandes ».</li>
                    <li>L’équipe consulte le planning publié, sans donner d’avis avant.</li>
                  </ul>
                )}
              </div>
              <div>
                <span className="eyebrow">Pour vous</span>
                {collaboratif ? (
                  <ul>
                    <li>Le tableau de bord compte les préférences reçues avant de construire.</li>
                    <li>La vue « Mois » les affiche, personne par personne.</li>
                    <li>« Proposer un planning » en tient compte, et l’une des trois propositions les suit en priorité.</li>
                  </ul>
                ) : (
                  <ul>
                    <li>Vous construisez quand vous voulez, sans date limite à attendre.</li>
                    <li>Le tableau de bord n’a plus d’étape « Préférences » ; la vue « Mois » ne les affiche plus.</li>
                    <li>« Proposer un planning » s’appuie sur les contrats, les règles, l’équité et les contraintes saisies dans les fiches, sans préférences du mois.</li>
                  </ul>
                )}
              </div>
            </div>
            <p className="tiny muted">
              Dans les deux cas : les règles et le nombre minimum de personnes passent avant tout, les demandes d’absence, d’horaires et de remplacement restent ouvertes à l’équipe, et vous seul publiez. Vous pouvez changer d’avis à tout
              moment : rien n’est effacé.
            </p>
          </div>
        </Accordeon>

        <Accordeon id="acc-publication" focus="publication" icone={CalendarCheck} titre={<Titre>Publication du planning, au mois</Titre>} resume={resumePublication}>
          <div className="pub-regles">
            <span>Le planning d’un mois est transmis à l’équipe au plus tard</span>
            <label className="sr" htmlFor="pub-delai">
              Nombre de jours avant le 1er du mois
            </label>
            <input id="pub-delai" type="number" className="num" min={1} max={45} value={pub.delai} onChange={(e) => majOfficine({ publication: { ...pub, delai: Math.max(1, Math.min(45, Number(e.target.value) || 1)) } })} />
            <span>jours avant le 1er.</span>
          </div>
          <div className="pub-regles">
            <span>Solvéa vous le rappelle</span>
            <label className="sr" htmlFor="pub-rappel">
              Nombre de jours de rappel avant l’échéance
            </label>
            <input id="pub-rappel" type="number" className="num" min={0} max={30} value={pub.rappel} onChange={(e) => majOfficine({ publication: { ...pub, rappel: Math.max(0, Math.min(30, Number(e.target.value) || 0)) } })} />
            <span>jours avant cette échéance, sur le tableau de bord.</span>
          </div>
          <p className="pub-exemple" role="status">
            Pour {MOIS[Number(etatPub.mois.slice(5)) - 1]} : rappel à partir du {fmtDateCourt(etatPub.rappelLe)}, à publier au plus tard le {fmtDateCourt(etatPub.echeance)}.
          </p>
          <label className="check">
            <input type="checkbox" id="pub-relais" checked={pub.relais} onChange={(e) => majOfficine({ publication: { ...pub, relais: e.target.checked } })} />
            <span>
              <b>Passé l’échéance, laisser Solvéa préparer le planning</b>
              <span className="small soft" style={{ display: 'block' }}>
                Si rien n’est fait à l’échéance, Solvéa prépare en brouillon les semaines restées vides, d’après vos habitudes : pour chaque personne et chaque jour, sa journée la plus fréquente sur vos {SEMAINES_DE_REFERENCE}{' '}
                dernières semaines publiées. Un planning que vous avez commencé à la main passe toujours avant : il n’est jamais touché. Rien n’est publié sans vous : vous relisez, corrigez, puis publiez.
              </span>
            </span>
          </label>
          <p className="tiny muted of-note">Solvéa fonctionne sur cet appareil, sans serveur : le rappel et la préparation se font à l’ouverture de l’application par un titulaire.</p>
        </Accordeon>

        <Accordeon id="acc-parametres" icone={SlidersHorizontal} titre={<Titre>Paramètres et coûts</Titre>} resume={resumeParametres}>
          <div className="champs">
            <label className="field">
              Valeur du point conventionnel (€)
              <input type="number" step="0.001" min={0} placeholder="à saisir" value={officine.valeurPoint ?? ''} onChange={(e) => majOfficine({ valeurPoint: e.target.value === '' ? null : Number(e.target.value) })} />
            </label>
            <label className="field">
              Demandes prioritaires par personne
              <input type="number" min={0} max={6} value={officine.plafondPrioritaires} onChange={(e) => majOfficine({ plafondPrioritaires: Number(e.target.value) })} />
            </label>
            <label className="field">
              Chiffre d'affaires annuel HT (€)
              <input type="number" step={10000} min={0} value={officine.caAnnuelHT ?? ''} onChange={(e) => majOfficine({ caAnnuelHT: e.target.value === '' ? null : Number(e.target.value) })} />
            </label>
          </div>
          <p className="tiny muted of-note">La valeur du point n'est pas préremplie : reprenez-la dans le barème en vigueur. Tant qu'elle est vide, les indemnités de sujétion sont exprimées en points.</p>
          <label className="check couts-option">
            <input type="checkbox" id="couts-afficher" checked={!!officine.couts} onChange={(e) => majOfficine({ couts: e.target.checked })} />
            <span>
              <b>Afficher les coûts estimés</b>
              <span className="small soft" style={{ display: 'block' }}>
                Solvéa ne connaît pas vos salaires : sans cette option, aucun montant n’est affiché. Si vous la cochez, un champ « Taux horaire brut », facultatif, apparaît dans la fiche de chaque personne. Les coûts affichés
                multiplient alors les heures planifiées par ce taux ; une personne sans taux n’est pas comptée. Ce n’est jamais un calcul de paie.
              </span>
            </span>
          </label>
        </Accordeon>

        <Accordeon id="acc-zero" icone={RotateCcw} titre={<Titre>Repartir de zéro</Titre>} resume="Efface l’officine, l’équipe et les plannings enregistrés sur cet appareil">
          <div className="of-zero">
            <p className="of-intro">Réinitialiser efface l’officine, l’équipe et les plannings enregistrés sur cet appareil, et ramène à l’écran de création.</p>
            {confirmation ? (
              <div className="row wrap">
                <span className="small">Tout effacer et revenir à l’écran de création ?</span>
                <button type="button" className="btn" onClick={() => setConfirmation(false)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => {
                    reinitialiser();
                    setConfirmation(false);
                    dire('Application remise à zéro.');
                  }}
                >
                  <RotateCcw size={15} aria-hidden="true" /> Oui, réinitialiser
                </button>
              </div>
            ) : (
              <button type="button" className="btn danger" onClick={() => setConfirmation(true)}>
                <RotateCcw size={15} aria-hidden="true" /> Réinitialiser
              </button>
            )}
          </div>
        </Accordeon>
      </section>
      {nouveauPoste ? <DialoguePosteType onClose={() => setNouveauPoste(false)} onAjouter={(p) => { majOfficine({ postes: officine.postes.concat(p) }); dire(`Poste type « ${p.label} » ajouté.`, true); }} /> : null}
    </div>
  );
}
