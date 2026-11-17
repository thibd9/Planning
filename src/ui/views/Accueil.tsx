import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleAlert, Crown, LogIn, Pill as PillIcon, Plus, ShieldCheck, Sparkles, Store, Trash2, UserRound, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { empreinte, identifiantPropose } from '../../domain/acces';
import { fmtHHMM, fmtHeure, parseHHMM, uid } from '../../domain/time';
import type { Interval, Person, Qualification } from '../../domain/types';
import { QUALIFICATION_COURT } from '../../domain/types';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Logo, LogoNom } from '../kit';

interface Ligne {
  cle: string;
  prenom: string;
  nom: string;
  heures: string;
  qualification: Qualification;
}

interface Erreur {
  /** Identifiant du champ fautif : sert à y ramener le focus. */
  champ: string;
  message: string;
}

const ligne = (qualification: Qualification, heures = '35'): Ligne => ({ cle: uid('l'), prenom: '', nom: '', heures, qualification });
const AUTRES: Qualification[] = ['apprenti', 'etudiant', 'rayonniste'];
const ETAPES = [
  { titre: 'La pharmacie', detail: 'Nom et horaires d’ouverture' },
  { titre: 'L’équipe', detail: 'Vous, les pharmaciens, les préparateurs' },
  { titre: 'Vérification', detail: 'Relire avant de créer' },
];
const vide = (l: Ligne): boolean => !l.prenom.trim() && !l.nom.trim();
const complet = (l: Ligne): boolean => !!l.prenom.trim() && !!l.nom.trim();

/** Champ d'heure accessible : libellé visible, format natif du navigateur. */
function Heure({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (n: number) => void }): JSX.Element {
  return (
    <label className="field" htmlFor={id}>
      {label}
      <input
        id={id}
        type="time"
        step={900}
        className="num"
        value={fmtHHMM(value)}
        onChange={(e) => {
          const n = parseHHMM(e.target.value);
          if (n !== null) onChange(n);
        }}
        style={{ width: 132 }}
      />
    </label>
  );
}

