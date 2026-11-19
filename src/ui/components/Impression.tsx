import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { JOURS, JOURS_COURT, addDays, fmtDateCourt, fmtDateLong, fmtDuree, fmtHeure, fmtHorodatage, mondayOf } from '../../domain/time';
import type { ISODate, Person } from '../../domain/types';
import { QUALIFICATION_COURT, nomComplet, nomCourt } from '../../domain/types';
import type { BlocSemaine, CaseImprimee, DocumentImprime, Periode } from '../../engine/impression';
import { PAGE, documentImpression, heureCourte } from '../../engine/impression';
import { moisDecale } from '../../engine/souhaits';
import { imprimer } from '../../env';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { ACTIVITE_COURT } from '../icons';
import { Dialog, Seg, momentDe } from '../kit';

type Encre = 'couleur' | 'nb';
/** Un millimètre, en pixels d'écran : la feuille est dessinée à sa taille réelle, puis réduite pour l'aperçu. */
const MM = 96 / 25.4;
const capitale = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

const ETAT: Record<BlocSemaine['etat'], string> = { publie: 'Publié', brouillon: 'Brouillon, non publié', vide: 'Aucun poste', non_publie: 'Pas encore publié' };

function Case({ c, ferme, hors, mois, detail }: { c: CaseImprimee; ferme: boolean; hors: boolean; mois: boolean; detail: boolean }): JSX.Element {
  if (c.absence)
    return (
      <td className={`f-c abs ${c.nature ?? 'absence'}${hors ? ' hors' : ''}`}>
        <i>{c.absence}</i>
      </td>
    );
  if (!c.postes.length && !c.garde) return <td className={`f-c${ferme ? ' ferme' : ' repos'}${hors ? ' hors' : ''}`}>{ferme ? '' : mois ? '–' : 'Repos'}</td>;
  const moment = c.postes.length ? momentDe(c.postes[0]) : 'garde';
  return (
    <td className={`f-c poste ${moment}${hors ? ' hors' : ''}`}>
      {c.postes.map((s) => (
        <span key={s.start} className="f-poste">
          <b>{mois ? `${heureCourte(s.start)}–${heureCourte(s.end)}` : `${fmtHeure(s.start)} – ${fmtHeure(s.end)}`}</b>
          {/* Les pauses : la pause déjeuner (« déj. »), puis les pauses courtes (« p. ») à leur heure. */}
          {!mois && detail ? (
            <>
              {s.pauseStart !== undefined && s.pauseEnd !== undefined ? (
                <small>
                  déj. {fmtHeure(s.pauseStart)} – {fmtHeure(s.pauseEnd)}
                </small>
              ) : null}
              {s.pauses?.length ? <small>p. {s.pauses.map((x) => fmtHeure(x.start)).join(' · ')}</small> : null}
            </>
          ) : s.pauseStart !== undefined || s.pauses?.length ? (
            <small>
              {s.pauseStart !== undefined && s.pauseEnd !== undefined ? `déj. ${heureCourte(s.pauseStart)}–${heureCourte(s.pauseEnd)}` : ''}
              {s.pauseStart !== undefined && s.pauses?.length ? ' · ' : ''}
              {s.pauses?.length ? `p. ${s.pauses.map((x) => heureCourte(x.start)).join(', ')}` : ''}
            </small>
          ) : null}
          {!mois && s.tache ? <small className="f-tache">{ACTIVITE_COURT[s.tache]}</small> : null}
        </span>
      ))}
      {c.garde ? <small className="f-garde">{c.garde}</small> : null}
    </td>
  );
}

