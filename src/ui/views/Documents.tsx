import { CalendarCheck, CalendarOff, Download, Eye, FileText, FolderOpen, Lock, Paperclip, Trash2, Upload, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Espace } from '../../domain/acces';
import { MOIS, addDays, fmtDateCourt, fmtDuree, fmtSemaine } from '../../domain/time';
import type { CategorieDoc, DocumentGed } from '../../domain/types';
import { CATEGORIE_DOC_LABEL, classeAbsence, libelleAbsence, nomCourt } from '../../domain/types';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { PDF_MAX, lirePdf, reduireImage } from '../components/Remplacer';
import { Avatar } from '../kit';

type Onglet = 'plannings' | 'absences' | 'fichiers' | 'equipe';
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
  const recus = gestion ? documents.filter((d) => d.personId !== personId && d.partage).sort((a, b) => b.at.localeCompare(a.at)) : [];
  const place = documents.reduce((t, d) => t + d.taille, 0);

  const deposer = async (fichier: File | undefined): Promise<void> => {
    setErreur('');
    if (!fichier) return;
    try {
      const lu = fichier.type.startsWith('image/') ? await reduireImage(fichier) : fichier.type === 'application/pdf' ? (fichier.size > PDF_MAX ? null : await lirePdf(fichier)) : undefined;
      if (lu === undefined) return setErreur('Déposez une photo ou un PDF.');
      if (lu === null) return setErreur('Ce PDF dépasse 600 Ko : photographiez plutôt le document.');
      if (place + lu.taille > PLACE_MAX) return setErreur('Il n’y a plus assez de place sur cet appareil : supprimez un ancien document.');
      ajouterDocument({ personId, nom: lu.nom, type: lu.type, taille: lu.taille, data: lu.data, categorie, partage: gestion ? false : partage });
      dire('Document rangé dans votre espace.', true);
    } catch {
      setErreur('Ce fichier n’a pas pu être lu. Essayez une photo.');
    }
  };
  const ouvrirSemaine = (lundi: string): void => {
    setSemaine(lundi);
    setSeulementMoi(!gestion);
    aller(gestion ? 'construire' : 'planning');
  };

  const onglets: { cle: Onglet; nom: string; n: number; icone: JSX.Element }[] = [
    { cle: 'plannings', nom: gestion ? 'Plannings publiés' : 'Mes plannings', n: plannings.reduce((t, [, l]) => t + l.length, 0), icone: <CalendarCheck size={15} /> },
    { cle: 'absences', nom: 'Mes absences et arrêts', n: absences.length, icone: <CalendarOff size={15} /> },
    { cle: 'fichiers', nom: 'Mes fichiers', n: miens.length, icone: <Paperclip size={15} /> },
    ...(gestion ? [{ cle: 'equipe' as const, nom: 'Reçus de l’équipe', n: recus.length, icone: <Users size={15} /> }] : []),
  ];
  const ligneDoc = (d: DocumentGed, aMoi: boolean): JSX.Element => {
    const p = data.personnes.find((x) => x.id === d.personId);
    return (
      <li key={d.id} className="doc">
        <span className={`doc-pic ${d.categorie}`} aria-hidden="true">
          <FileText size={18} />
        </span>
        <span className="doc-corps">
          <b>{d.nom}</b>
          <span className="small soft">
            {CATEGORIE_DOC_LABEL[d.categorie]} · déposé le {jour(d.at)} · {poids(d.taille)}
            {!aMoi && p ? ` · ${nomCourt(p)}` : ''}
          </span>
        </span>
        {aMoi && !gestion ? (
          <label className="check doc-partage">
            <input type="checkbox" checked={d.partage} onChange={(e) => partagerDocument(d.id, e.target.checked)} />
            <span className="small">Visible par les titulaires</span>
          </label>
        ) : null}
        <a className="btn sm" href={d.data} download={d.nom}>
          <Download size={14} aria-hidden="true" /> Ouvrir
        </a>
        {aMoi ? (
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
    <div style={{ maxWidth: 1000 }}>
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
    </div>
  );
}