function Groupe({
  id,
  titre,
  aide,
  icone,
  ton,
  singulier,
  lignes,
  onChange,
  ajouter,
  libelleAjout,
  avecFonction,
  erreurs,
}: {
  id: string;
  titre: string;
  aide: string;
  icone: JSX.Element;
  ton: string;
  singulier: string;
  lignes: Ligne[];
  onChange: (l: Ligne[]) => void;
  ajouter: () => Ligne;
  libelleAjout: string;
  avecFonction?: boolean;
  erreurs: Erreur[];
}): JSX.Element {
  const maj = (cle: string, patch: Partial<Ligne>): void => onChange(lignes.map((l) => (l.cle === cle ? { ...l, ...patch } : l)));
  const dernier = useRef<string | null>(null);
  useEffect(() => {
    // Après un ajout, le focus va sur le prénom de la nouvelle ligne.
    if (dernier.current) {
      document.getElementById(`${dernier.current}-prenom`)?.focus();
      dernier.current = null;
    }
  });
  return (
    <fieldset className="bloc">
      <legend>
        <span className={`ico ${ton}`} aria-hidden="true">
          {icone}
        </span>
        <span>
          <b>{titre}</b>
          <span className="aide">{aide}</span>
        </span>
      </legend>
      {lignes.length === 0 ? <p className="small soft">Aucune ligne pour l’instant.</p> : null}
      {lignes.map((l, i) => {
        const qui = `${singulier} ${i + 1}`;
        const idL = `${id}-${l.cle}`;
        const err = erreurs.find((e) => e.champ.startsWith(idL));
        return (
          <div key={l.cle} className="col" style={{ gap: 6 }}>
            <div className={`ligne${avecFonction ? ' fn' : ''}`}>
              <label className="field" htmlFor={`${idL}-prenom`}>
                <span className={i === 0 ? undefined : 'sr'}>Prénom{i === 0 ? '' : `, ${qui}`}</span>
                <input id={`${idL}-prenom`} value={l.prenom} onChange={(e) => maj(l.cle, { prenom: e.target.value })} autoComplete="off" aria-invalid={!!err && !l.prenom.trim()} aria-describedby={err ? `${idL}-err` : undefined} />
              </label>
              <label className="field" htmlFor={`${idL}-nom`}>
                <span className={i === 0 ? undefined : 'sr'}>Nom{i === 0 ? '' : `, ${qui}`}</span>
                <input id={`${idL}-nom`} value={l.nom} onChange={(e) => maj(l.cle, { nom: e.target.value })} autoComplete="off" aria-invalid={!!err && !l.nom.trim()} aria-describedby={err ? `${idL}-err` : undefined} />
              </label>
              {avecFonction ? (
                <label className="field" htmlFor={`${idL}-fonction`}>
                  <span className={i === 0 ? undefined : 'sr'}>Fonction{i === 0 ? '' : `, ${qui}`}</span>
                  <select id={`${idL}-fonction`} value={l.qualification} onChange={(e) => maj(l.cle, { qualification: e.target.value as Qualification })}>
                    {AUTRES.map((q) => (
                      <option key={q} value={q}>
                        {QUALIFICATION_COURT[q]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="field" htmlFor={`${idL}-heures`}>
                <span className={i === 0 ? undefined : 'sr'}>Heures par semaine{i === 0 ? '' : `, ${qui}`}</span>
                <input id={`${idL}-heures`} type="number" inputMode="decimal" min={1} max={48} step={0.5} value={l.heures} onChange={(e) => maj(l.cle, { heures: e.target.value })} className="num" />
              </label>
              <button type="button" className="btn ghost icon" aria-label={`Retirer ${complet(l) ? `${l.prenom} ${l.nom}` : qui}`} onClick={() => onChange(lignes.filter((x) => x.cle !== l.cle))}>
                <Trash2 size={17} />
              </button>
            </div>
            {err ? (
              <p className="erreur" id={`${idL}-err`}>
                <CircleAlert size={15} aria-hidden="true" /> {err.message}
              </p>
            ) : null}
          </div>
        );
      })}
      <div>
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            const n = ajouter();
            dernier.current = `${id}-${n.cle}`;
            onChange([...lignes, n]);
          }}
        >
          <Plus size={15} aria-hidden="true" /> {libelleAjout}
        </button>
      </div>
    </fieldset>
  );
}

/**
 * Premier écran : créer l'officine en trois étapes (pharmacie, équipe, vérification).
 * Chaque étape se valide seule ; les erreurs sont listées en tête, reliées à leur champ, et reçoivent le focus.
 */
/**
 * Création d'une pharmacie. `ajout` : le titulaire connecté en ajoute une ;
 * `garder` : un nouveau compte se crée sur un appareil qui a déjà des pharmacies.
 */
export function Accueil({ ajout, onAnnuler, garder }: { ajout?: Person; onAnnuler?: () => void; garder?: boolean } = {}): JSX.Element {
  const { creerOfficine, data, autres: autresPharmacies } = useStore();
  const dejaPris = [data, ...Object.values(autresPharmacies)].flatMap((d) => d.personnes.map((p) => (p.identifiant ?? '').trim().toLowerCase())).filter(Boolean);
  const { setTour, connecter } = useUi();
  const [etape, setEtape] = useState(0);
  const [nom, setNom] = useState('');
  const [semaine, setSemaine] = useState<Interval>({ start: 8 * 60 + 30, end: 19 * 60 + 30 });
  const [coupure, setCoupure] = useState(false);
  const [midi, setMidi] = useState<Interval>({ start: 12 * 60 + 30, end: 14 * 60 });
  const [samediOuvert, setSamediOuvert] = useState(true);
  const [samedi, setSamedi] = useState<Interval>({ start: 9 * 60, end: 19 * 60 });
  const [titulaire, setTitulaire] = useState<Ligne>(ajout ? { ...ligne('titulaire', String(ajout.heuresHebdo)), prenom: ajout.prenom, nom: ajout.nom } : ligne('titulaire', '42'));
  const [identifiant, setIdentifiant] = useState(ajout?.identifiant ?? '');
  const [motDePasse, setMotDePasse] = useState('');
  // Les titulaires secondaires viennent juste sous le titulaire principal ; aucun n'est imposé.
  const [secondaires, setSecondaires] = useState<Ligne[]>([]);
  const [adjoints, setAdjoints] = useState<Ligne[]>([ligne('adjoint')]);
  const [preparateurs, setPreparateurs] = useState<Ligne[]>([ligne('preparateur'), ligne('preparateur')]);
  const [autres, setAutres] = useState<Ligne[]>([]);
  const [erreurs, setErreurs] = useState<Erreur[]>([]);
  const titre = useRef<HTMLHeadingElement>(null);
  const resume = useRef<HTMLDivElement>(null);
  const premiere = useRef(true);

  // À chaque changement d'étape, le focus va sur son titre : le lecteur d'écran annonce où l'on est.
  useEffect(() => {
    if (premiere.current) {
      premiere.current = false;
      return;
    }
    titre.current?.focus();
    document.querySelector('.accueil-form')?.scrollTo({ top: 0 });
  }, [etape]);
  useEffect(() => {
    if (erreurs.length) resume.current?.focus();
  }, [erreurs]);

  const groupes: { id: string; lignes: Ligne[]; singulier: string }[] = [
    { id: 'tit2', lignes: secondaires, singulier: 'titulaire' },
    { id: 'adj', lignes: adjoints, singulier: 'pharmacien adjoint' },
    { id: 'prep', lignes: preparateurs, singulier: 'préparateur' },
    { id: 'autre', lignes: autres, singulier: 'personne' },
  ];

  const valider = (e: number): Erreur[] => {
    const out: Erreur[] = [];
    if (e === 0) {
      if (!nom.trim()) out.push({ champ: 'officine-nom', message: 'Indiquez le nom de la pharmacie.' });
      if (semaine.end <= semaine.start) out.push({ champ: 'sem-fin', message: 'En semaine, la fermeture doit suivre l’ouverture.' });
      if (coupure && !(semaine.start < midi.start && midi.start < midi.end && midi.end < semaine.end)) {
        out.push({ champ: 'midi-debut', message: 'La coupure du midi doit se situer entre l’ouverture et la fermeture.' });
      }
      if (samediOuvert && samedi.end <= samedi.start) out.push({ champ: 'sam-fin', message: 'Le samedi, la fermeture doit suivre l’ouverture.' });
    }
    if (e === 1) {
      if (!titulaire.prenom.trim()) out.push({ champ: 'tit-prenom', message: 'Indiquez le prénom du titulaire.' });
      if (!titulaire.nom.trim()) out.push({ champ: 'tit-nom', message: 'Indiquez le nom du titulaire.' });
      if (!ajout) {
        if (identifiant.trim().length < 3) out.push({ champ: 'tit-identifiant', message: 'Choisissez un identifiant de connexion d’au moins 3 caractères.' });
        else if (dejaPris.includes(identifiant.trim().toLowerCase())) out.push({ champ: 'tit-identifiant', message: 'Cet identifiant a déjà un compte sur cet appareil. Connectez-vous, ou choisissez-en un autre.' });
        if (motDePasse.length < 6) out.push({ champ: 'tit-mdp', message: 'Choisissez un mot de passe d’au moins 6 caractères.' });
      }
      for (const g of groupes) {
        g.lignes.forEach((l, i) => {
          const base = `${g.id}-${l.cle}`;
          if (!vide(l) && !complet(l)) {
            out.push({ champ: `${base}-${l.prenom.trim() ? 'nom' : 'prenom'}`, message: `${g.singulier.charAt(0).toUpperCase() + g.singulier.slice(1)} ${i + 1} : indiquez le prénom et le nom, ou retirez la ligne.` });
          } else if (complet(l) && !(Number(l.heures) >= 1 && Number(l.heures) <= 48)) {
            out.push({ champ: `${base}-heures`, message: `${l.prenom} ${l.nom} : les heures par semaine doivent être comprises entre 1 et 48.` });
          }
        });
      }
    }
    return out;
  };

  const suivant = (): void => {
    const e = valider(etape);
    setErreurs(e);
    if (!e.length) setEtape(etape + 1);
  };
  const versEtape = (n: number): void => {
    setErreurs([]);
    setEtape(n);
  };

  const equipe = [titulaire, ...secondaires, ...adjoints, ...preparateurs, ...autres].filter(complet);
  const horaireSemaine: Interval[] = coupure ? [{ start: semaine.start, end: midi.start }, { start: midi.end, end: semaine.end }] : [{ ...semaine }];
  const nbPharmaciens = 1 + secondaires.filter(complet).length + adjoints.filter(complet).length;

  const creer = (): void => {
    const tout = [...valider(0), ...valider(1)];
    if (tout.length) {
      setEtape(valider(0).length ? 0 : 1);
      setErreurs(tout);
      return;
    }
    // Chaque membre reçoit un identifiant et un mot de passe provisoire, à lui transmettre.
    const pris: string[] = [...dejaPris, identifiant.trim().toLowerCase()];
    const personnes: Person[] = equipe.map((l, i) => {
      const principal = i === 0;
      const id = principal ? identifiant.trim() : identifiantPropose(l.prenom, l.nom, pris);
      pris.push(id);
      const provisoire = principal ? undefined : String(Math.floor(100000 + Math.random() * 900000));
      return {
        id: uid('p'),
        prenom: l.prenom.trim(),
        nom: l.nom.trim(),
        qualification: l.qualification,
        salarie: l.qualification !== 'titulaire',
        heuresHebdo: Math.max(1, Number(l.heures) || 35),
        tauxHoraire: null,
        competences: [],
        volontaireHeuresComp: false,
        volontaireGardes: l.qualification === 'titulaire',
        identifiant: id,
        code: principal ? (ajout?.code ?? empreinte(motDePasse)) : empreinte(provisoire as string),
        provisoire,
      };
    });
    const horaires = [0, 1, 2, 3, 4].map(() => horaireSemaine.map((i) => ({ ...i }))).concat([samediOuvert ? [{ ...samedi }] : []], [[]]);
    creerOfficine(nom.trim(), horaires, personnes, !!ajout || !!garder, !ajout);
    // Celui qui crée la pharmacie en est le titulaire principal : il est connecté d'emblée à son espace.
    connecter(personnes[0].identifiant as string, 'tableau');
    if (!ajout) setTour(0);
  };

  const errDe = (champ: string): Erreur | undefined => erreurs.find((e) => e.champ === champ);
  const plage = (i: Interval): string => `${fmtHeure(i.start)} – ${fmtHeure(i.end)}`;

  return (
    <div className="accueil">
      <a className="skip" href="#creation">
        Aller au formulaire
      </a>
      <aside className="accueil-hero" aria-label="Présentation et étapes">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark">
            <Logo />
          </span>
          <div className="brand-name">
              <LogoNom />
            </div>
        </div>
        <div>
          <p className="accueil-titre">Le planning de votre officine, enfin serein.</p>
          <p className="sous">Trois étapes, deux minutes. Tout reste modifiable ensuite.</p>
        </div>
        <ol className="parcours" aria-label="Étapes de création">
          {ETAPES.map((e, i) => (
            <li key={e.titre} className={i === etape ? 'now' : i < etape ? 'done' : ''} aria-current={i === etape ? 'step' : undefined}>
              <span className="n" aria-hidden="true">
                {i < etape ? <Check size={17} /> : i + 1}
              </span>
              <span>
                <b>
                  <span className="sr">
                    Étape {i + 1} sur {ETAPES.length}
                    {i < etape ? ', terminée' : i === etape ? ', en cours' : ''} :{' '}
                  </span>
                  {e.titre}
                </b>
                <span className="d">{e.detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="accueil-note">
          <ShieldCheck size={20} aria-hidden="true" style={{ flex: 'none', color: 'var(--a-deep)' }} />
          <span>Vos données restent sur cet appareil. Aucune information de santé, de religion ou de vie privée n’est demandée.</span>
        </p>
      </aside>

      <main className="accueil-form" id="creation">
        <form
          className="accueil-in"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (etape < 2) suivant();
            else creer();
          }}
        >
          <div>
            <p className="eyebrow">
              {ajout ? 'Ajouter une pharmacie' : 'Créer mon officine'} · étape {etape + 1} sur {ETAPES.length}
            </p>
            <h1 ref={titre} tabIndex={-1} style={{ marginTop: 6, outline: 'none' }}>
              {etape === 0 ? (
                <>
                  Votre <span className="hl">pharmacie</span>
                </>
              ) : etape === 1 ? (
                <>
                  Votre <span className="hl">équipe</span>
                </>
              ) : (
                <>
                  Tout est <span className="hl">prêt</span> ?
                </>
              )}
            </h1>
            <p className="soft" style={{ marginTop: 10, fontSize: 15 }}>
              {etape === 0
                ? 'Seul le nom est obligatoire. Les horaires proposés sont les plus courants : ajustez-les.'
                : etape === 1
                  ? 'Seul le titulaire est obligatoire. Les lignes laissées vides sont ignorées, et vous pourrez ajouter des personnes plus tard.'
                  : 'Relisez l’essentiel. Rien n’est figé : chaque élément se modifie ensuite dans l’application.'}
            </p>
          </div>

          {erreurs.length ? (
            <div className="resume-erreurs" role="alert" tabIndex={-1} ref={resume}>
              <h2 className="h3">
                <AlertTriangle size={18} aria-hidden="true" />
                {erreurs.length === 1 ? 'Un point à corriger' : `${erreurs.length} points à corriger`}
              </h2>
              <ul>
                {erreurs.map((e) => (
                  <li key={e.champ}>
                    <button type="button" onClick={() => document.getElementById(e.champ)?.focus()}>
                      {e.message}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {etape === 0 ? (
            <div className="card pad col" style={{ gap: 24 }}>
              <fieldset className="bloc">
                <legend>
                  <span className="ico grad" aria-hidden="true">
                    <Store size={18} />
                  </span>
                  <span>
                    <b>Identité</b>
                    <span className="aide">Le nom s’affiche en haut de l’application et sur les exports.</span>
                  </span>
                </legend>
                <label className="field" htmlFor="officine-nom">
                  <span>
                    Nom de la pharmacie <span className="oblig">(obligatoire)</span>
                  </span>
                  <input id="officine-nom" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus autoComplete="organization" required aria-required="true" aria-invalid={!!errDe('officine-nom')} aria-describedby={errDe('officine-nom') ? 'officine-nom-err' : 'officine-nom-aide'} />
                  <span className="aide" id="officine-nom-aide">Par exemple : Pharmacie du Marché.</span>
                  {errDe('officine-nom') ? (
                    <span className="erreur" id="officine-nom-err">
                      <CircleAlert size={15} aria-hidden="true" /> {errDe('officine-nom')?.message}
                    </span>
                  ) : null}
                </label>
              </fieldset>

              <hr className="sep" />

              <fieldset className="bloc">
                <legend>
                  <span className="ico" aria-hidden="true">
                    <Sparkles size={18} />
                  </span>
                  <span>
                    <b>Du lundi au vendredi</b>
                    <span className="aide">Un pharmacien devra être planifié sur chaque minute d’ouverture.</span>
                  </span>
                </legend>
                <div className="row wrap" style={{ alignItems: 'flex-end', gap: 14 }}>
                  <Heure id="sem-debut" label="Ouverture" value={semaine.start} onChange={(n) => setSemaine({ ...semaine, start: n })} />
                  <Heure id="sem-fin" label="Fermeture" value={semaine.end} onChange={(n) => setSemaine({ ...semaine, end: n })} />
                </div>
                {errDe('sem-fin') ? (
                  <p className="erreur">
                    <CircleAlert size={15} aria-hidden="true" /> {errDe('sem-fin')?.message}
                  </p>
                ) : null}
                <label className="check" htmlFor="coupure">
                  <input id="coupure" type="checkbox" checked={coupure} onChange={(e) => setCoupure(e.target.checked)} />
                  <span>
                    La pharmacie ferme le midi
                    <span className="soft small" style={{ display: 'block' }}>Sinon, elle est considérée comme ouverte en continu.</span>
                  </span>
                </label>
                {coupure ? (
                  <div className="row wrap" style={{ alignItems: 'flex-end', gap: 14 }}>
                    <Heure id="midi-debut" label="Fermeture du midi" value={midi.start} onChange={(n) => setMidi({ ...midi, start: n })} />
                    <Heure id="midi-fin" label="Réouverture" value={midi.end} onChange={(n) => setMidi({ ...midi, end: n })} />
                  </div>
                ) : null}
                {errDe('midi-debut') ? (
                  <p className="erreur">
                    <CircleAlert size={15} aria-hidden="true" /> {errDe('midi-debut')?.message}
                  </p>
                ) : null}
              </fieldset>

              <hr className="sep" />

              <fieldset className="bloc">
                <legend>
                  <span className="ico sky" aria-hidden="true">
                    <Sparkles size={18} />
                  </span>
                  <span>
                    <b>Le samedi</b>
                    <span className="aide">Le dimanche est fermé par défaut ; les gardes se gèrent à part.</span>
                  </span>
                </legend>
                <label className="check" htmlFor="samedi-ouvert">
                  <input id="samedi-ouvert" type="checkbox" checked={samediOuvert} onChange={(e) => setSamediOuvert(e.target.checked)} />
                  <span>La pharmacie ouvre le samedi</span>
                </label>
                {samediOuvert ? (
                  <div className="row wrap" style={{ alignItems: 'flex-end', gap: 14 }}>
                    <Heure id="sam-debut" label="Ouverture le samedi" value={samedi.start} onChange={(n) => setSamedi({ ...samedi, start: n })} />
                    <Heure id="sam-fin" label="Fermeture le samedi" value={samedi.end} onChange={(n) => setSamedi({ ...samedi, end: n })} />
                  </div>
                ) : null}
                {errDe('sam-fin') ? (
                  <p className="erreur">
                    <CircleAlert size={15} aria-hidden="true" /> {errDe('sam-fin')?.message}
                  </p>
                ) : null}
              </fieldset>
            </div>
          ) : null}

          {etape === 1 ? (
            <div className="card pad col" style={{ gap: 24 }}>
              <fieldset className="bloc">
                <legend>
                  <span className="ico grad" aria-hidden="true">
                    <UserRound size={18} />
                  </span>
                  <span>
                    <b>Vous, le titulaire principal</b>
                    <span className="aide">Non salarié, vous détenez tous les droits. Vous seul pourrez donner à d’autres l’accès à la gestion.</span>
                  </span>
                </legend>
                <div className="ligne">
                  <label className="field" htmlFor="tit-prenom">
                    <span>
                      Prénom <span className="oblig">(obligatoire)</span>
                    </span>
                    <input id="tit-prenom" value={titulaire.prenom} onChange={(e) => setTitulaire({ ...titulaire, prenom: e.target.value })} autoComplete="off" required aria-required="true" aria-invalid={!!errDe('tit-prenom')} aria-describedby={errDe('tit-prenom') ? 'tit-prenom-err' : undefined} />
                  </label>
                  <label className="field" htmlFor="tit-nom">
                    <span>
                      Nom <span className="oblig">(obligatoire)</span>
                    </span>
                    <input id="tit-nom" value={titulaire.nom} onChange={(e) => setTitulaire({ ...titulaire, nom: e.target.value })} autoComplete="off" required aria-required="true" aria-invalid={!!errDe('tit-nom')} aria-describedby={errDe('tit-nom') ? 'tit-nom-err' : undefined} />
                  </label>
                  <label className="field" htmlFor="tit-heures">
                    Heures par semaine
                    <input id="tit-heures" type="number" inputMode="decimal" min={1} max={70} step={0.5} value={titulaire.heures} onChange={(e) => setTitulaire({ ...titulaire, heures: e.target.value })} className="num" />
                  </label>
                  <span />
                </div>
                {errDe('tit-prenom') ? (
                  <p className="erreur" id="tit-prenom-err">
                    <CircleAlert size={15} aria-hidden="true" /> {errDe('tit-prenom')?.message}
                  </p>
                ) : null}
                {errDe('tit-nom') ? (
                  <p className="erreur" id="tit-nom-err">
                    <CircleAlert size={15} aria-hidden="true" /> {errDe('tit-nom')?.message}
                  </p>
                ) : null}
                {ajout ? (
                  <p className="notice info small">Vous gardez le même identifiant et le même mot de passe pour toutes vos pharmacies.</p>
                ) : (
                  <div className="row wrap" style={{ alignItems: 'flex-start' }}>
                    <label className="field grow" htmlFor="tit-identifiant" style={{ minWidth: 220 }}>
                      <span>
                        Identifiant de connexion <span className="oblig">(obligatoire)</span>
                      </span>
                      <input id="tit-identifiant" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required aria-required="true" aria-invalid={!!errDe('tit-identifiant')} aria-describedby="tit-identifiant-aide" />
                      <span className="aide" id="tit-identifiant-aide">Votre adresse électronique, par exemple.</span>
                      {errDe('tit-identifiant') ? (
                        <span className="erreur">
                          <CircleAlert size={15} aria-hidden="true" /> {errDe('tit-identifiant')?.message}
                        </span>
                      ) : null}
                    </label>
                    <label className="field grow" htmlFor="tit-mdp" style={{ minWidth: 220 }}>
                      <span>
                        Mot de passe <span className="oblig">(obligatoire)</span>
                      </span>
                      <input id="tit-mdp" type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoComplete="new-password" required aria-required="true" aria-invalid={!!errDe('tit-mdp')} aria-describedby="tit-mdp-aide" />
                      <span className="aide" id="tit-mdp-aide">Au moins 6 caractères.</span>
                      {errDe('tit-mdp') ? (
                        <span className="erreur">
                          <CircleAlert size={15} aria-hidden="true" /> {errDe('tit-mdp')?.message}
                        </span>
                      ) : null}
                    </label>
                  </div>
                )}
              </fieldset>
              <hr className="sep" />
              <Groupe id="tit2" titre="Autres titulaires" aide="Vos associés, s’il y en a. Ils n’ont pas accès à la gestion tant que vous ne le leur accordez pas, dans « Équipe »." icone={<Crown size={18} />} ton="mint" singulier="titulaire" lignes={secondaires} onChange={setSecondaires} ajouter={() => ligne('titulaire', '35')} libelleAjout="Ajouter un titulaire" erreurs={erreurs} />
              <hr className="sep" />
              <Groupe id="adj" titre="Pharmaciens adjoints" aide="Avec les titulaires, ils assurent la présence d’un pharmacien, pauses comprises." icone={<PillIcon size={18} />} ton="mint" singulier="pharmacien adjoint" lignes={adjoints} onChange={setAdjoints} ajouter={() => ligne('adjoint')} libelleAjout="Ajouter un pharmacien" erreurs={erreurs} />
              <hr className="sep" />
              <Groupe id="prep" titre="Préparateurs" aide="Indiquez les heures du contrat : un temps partiel est comparé au prorata." icone={<Users size={18} />} ton="sky" singulier="préparateur" lignes={preparateurs} onChange={setPreparateurs} ajouter={() => ligne('preparateur')} libelleAjout="Ajouter un préparateur" erreurs={erreurs} />
              <hr className="sep" />
              <Groupe id="autre" titre="Autres postes" aide="Apprentis, étudiants en pharmacie, rayonnistes." icone={<Sparkles size={18} />} ton="sun" singulier="personne" lignes={autres} onChange={setAutres} ajouter={() => ligne('apprenti', '21')} libelleAjout="Ajouter une personne" avecFonction erreurs={erreurs} />
            </div>
          ) : null}

          {etape === 2 ? (
            <div className="col" style={{ gap: 16 }}>
              <section className="card pad col" aria-labelledby="recap-pharmacie">
                <div className="row">
                  <span className="ico grad" aria-hidden="true">
                    <Store size={18} />
                  </span>
                  <h2 id="recap-pharmacie" className="grow" style={{ fontSize: 18 }}>
                    {nom.trim() || 'Pharmacie sans nom'}
                  </h2>
                  <button type="button" className="btn sm" onClick={() => versEtape(0)}>
                    Modifier <span className="sr">la pharmacie</span>
                  </button>
                </div>
                <dl className="recap">
                  <dt>Lundi au vendredi</dt>
                  <dd>{horaireSemaine.map(plage).join(' puis ')}</dd>
                  <dt>Samedi</dt>
                  <dd>{samediOuvert ? plage(samedi) : 'Fermé'}</dd>
                  <dt>Dimanche</dt>
                  <dd>Fermé (hors gardes)</dd>
                </dl>
              </section>
              <section className="card pad col" aria-labelledby="recap-equipe">
                <div className="row">
                  <span className="ico mint" aria-hidden="true">
                    <Users size={18} />
                  </span>
                  <h2 id="recap-equipe" className="grow" style={{ fontSize: 18 }}>
                    {equipe.length} personne{equipe.length > 1 ? 's' : ''} dans l’équipe
                  </h2>
                  <button type="button" className="btn sm" onClick={() => versEtape(1)}>
                    Modifier <span className="sr">l’équipe</span>
                  </button>
                </div>
                <ul className="chips">
                  {equipe.map((l) => (
                    <li key={l.cle} className="pill" style={{ padding: '5px 12px', fontSize: 13 }}>
                      {l.prenom} {l.nom} · {l === titulaire ? 'Titulaire principal' : l.qualification === 'titulaire' ? 'Titulaire secondaire' : QUALIFICATION_COURT[l.qualification]} · {l.heures} h
                    </li>
                  ))}
                </ul>
                {nbPharmaciens < 2 ? (
                  <div className="notice warn">
                    <AlertTriangle size={17} aria-hidden="true" />
                    <span>
                      Un seul pharmacien pour l’instant : chacune de ses pauses laissera l’ouverture sans pharmacien{coupure ? ', sauf pendant la coupure du midi' : ''}. Prévoyez un adjoint ou un remplaçant.
                    </span>
                  </div>
                ) : (
                  <div className="notice ok">
                    <Check size={17} aria-hidden="true" />
                    <span>{nbPharmaciens} pharmaciens : ils pourront se relayer pendant les pauses.</span>
                  </div>
                )}
              </section>
            </div>
          ) : null}

          <div className="row wrap accueil-actions">
            <span className="grow small soft" aria-live="polite">
              {etape === 1 ? `${equipe.length} personne${equipe.length > 1 ? 's' : ''} saisie${equipe.length > 1 ? 's' : ''}.` : etape === 0 ? (ajout ? 'Une pharmacie de plus, avec sa propre équipe et ses plannings.' : 'Vous créez ici votre compte de titulaire principal.') : 'Un tutoriel d’une minute suit la création.'}
            </span>
            {etape === 0 ? (
              onAnnuler ? (
                <button type="button" className="btn" onClick={onAnnuler}>
                  {ajout ? 'Annuler' : (
                    <>
                      <LogIn size={16} aria-hidden="true" /> J’ai déjà un compte
                    </>
                  )}
                </button>
              ) : null
            ) : (
              <button type="button" className="btn" onClick={() => versEtape(etape - 1)}>
                <ArrowLeft size={16} aria-hidden="true" /> Retour
              </button>
            )}
            <button type="submit" className="btn magic" style={{ padding: '10px 22px' }}>
              {etape === 0 ? 'Continuer : l’équipe' : etape === 1 ? 'Continuer : vérification' : ajout ? 'Ajouter cette pharmacie' : 'Créer mon officine'} <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