function Bloc({ b, mois, gestion }: { b: BlocSemaine; mois: boolean; gestion: boolean }): JSX.Element {
  const lundi = b.monday;
  return (
    <div className="f-bloc">
      {mois ? (
        <div className="f-bloc-titre">
          <b>
            Semaine {b.semaine}
            {b.suite ? ' (suite)' : ''}
          </b>
          <span>
            du {fmtDateCourt(lundi)} au {fmtDateCourt(addDays(lundi, 6))}
          </span>
          <span className={`f-etat-bloc ${b.etat}`}>{ETAT[b.etat]}</span>
        </div>
      ) : null}
      <table className="f-table">
        <colgroup>
          <col className="f-col-nom" />
          {b.jours.map((j) => (
            <col key={j.date} />
          ))}
          <col className="f-col-total" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="f-h-nom">
              {b.suite && !mois ? 'Équipe (suite)' : 'Équipe'}
            </th>
            {b.jours.map((j, i) => (
              <th key={j.date} scope="col" className={`${j.ferme ? 'ferme' : ''}${j.horsMois ? ' hors' : ''}`}>
                <b>
                  {mois ? capitale(JOURS_COURT[i]) : capitale(JOURS[i])} {Number(j.date.slice(8))}
                </b>
                {!mois ? <span>{j.ferie ?? (j.ferme ? 'Fermé' : ' ')}</span> : j.ferie ? <span>férié</span> : null}
              </th>
            ))}
            <th scope="col" className="f-h-total">
              Heures
            </th>
          </tr>
        </thead>
        <tbody>
          {b.groupes.map((g) => (
            <FragmentGroupe key={g.titre + (g.lignes[0]?.personne.id ?? '')} titre={mois ? null : g.titre}>
              {g.lignes.map((l) => (
                <tr key={l.personne.id} style={{ height: `${l.hauteur}mm` }}>
                  <th scope="row" className="f-nom">
                    <b>{nomCourt(l.personne)}</b>
                    {!mois ? <span>{l.personne.externe ? 'Remplaçant' : QUALIFICATION_COURT[l.personne.qualification]}</span> : null}
                  </th>
                  {l.cases.map((c, i) => (
                    <Case key={b.jours[i].date} c={c} ferme={b.jours[i].ferme} hors={b.jours[i].horsMois} mois={mois} detail={l.hauteur >= 8.5} />
                  ))}
                  <td className="f-total">
                    <b>{l.minutes ? fmtDuree(l.minutes) : '–'}</b>
                    {!mois && gestion && l.personne.salarie ? <span>sur {l.personne.heuresHebdo} h</span> : null}
                  </td>
                </tr>
              ))}
            </FragmentGroupe>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentGroupe({ titre, children }: { titre: string | null; children: React.ReactNode }): JSX.Element {
  return (
    <>
      {titre ? (
        <tr className="f-groupe">
          <th colSpan={9} scope="colgroup">
            {titre}
          </th>
        </tr>
      ) : null}
      {children}
    </>
  );
}

/** Une page A4 en paysage, à sa taille réelle. La même sert à l'aperçu et au papier. */
function Feuille({ doc, page, encre, officine, seul, gestion, date }: { doc: DocumentImprime; page: number; encre: Encre; officine: string; seul?: Person; gestion: boolean; date: ISODate }): JSX.Element {
  const p = doc.pages[page];
  const mois = doc.periode === 'mois';
  const premier = p.blocs[0];
  return (
    <section className={`feuille ${doc.periode}${encre === 'nb' ? ' nb' : ''}`} aria-label={`Page ${page + 1} sur ${doc.pages.length}`}>
      <header className="f-tete">
        <div>
          <div className="f-officine">{officine || 'Pharmacie'}</div>
          <h1>
            {seul ? `Planning de ${nomComplet(seul)}` : 'Planning de l’équipe'} · {doc.titre}
          </h1>
          <div className="f-sous">{doc.sousTitre}</div>
        </div>
        <div className="f-meta">
          {!mois ? (
            <span className={`f-statut ${premier.etat}`}>
              {premier.etat === 'publie' && premier.publieLe ? `Publié le ${fmtHorodatage(premier.publieLe)}` : ETAT[premier.etat]}
            </span>
          ) : doc.brouillon ? (
            <span className="f-statut brouillon">Contient des semaines en brouillon</span>
          ) : null}
          <span>Imprimé le {fmtDateLong(date)}</span>
        </div>
      </header>
      <div className="f-corps">
        {p.blocs.map((b) => (
          <Bloc key={`${b.monday}${b.suite ? 's' : ''}${b.groupes[0]?.lignes[0]?.personne.id ?? ''}`} b={b} mois={mois} gestion={gestion} />
        ))}
      </div>
      <footer className="f-pied">
        {encre === 'couleur' ? (
          <ul className="f-legende" aria-label="Légende">
            <li><i className="matin" /> Matin</li>
            <li><i className="milieu" /> Journée</li>
            <li><i className="journee" /> Journée longue</li>
            <li><i className="soir" /> Soir</li>
            <li><i className="conge" /> Congé</li>
            <li><i className="arret" /> Arrêt</li>
            <li><i className="formation" /> Formation</li>
            <li><i className="ferme" /> Fermé</li>
            <li className="f-abrev">déj. : pause déjeuner · p. : pauses courtes</li>
          </ul>
        ) : (
          <p className="f-legende-nb">
            <b>En gras</b> : les heures du poste. <i>En italique, cadre pointillé</i> : absence. Case hachurée : pharmacie fermée. {mois ? '« – »' : '« Repos »'} : pas de poste ce jour-là. « déj. » : pause déjeuner. « p. » : pauses courtes.
          </p>
        )}
        <span className="f-page">
          Solvéa · page {page + 1} sur {doc.pages.length}
        </span>
      </footer>
    </section>
  );
}

/**
 * L'aperçu avant impression : la feuille telle qu'elle sortira, à la semaine ou au mois, en couleur ou en noir et
 * blanc, pour toute l'équipe ou pour soi. Ce que l'on voit est ce qui s'imprime : la même feuille sert aux deux.
 */
export function ApercuImpression({ moi, gestion }: { moi: Person; gestion: boolean }): JSX.Element | null {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const demande = useUi((s) => s.impression);
  const fermer = useUi((s) => s.ouvrirImpression);
  const dire = useUi((s) => s.dire);
  const [periode, setPeriode] = useState<Periode>(demande?.periode ?? 'semaine');
  const [repere, setRepere] = useState<ISODate>(demande?.repere ?? today);
  const [encre, setEncre] = useState<Encre>('couleur');
  const [qui, setQui] = useState<'equipe' | 'moi'>(demande?.moi ? 'moi' : 'equipe');
  const zone = useRef<HTMLDivElement>(null);
  const [echelle, setEchelle] = useState(0.8);

  const doc = useMemo(() => documentImpression(data, { periode, repere, gestion, moi: moi.id, ...(qui === 'moi' ? { seulement: moi.id } : {}) }), [data, periode, repere, gestion, moi.id, qui]);

  // La feuille est réduite pour tenir dans la largeur de l'aperçu ; elle garde ses proportions.
  useLayoutEffect(() => {
    const el = zone.current;
    if (!el) return;
    // La page entière doit se voir : elle tient dans la largeur, et dans la hauteur que la fenêtre laisse.
    const mesurer = (): void => setEchelle(Math.min(1, Math.max(0.2, Math.min((el.clientWidth - 32) / (PAGE.largeur * MM), (Math.max(300, window.innerHeight - 370) - 32) / (PAGE.hauteur * MM)))));
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    window.addEventListener('resize', mesurer);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', mesurer);
    };
  }, []);

  // Pendant que l'aperçu est ouvert, seule la feuille s'imprime, en A4 paysage et sans marge ajoutée par le navigateur.
  useEffect(() => {
    document.documentElement.classList.add('impression');
    const style = document.createElement('style');
    style.textContent = '@page { size: A4 landscape; margin: 0; }';
    document.head.appendChild(style);
    return () => {
      document.documentElement.classList.remove('impression');
      style.remove();
    };
  }, []);

  if (!demande) return null;
  const lundi = mondayOf(repere);
  const libelle = periode === 'semaine' ? `${doc.titre} · ${fmtDateCourt(lundi)} au ${fmtDateCourt(addDays(lundi, 6))}` : doc.titre;
  const avancer = (sens: 1 | -1): void => setRepere(periode === 'semaine' ? addDays(lundi, 7 * sens) : `${moisDecale(repere.slice(0, 7), sens)}-01`);
  const feuilles = doc.pages.map((_, i) => <Feuille key={i} doc={doc} page={i} encre={encre} officine={data.officine.nom} seul={qui === 'moi' ? moi : undefined} gestion={gestion} date={today} />);
  return (
    <>
      <Dialog
        size="wide"
        title="Aperçu avant impression"
        subtitle="La feuille telle qu’elle sortira. Choisissez la période et l’encre, puis imprimez."
        onClose={() => fermer(null)}
        footer={
          <>
            <span className="imp-format small soft" id="imp-format">
              {doc.pages.length} page{doc.pages.length > 1 ? 's' : ''} · A4 paysage
            </span>
            <button type="button" className="btn" onClick={() => fermer(null)}>
              Fermer
            </button>
            <button type="button" className="btn primary" id="imp-imprimer" onClick={() => imprimer(dire)} data-autofocus>
              <Printer size={16} aria-hidden="true" /> Imprimer
            </button>
          </>
        }
      >
        <div className="imp">
          <div className="imp-outils">
            <Seg<Periode> label="Période" value={periode} onChange={setPeriode} options={[{ value: 'semaine', label: 'Semaine' }, { value: 'mois', label: 'Mois' }]} />
            <div className="imp-nav" role="group" aria-label="Période affichée">
              <button type="button" className="btn ghost icon" aria-label={periode === 'semaine' ? 'Semaine précédente' : 'Mois précédent'} onClick={() => avancer(-1)}>
                <ChevronLeft size={18} />
              </button>
              <span className="imp-periode" aria-live="polite" id="imp-periode">
                {libelle}
              </span>
              <button type="button" className="btn ghost icon" aria-label={periode === 'semaine' ? 'Semaine suivante' : 'Mois suivant'} onClick={() => avancer(1)}>
                <ChevronRight size={18} />
              </button>
            </div>
            <Seg<Encre> label="Encre" value={encre} onChange={setEncre} options={[{ value: 'couleur', label: 'Couleur' }, { value: 'nb', label: 'Noir et blanc' }]} />
            <Seg<'equipe' | 'moi'> label="Personnes imprimées" value={qui} onChange={setQui} options={[{ value: 'equipe', label: 'Toute l’équipe' }, { value: 'moi', label: 'Mes postes' }]} />
          </div>
          {doc.vide ? (
            <p className="imp-note" role="status">
              {gestion ? 'Aucun poste n’est posé sur cette période : la feuille sortirait vide.' : 'Le planning de cette période n’est pas encore publié : la feuille sortirait vide.'}
            </p>
          ) : doc.brouillon ? (
            <p className="imp-note" role="status">
              Cette feuille contient un planning en brouillon, pas encore publié : la mention figure sur le papier.
            </p>
          ) : null}
          <div className="imp-zone" ref={zone} tabIndex={0} role="region" aria-label={`Aperçu, ${doc.pages.length} page${doc.pages.length > 1 ? 's' : ''}`}>
            {feuilles.map((f, i) => (
              <div key={i} className="imp-cadre" style={{ width: PAGE.largeur * MM * echelle, height: PAGE.hauteur * MM * echelle }}>
                <div className="imp-reduit" style={{ transform: `scale(${echelle})` }}>
                  {f}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Dialog>
      {/* La copie qui part à l'imprimante : la même feuille, à sa taille réelle, invisible à l'écran. */}
      {createPortal(
        <div className="impression-doc" aria-hidden="true">
          {feuilles}
        </div>,
        document.body,
      )}
    </>
  );
}
