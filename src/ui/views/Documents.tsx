import { CalendarCheck, CalendarOff, Download, Eye, FileText, FolderOpen, History, Lock, Paperclip, ShieldCheck, Trash2, Upload, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Espace } from '../../domain/acces';
import { MOIS, addDays, dayIndex, fmtDateCourt, fmtDuree, fmtHeure, fmtSemaine } from '../../domain/time';
import type { CategorieDoc, DocumentGed, ISODate } from '../../domain/types';
import { CATEGORIE_DOC_LABEL, ECART_LABEL, MOTIF_REMPLACEMENT_LABEL, URGENCE_LABEL, classeAbsence, libelleAbsence, nomCourt } from '../../domain/types';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { PDF_MAX, lirePdf, reduireImage } from '../components/Remplacer';
import { Avatar } from '../kit';

type Onglet = 'plannings' | 'absences' | 'fichiers' | 'equipe' | 'historique';
/** Ce que l'historique de l'équipe distingue. */
type Nature = 'arret' | 'conge' | 'formation' | 'remplacement' | 'imprevu' | 'autre';
const NATURE_LABEL: Record<Nature, string> = { arret: 'Arrêts', conge: 'Congés', formation: 'Formations', remplacement: 'Remplacements', imprevu: 'Absences non prévues', autre: 'Autres' };
interface Evenement {
  cle: string;
  personId: string;
  from: ISODate;
  to: ISODate;
  nature: Nature;
  classe: string;
  titre: string;
  detail: string;
  issue: { mot: string; ton: 'ok' | 'danger' | 'warn' } | null;
}
/** Place totale laissée aux documents sur l'appareil : au-delà, le navigateur refuserait d'enregistrer. */
const PLACE_MAX = 3 * 1024 * 1024;
const poids = (o: number): string => (o >= 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);
const jour = (iso: string): string => fmtDateCourt(iso.slice(0, 10));

/** Mes documents : mes anciens plannings, mes absences et arrêts, et les fichiers que je dépose. */
export function Documents({ personId, espace }: { personId: string; espace: Espace }): JSX.Element {
  const data = useStore((s) => s.data);
  const today = useStore((s) => s.today);
  const { ajouterDocument, supprimerDocument, partagerDocument } = useStore();
  const { aller, setSemaine, setSeulementMoi, dire } = useUi();
  const gestion = espace === 'responsable';
  const [onglet, setOnglet] = useState<Onglet>('plannings');
  const [categorie, setCategorie] = useState<CategorieDoc>('arret');
  const [partage, setPartage] = useState(true);
  const [erreur, setErreur] = useState('');
  const [qui, setQui] = useState('');
  const [nature, setNature] = useState<Nature | ''>('');
  // Les pièces justificatives ne regardent que les titulaires, pas une personne à qui la gestion est confiée.
  const titulaire = data.personnes.find((p) => p.id === personId)?.qualification === 'titulaire';

  // Mes plannings publiés, du plus récent au plus ancien, rangés par mois.
  const plannings = useMemo(() => {
    const semaines = Object.entries(data.semaines)
      .filter(([, s]) => s.statut === 'publie')
      .map(([lundi, s]) => {
        const miens = (s.snapshot ?? []).filter((x) => gestion || x.personId === personId);
        const minutes = miens.filter((x) => x.personId === personId).reduce((t, x) => t + x.end - x.start - ((x.pauseEnd ?? 0) - (x.pauseStart ?? 0)), 0);
        return { lundi, postes: miens.length, minutes, passee: addDays(lundi, 6) < today };
      })
      .filter((s) => s.postes > 0)
      .sort((a, b) => b.lundi.localeCompare(a.lundi));
    const parMois = new Map<string, typeof semaines>();
    for (const s of semaines) parMois.set(s.lundi.slice(0, 7), (parMois.get(s.lundi.slice(0, 7)) ?? []).concat(s));
    return [...parMois.entries()];
  }, [data.semaines, personId, gestion, today]);
  const absences = data.absences.filter((a) => a.personId === personId).sort((a, b) => b.from.localeCompare(a.from));
  const documents = data.documents ?? [];
  const miens = documents.filter((d) => d.personId === personId).sort((a, b) => b.at.localeCompare(a.at));
  const recus = gestion
    ? documents
        .filter((d) => d.personId !== personId && d.partage && (titulaire || d.categorie !== 'justificatif'))
        .sort((a, b) => a.personId.localeCompare(b.personId) || b.at.localeCompare(a.at))
    : [];

  // L'historique de l'équipe : absences, arrêts, formations, remplacements demandés et absences non prévues.
  const historique = useMemo((): Evenement[] => {
    if (!gestion) return [];
    const nomDe = (id: string | undefined): string => {
      const p = data.personnes.find((x) => x.id === id);
      return p ? nomCourt(p) : 'quelqu’un';
    };
    const liste: Evenement[] = [];
    for (const a of data.absences) {
      const jours = dayIndex(a.to) - dayIndex(a.from) + 1;
      liste.push({
        cle: a.id,
        personId: a.personId,
        from: a.from,
        to: a.to,
        nature: a.type === 'maladie' ? 'arret' : a.type,
        classe: classeAbsence(a.type),
        titre: libelleAbsence(a),
        detail: `${a.from === a.to ? `Le ${fmtDateCourt(a.from)}` : `Du ${fmtDateCourt(a.from)} au ${fmtDateCourt(a.to)}`} · ${jours} jour${jours > 1 ? 's' : ''}`,
        issue: a.statut === 'approuvee' ? { mot: 'Acceptée', ton: 'ok' } : a.statut === 'refusee' ? { mot: 'Refusée', ton: 'danger' } : { mot: 'En attente', ton: 'warn' },
      });
    }
    for (const r of data.remplacements) {
      if (r.trouId || r.statut === 'annulee') continue;
      const motif = titulaire && r.motif ? ` · ${MOTIF_REMPLACEMENT_LABEL[r.motif]}` : '';
      liste.push({
        cle: r.id,
        personId: r.demandeur,
        from: r.date,
        to: r.date,
        nature: 'remplacement',
        classe: r.urgence === 'medical' ? 'arret' : 'planning',
        titre: `Remplacement demandé${r.urgence && r.urgence !== 'prevu' ? ` · ${URGENCE_LABEL[r.urgence]}` : ''}`,
        detail: `Le ${fmtDateCourt(r.date)}, ${fmtHeure(r.start)} – ${fmtHeure(r.end)}${motif}${r.statut === 'acceptee' ? ` · remplacé par ${nomDe(r.remplacantId)}` : ''}`,
        issue: r.statut === 'acceptee' ? { mot: 'Accepté', ton: 'ok' } : r.statut === 'refusee' ? { mot: 'Refusé', ton: 'danger' } : { mot: 'En attente', ton: 'warn' },
      });
    }
    for (const e of data.ecarts ?? []) {
      if (e.type !== 'absence') continue;
      liste.push({ cle: e.id, personId: e.personId, from: e.date, to: e.date, nature: 'imprevu', classe: 'absence', titre: ECART_LABEL.absence, detail: `Le ${fmtDateCourt(e.date)}`, issue: null });
    }
    return liste.sort((a, b) => b.from.localeCompare(a.from));
  }, [data.absences, data.remplacements, data.ecarts, data.personnes, gestion, titulaire]);
  const duChoix = historique.filter((e) => !qui || e.personId === qui);
  const visibles = duChoix.filter((e) => !nature || e.nature === nature);
  const parMoisHist = useMemo(() => {
    const m = new Map<string, Evenement[]>();
    for (const e of visibles) m.set(e.from.slice(0, 7), (m.get(e.from.slice(0, 7)) ?? []).concat(e));
    return [...m.entries()];
  }, [visibles]);
  // Douze derniers mois, pour la personne choisie ou pour toute l'équipe.
  const debut = addDays(today, -365);
  const joursDe = (n: Nature): number =>
    duChoix
      .filter((e) => e.nature === n && e.issue?.ton === 'ok' && e.to >= debut && e.from <= today)
      .reduce((t, e) => t + dayIndex(e.to < today ? e.to : today) - dayIndex(e.from > debut ? e.from : debut) + 1, 0);
  const pieces = documents.filter((d) => d.categorie === 'justificatif' || d.categorie === 'arret').filter((d) => d.partage && (!qui || d.personId === qui));
  const place = documents.reduce((t, d) => t + d.taille, 0);

  /** Lit une photo ou un PDF ; dit pourquoi quand le fichier ne convient pas. */
  const lire = async (fichier: File | undefined): Promise<{ nom: string; type: string; taille: number; data: string } | null> => {
    setErreur('');
    if (!fichier) return null;
    try {
      const lu = fichier.type.startsWith('image/') ? await reduireImage(fichier) : fichier.type === 'application/pdf' ? (fichier.size > PDF_MAX ? null : await lirePdf(fichier)) : undefined;
      if (lu === undefined) setErreur('Déposez une photo ou un PDF.');
      else if (lu === null) setErreur('Ce PDF dépasse 600 Ko : photographiez plutôt le document.');
      else if (place + lu.taille > PLACE_MAX) setErreur('Il n’y a plus assez de place sur cet appareil : supprimez un ancien document.');
      else return lu;
    } catch {
      setErreur('Ce fichier n’a pas pu être lu. Essayez une photo.');
    }
    return null;
  };
  const deposer = async (fichier: File | undefined): Promise<void> => {
    const lu = await lire(fichier);
    if (!lu) return;
    ajouterDocument({ personId, ...lu, categorie, partage: gestion ? false : partage });
    dire('Document rangé dans votre espace.', true);
  };
  /** Le titulaire range la pièce qu'on lui a remise, rattachée à l'absence ou à la demande. */
  const joindre = async (e: Evenement, fichier: File | undefined): Promise<void> => {
    const lu = await lire(fichier);
    if (!lu) return;
    ajouterDocument({ personId: e.personId, ...lu, categorie: e.nature === 'arret' ? 'arret' : 'justificatif', partage: true, origine: `${e.titre} · ${fmtDateCourt(e.from)}`, source: e.cle });
    dire('Justificatif conservé.', true);
  };
  const ouvrirSemaine = (lundi: string): void => {
    setSemaine(lundi);
    setSeulementMoi(!gestion);
    aller(gestion ? 'construire' : 'planning');
  };

  const onglets: { cle: Onglet; nom: string; n: number; icone: JSX.Element }[] = [
    { cle: 'plannings', nom: gestion ? 'Plannings publiés' : 'Mes plannings', n: plannings.reduce((t, [, l]) => t + l.length, 0), icone: <CalendarCheck size={15} /> },
    { cle: 'absences', nom: 'Mes absences', n: absences.length, icone: <CalendarOff size={15} /> },
    { cle: 'fichiers', nom: 'Mes fichiers', n: miens.length, icone: <Paperclip size={15} /> },
    ...(gestion
      ? [
          { cle: 'equipe' as const, nom: 'Reçus de l’équipe', n: recus.length, icone: <Users size={15} /> },
          { cle: 'historique' as const, nom: 'Absences de l’équipe', n: historique.length, icone: <History size={15} /> },
        ]
      : []),
  ];
  const ligneDoc = (d: DocumentGed, aMoi: boolean): JSX.Element => {
    const p = data.personnes.find((x) => x.id === d.personId);
    // Une pièce conservée par les titulaires : la personne la voit, sans pouvoir la retirer.
    const conserve = aMoi && !gestion && !!d.origine;
    return (
      <li key={d.id} className="doc">
        <span className={`doc-pic ${d.categorie}`} aria-hidden="true">
          <FileText size={18} />
        </span>
        <span className="doc-corps">
          <b>{d.nom}</b>
          <span className="small soft">
            {CATEGORIE_DOC_LABEL[d.categorie]} · {d.origine ? `${d.origine} · conservé` : 'déposé'} le {jour(d.at)} · {poids(d.taille)}
            {!aMoi && p ? ` · ${nomCourt(p)}` : ''}
          </span>
          {conserve ? (
            <span className="doc-garde small">
              <ShieldCheck size={13} aria-hidden="true" /> Conservé par vos titulaires
            </span>
          ) : null}
        </span>
        {aMoi && !gestion && !d.origine ? (
          <label className="check doc-partage">
            <input type="checkbox" checked={d.partage} onChange={(e) => partagerDocument(d.id, e.target.checked)} />
            <span className="small">Visible par les titulaires</span>
          </label>
        ) : null}
        <a className="btn sm" href={d.data} download={d.nom}>
          <Download size={14} aria-hidden="true" /> Ouvrir
        </a>
        {(aMoi && !conserve) || (titulaire && !!d.origine) ? (
          <button
            type="button"
            className="btn ghost icon"
            aria-label={`Supprimer ${d.nom}`}
            onClick={() => {
              supprimerDocument(d.id);
              dire('Document supprimé.', true);
            }}
          >
            <Trash2 size={15} />
          </button>
        ) : null}
      </li>
    );
  };

  return (
    <div style={{ maxWidth: 1110 }}>
      <div className="page-head">
        <span className="page-ico" aria-hidden="true">
          <FolderOpen size={26} />
        </span>
        <div className="grow">
          <div className="eyebrow">{gestion ? 'Bilan' : 'Mon espace'}</div>
          <h1>
            Mes <span className="hl">documents</span>
          </h1>
          <p>Vos anciens plannings, vos absences et les fichiers que vous déposez, au même endroit.</p>
        </div>
      </div>
      <div className="jr-barre">
        <div className="jr-filtres" role="tablist" aria-label="Mes documents">
          {onglets.map((o) => (
            <button key={o.cle} type="button" role="tab" aria-selected={onglet === o.cle} className={`jr-filtre${onglet === o.cle ? ' on' : ''}`} onClick={() => setOnglet(o.cle)}>
              <span aria-hidden="true">{o.icone}</span> {o.nom} <span className="rg-nb num">{o.n}</span>
            </button>
          ))}
        </div>
      </div>

      {onglet === 'plannings' ? (
        plannings.length ? (
          plannings.map(([mois, liste]) => (
            <section key={mois} className="jr-jour">
              <h2 className="jr-date cap1">
                {MOIS[Number(mois.slice(5)) - 1]} {mois.slice(0, 4)}
              </h2>
              <ul className="card doc-liste">
                {liste.map((s) => (
                  <li key={s.lundi} className="doc">
                    <span className={`doc-pic ${s.passee ? 'ancien' : 'planning'}`} aria-hidden="true">
                      <CalendarCheck size={18} />
                    </span>
                    <span className="doc-corps">
                      <b>Semaine du {fmtSemaine(s.lundi)}</b>
                      <span className="small soft">
                        {gestion ? `${s.postes} postes publiés` : `${s.postes} poste${s.postes > 1 ? 's' : ''} · ${fmtDuree(s.minutes)}`}
                        {s.passee ? ' · terminée' : ''}
                      </span>
                    </span>
                    <button type="button" className="btn sm" onClick={() => ouvrirSemaine(s.lundi)}>
                      <Eye size={14} aria-hidden="true" /> Voir
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <div className="card empty">Aucun planning publié pour l’instant.</div>
        )
      ) : null}

      {onglet === 'absences' ? (
        absences.length ? (
          <ul className="card doc-liste">
            {absences.map((a) => {
              const jours = Math.round((Date.parse(a.to) - Date.parse(a.from)) / 86_400_000) + 1;
              return (
                <li key={a.id} className="doc">
                  <span className={`doc-pic ${classeAbsence(a.type)}`} aria-hidden="true">
                    <CalendarOff size={18} />
                  </span>
                  <span className="doc-corps">
                    <b>{libelleAbsence(a)}</b>
                    <span className="small soft">
                      {a.from === a.to ? `Le ${fmtDateCourt(a.from)}` : `Du ${fmtDateCourt(a.from)} au ${fmtDateCourt(a.to)}`} · {jours} jour{jours > 1 ? 's' : ''}
                      {a.to < today ? ' · passée' : ''}
                    </span>
                  </span>
                  <span className={`pill ${a.statut === 'approuvee' ? 'ok' : a.statut === 'refusee' ? 'danger' : 'warn'}`}>{a.statut === 'approuvee' ? 'Acceptée' : a.statut === 'refusee' ? 'Refusée' : 'En attente'}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="card empty">Aucune absence enregistrée.</div>
        )
      ) : null}

      {onglet === 'fichiers' ? (
        <>
          <div className="card pad doc-depot">
            <div className="grow">
              <h2 className="h3">Déposer un document</h2>
              <p className="small soft" style={{ margin: '3px 0 0' }}>Une photo ou un PDF de 600 Ko au plus. Pour un arrêt, déposez le volet destiné à l’employeur.</p>
            </div>
            <div className="row wrap" style={{ alignItems: 'flex-end' }}>
              <label className="field" htmlFor="doc-categorie">
                Nature
                <select id="doc-categorie" value={categorie} onChange={(e) => setCategorie(e.target.value as CategorieDoc)}>
                  {(Object.keys(CATEGORIE_DOC_LABEL) as CategorieDoc[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIE_DOC_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
              {!gestion ? (
                <label className="check" htmlFor="doc-partage" style={{ paddingBottom: 10 }}>
                  <input id="doc-partage" type="checkbox" checked={partage} onChange={(e) => setPartage(e.target.checked)} />
                  <span>Visible par les titulaires</span>
                </label>
              ) : null}
              <label className="btn primary doc-bouton">
                <Upload size={15} aria-hidden="true" /> Choisir un fichier
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr"
                  onChange={(e) => {
                    void deposer(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {erreur ? (
              <p className="small" role="alert" style={{ color: 'var(--danger-ink)', margin: 0 }}>
                {erreur}
              </p>
            ) : null}
            <p className="tiny muted doc-note">
              <Lock size={12} aria-hidden="true" /> Vos documents restent sur cet appareil : rien n’est envoyé ailleurs. Place utilisée : {poids(place)} sur {poids(PLACE_MAX)}.
            </p>
          </div>
          {miens.length ? <ul className="card doc-liste">{miens.map((d) => ligneDoc(d, true))}</ul> : <div className="card empty">Aucun fichier déposé.</div>}
        </>
      ) : null}

      {onglet === 'equipe' ? (
        recus.length ? (
          <ul className="card doc-liste">
            {recus.flatMap((d, i) => {
              const p = data.personnes.find((x) => x.id === d.personId);
              // Le nom de la personne ouvre son groupe de documents.
              const tete = p && (i === 0 || recus[i - 1].personId !== d.personId) ? [<li key={`qui-${d.id}`} className="doc-qui"><Avatar person={p} /> <b>{nomCourt(p)}</b></li>] : [];
              return [...tete, ligneDoc(d, false)];
            })}
          </ul>
        ) : (
          <div className="card empty">Aucun document partagé par l’équipe.</div>
        )
      ) : null}

      {onglet === 'historique' ? (
        <>
          <div className="hist-tete">
            <label className="field" htmlFor="hist-personne">
              Personne
              <select id="hist-personne" value={qui} onChange={(e) => setQui(e.target.value)}>
                <option value="">Toute l’équipe</option>
                {data.personnes
                  .filter((p) => !p.externe)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {nomCourt(p)}
                    </option>
                  ))}
              </select>
            </label>
            <div className="chiffres hist-chiffres" aria-label="Sur les douze derniers mois">
              <div className="chiffre">
                <b className="num">{joursDe('arret')}</b>
                <span>jour{joursDe('arret') > 1 ? 's' : ''} d’arrêt</span>
              </div>
              <div className="chiffre">
                <b className="num">{joursDe('conge')}</b>
                <span>jour{joursDe('conge') > 1 ? 's' : ''} de congé</span>
              </div>
              <div className="chiffre">
                <b className="num">{duChoix.filter((e) => e.nature === 'imprevu' && e.from >= debut).length}</b>
                <span>absence{duChoix.filter((e) => e.nature === 'imprevu' && e.from >= debut).length > 1 ? 's' : ''} non prévue{duChoix.filter((e) => e.nature === 'imprevu' && e.from >= debut).length > 1 ? 's' : ''}</span>
              </div>
              {titulaire ? (
                <div className="chiffre">
                  <b className="num">{pieces.length}</b>
                  <span>pièce{pieces.length > 1 ? 's' : ''} conservée{pieces.length > 1 ? 's' : ''}</span>
                </div>
              ) : null}
            </div>
            <p className="tiny muted hist-note">Chiffres des douze derniers mois. Des faits datés, jamais un diagnostic.</p>
          </div>
          <div className="jr-barre">
            <div className="jr-filtres" role="group" aria-label="Nature">
              <button type="button" aria-pressed={!nature} className={`jr-filtre${!nature ? ' on' : ''}`} onClick={() => setNature('')}>
                Tout <span className="rg-nb num">{duChoix.length}</span>
              </button>
              {(Object.keys(NATURE_LABEL) as Nature[])
                .filter((n) => duChoix.some((e) => e.nature === n))
                .map((n) => (
                  <button key={n} type="button" aria-pressed={nature === n} className={`jr-filtre${nature === n ? ' on' : ''}`} onClick={() => setNature(nature === n ? '' : n)}>
                    {NATURE_LABEL[n]} <span className="rg-nb num">{duChoix.filter((e) => e.nature === n).length}</span>
                  </button>
                ))}
            </div>
          </div>
          {erreur ? (
            <p className="small" role="alert" style={{ color: 'var(--danger-ink)', margin: '0 0 10px' }}>
              {erreur}
            </p>
          ) : null}
          {parMoisHist.length ? (
            parMoisHist.map(([mois, liste]) => (
              <section key={mois} className="jr-jour">
                <h2 className="jr-date cap1">
                  {MOIS[Number(mois.slice(5)) - 1]} {mois.slice(0, 4)}
                </h2>
                <ul className="card doc-liste">
                  {liste.map((e) => {
                    const p = data.personnes.find((x) => x.id === e.personId);
                    const jointes = titulaire ? documents.filter((d) => d.source === e.cle) : [];
                    return (
                      <li key={e.cle} className="doc">
                        <span className={`doc-pic ${e.classe}`} aria-hidden="true">
                          <CalendarOff size={18} />
                        </span>
                        <span className="doc-corps">
                          <b>
                            {p ? nomCourt(p) : 'Ancien membre'} · {e.titre}
                          </b>
                          <span className="small soft">
                            {e.detail}
                            {e.to < today ? ' · passé' : ''}
                          </span>
                        </span>
                        {e.issue ? <span className={`pill ${e.issue.ton}`}>{e.issue.mot}</span> : null}
                        {jointes.map((d) => (
                          <a key={d.id} className="btn sm" href={d.data} download={d.nom} aria-label={`Ouvrir le justificatif ${d.nom}`}>
                            <Paperclip size={14} aria-hidden="true" /> Justificatif
                          </a>
                        ))}
                        {titulaire && !jointes.length && e.nature !== 'formation' && e.nature !== 'conge' ? (
                          <label className="btn sm ghost doc-bouton">
                            <Upload size={14} aria-hidden="true" /> Joindre
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="sr"
                              aria-label={`Joindre un justificatif : ${p ? nomCourt(p) : ''}, ${e.titre}`}
                              onChange={(ev) => {
                                void joindre(e, ev.target.files?.[0]);
                                ev.target.value = '';
                              }}
                            />
                          </label>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          ) : (
            <div className="card empty">Rien à afficher pour ce choix.</div>
          )}
          {titulaire ? (
            <p className="tiny muted doc-note" style={{ marginTop: 12 }}>
              <Lock size={12} aria-hidden="true" /> Les justificatifs ne sont visibles que des titulaires et de la personne concernée. Supprimez-les quand vous n’en avez plus besoin pour la paie.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
