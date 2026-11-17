import { ArrowRight, CalendarRange, Clock3, HeartHandshake, MoonStar, Pill as PillIcon, Plus, ShieldCheck, Sparkles, Store, Trash2, UserRound, Users } from 'lucide-react';
import { useState } from 'react';
import { fmtHHMM, parseHHMM, uid } from '../../domain/time';
import type { Interval, Person, Qualification } from '../../domain/types';
import { QUALIFICATION_COURT } from '../../domain/types';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { Logo } from '../kit';

interface Ligne {
  cle: string;
  prenom: string;
  nom: string;
  heures: string;
  qualification: Qualification;
}

const ligne = (qualification: Qualification, heures = '35'): Ligne => ({ cle: uid('l'), prenom: '', nom: '', heures, qualification });

const AUTRES: Qualification[] = ['apprenti', 'etudiant', 'rayonniste'];

function Lignes({
  titre,
  aide,
  icone,
  ton,
  lignes,
  onChange,
  ajouter,
  libelleAjout,
  avecFonction,
}: {
  titre: string;
  aide: string;
  icone: JSX.Element;
  ton: string;
  lignes: Ligne[];
  onChange: (l: Ligne[]) => void;
  ajouter: () => Ligne;
  libelleAjout: string;
  avecFonction?: boolean;
}): JSX.Element {
  const maj = (cle: string, patch: Partial<Ligne>): void => onChange(lignes.map((l) => (l.cle === cle ? { ...l, ...patch } : l)));
  return (
    <section className="col" style={{ gap: 10 }}>
      <div className="row">
        <span className={`ico ${ton}`}>{icone}</span>
        <div className="grow">
          <h3>{titre}</h3>
          <div className="small soft">{aide}</div>
        </div>
      </div>
      {lignes.map((l, i) => (
        <div key={l.cle} className="row wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
          <label className="field grow" style={{ minWidth: 120 }}>
            {i === 0 ? 'Prénom' : <span className="sr">Prénom</span>}
            <input value={l.prenom} onChange={(e) => maj(l.cle, { prenom: e.target.value })} placeholder="Prénom" autoComplete="off" />
          </label>
          <label className="field grow" style={{ minWidth: 120 }}>
            {i === 0 ? 'Nom' : <span className="sr">Nom</span>}
            <input value={l.nom} onChange={(e) => maj(l.cle, { nom: e.target.value })} placeholder="Nom" autoComplete="off" />
          </label>
          {avecFonction ? (
            <label className="field" style={{ width: 150 }}>
              {i === 0 ? 'Fonction' : <span className="sr">Fonction</span>}
              <select value={l.qualification} onChange={(e) => maj(l.cle, { qualification: e.target.value as Qualification })}>
                {AUTRES.map((q) => (
                  <option key={q} value={q}>
                    {QUALIFICATION_COURT[q]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field" style={{ width: 104 }}>
            {i === 0 ? 'Heures / sem.' : <span className="sr">Heures par semaine</span>}
            <input type="number" min={1} max={48} step={0.5} value={l.heures} onChange={(e) => maj(l.cle, { heures: e.target.value })} className="num" />
          </label>
          <button type="button" className="btn ghost icon" aria-label={`Retirer ${l.prenom || 'cette ligne'}`} onClick={() => onChange(lignes.filter((x) => x.cle !== l.cle))}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn sm" onClick={() => onChange([...lignes, ajouter()])}>
          <Plus size={14} /> {libelleAjout}
        </button>
      </div>
    </section>
  );
}

/** Premier écran : créer l'officine et saisir d'emblée son équipe. */
export function Accueil(): JSX.Element {
  const { creerOfficine, chargerExemple } = useStore();
  const { setTour, aller } = useUi();
  const [nom, setNom] = useState('');
  const [semaine, setSemaine] = useState<Interval>({ start: 8 * 60 + 30, end: 19 * 60 + 30 });
  const [samediOuvert, setSamediOuvert] = useState(true);
  const [samedi, setSamedi] = useState<Interval>({ start: 9 * 60, end: 19 * 60 });
  const [titulaire, setTitulaire] = useState<Ligne>(ligne('titulaire', '42'));
  const [adjoints, setAdjoints] = useState<Ligne[]>([ligne('adjoint')]);
  const [preparateurs, setPreparateurs] = useState<Ligne[]>([ligne('preparateur'), ligne('preparateur')]);
  const [autres, setAutres] = useState<Ligne[]>([]);
  const [essaye, setEssaye] = useState(false);

  const complet = (l: Ligne): boolean => l.prenom.trim() !== '' && l.nom.trim() !== '';
  const horairesOk = semaine.end > semaine.start && (!samediOuvert || samedi.end > samedi.start);
  const pret = nom.trim() !== '' && complet(titulaire) && horairesOk;
  const equipe = [titulaire, ...adjoints, ...preparateurs, ...autres].filter(complet);

  const creer = (): void => {
    setEssaye(true);
    if (!pret) return;
    const personnes: Person[] = equipe.map((l) => ({
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
    }));
    const horaires = [0, 1, 2, 3, 4].map(() => [{ ...semaine }]).concat([samediOuvert ? [{ ...samedi }] : []], [[]]);
    creerOfficine(nom.trim(), horaires, personnes);
    aller('resoudre');
    setTour(0);
  };

  const heure = (v: number, set: (n: number) => void, label: string): JSX.Element => (
    <input
      type="time"
      step={900}
      className="input num"
      aria-label={label}
      value={fmtHHMM(v)}
      onChange={(e) => {
        const n = parseHHMM(e.target.value);
        if (n !== null) set(n);
      }}
      style={{ width: 122 }}
    />
  );

  return (
    <div className="accueil">
      <aside className="accueil-hero">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark" style={{ background: 'rgba(255,255,255,0.22)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.45)' }}>
            <Logo />
          </span>
          <div className="brand-name" style={{ color: '#fff' }}>Relève</div>
        </div>
        <div>
          <h1>Le planning de votre officine, enfin serein.</h1>
          <p>Créez votre pharmacie en deux minutes : son nom, ses horaires, son équipe. Vous pourrez tout ajuster ensuite.</p>
        </div>
        <ul className="accueil-points">
          <li>
            <span className="ico"><CalendarRange size={18} /></span>
            <div>
              <b>Des semaines construites pour vous</b>
              <span>Trois propositions comparables, que vous ajustez à la main.</span>
            </div>
          </li>
          <li>
            <span className="ico"><ShieldCheck size={18} /></span>
            <div>
              <b>Un pharmacien présent à chaque minute</b>
              <span>Repos, durées et couverture contrôlés au fil de l’eau.</span>
            </div>
          </li>
          <li>
            <span className="ico"><HeartHandshake size={18} /></span>
            <div>
              <b>Les imprévus sans tout désorganiser</b>
              <span>Chaque solution annonce qui elle touche et ce qu’elle coûte.</span>
            </div>
          </li>
          <li>
            <span className="ico"><MoonStar size={18} /></span>
            <div>
              <b>Les gardes, jusqu’à la paie</b>
              <span>Affectation, repos à protéger, variables pour le comptable.</span>
            </div>
          </li>
        </ul>
      </aside>

      <main className="accueil-form">
        <div className="accueil-in">
          <div>
            <div className="eyebrow">Bienvenue</div>
            <h1 style={{ marginTop: 6 }}>
              Créer <em>mon officine</em>
            </h1>
            <p className="soft" style={{ marginTop: 10, fontSize: 15 }}>
              Seuls le nom de la pharmacie et le titulaire sont nécessaires. Les lignes laissées vides sont ignorées.
            </p>
          </div>

          <div className="card pad col" style={{ gap: 22 }}>
            <section className="col" style={{ gap: 12 }}>
              <div className="row">
                <span className="ico grad"><Store size={18} /></span>
                <div className="grow">
                  <h3>La pharmacie</h3>
                  <div className="small soft">Son nom et ses horaires d’ouverture habituels.</div>
                </div>
              </div>
              <label className="field">
                Nom de la pharmacie
                <input id="officine-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Pharmacie du Marché" autoFocus autoComplete="organization" aria-invalid={essaye && !nom.trim()} />
                {essaye && !nom.trim() ? <span className="erreur">Indiquez le nom de la pharmacie.</span> : null}
              </label>
              <div className="row wrap" style={{ gap: 18 }}>
                <div className="field">
                  <span className="row" style={{ gap: 6 }}>
                    <Clock3 size={14} /> Du lundi au vendredi
                  </span>
                  <div className="row" style={{ gap: 8 }}>
                    {heure(semaine.start, (n) => setSemaine({ ...semaine, start: n }), 'Ouverture en semaine')}
                    <span className="muted">→</span>
                    {heure(semaine.end, (n) => setSemaine({ ...semaine, end: n }), 'Fermeture en semaine')}
                  </div>
                </div>
                <div className="field">
                  <label className="check" style={{ fontWeight: 600, color: 'var(--ink-2)' }}>
                    <input type="checkbox" checked={samediOuvert} onChange={(e) => setSamediOuvert(e.target.checked)} style={{ marginTop: 2 }} /> Ouvert le samedi
                  </label>
                  {samediOuvert ? (
                    <div className="row" style={{ gap: 8 }}>
                      {heure(samedi.start, (n) => setSamedi({ ...samedi, start: n }), 'Ouverture le samedi')}
                      <span className="muted">→</span>
                      {heure(samedi.end, (n) => setSamedi({ ...samedi, end: n }), 'Fermeture le samedi')}
                    </div>
                  ) : (
                    <span className="small muted" style={{ fontWeight: 500, padding: '10px 0' }}>Fermé le samedi</span>
                  )}
                </div>
              </div>
              {essaye && !horairesOk ? <span className="erreur">L’heure de fermeture doit suivre l’heure d’ouverture.</span> : null}
            </section>

            <hr className="sep" />

            <section className="col" style={{ gap: 10 }}>
              <div className="row">
                <span className="ico mint"><UserRound size={18} /></span>
                <div className="grow">
                  <h3>Le titulaire</h3>
                  <div className="small soft">Hors décompte salarié : ses heures sont un objectif, pas un contrat.</div>
                </div>
              </div>
              <div className="row wrap" style={{ gap: 8, alignItems: 'flex-end' }}>
                <label className="field grow" style={{ minWidth: 120 }}>
                  Prénom
                  <input value={titulaire.prenom} onChange={(e) => setTitulaire({ ...titulaire, prenom: e.target.value })} placeholder="Prénom" autoComplete="off" aria-invalid={essaye && !titulaire.prenom.trim()} />
                </label>
                <label className="field grow" style={{ minWidth: 120 }}>
                  Nom
                  <input value={titulaire.nom} onChange={(e) => setTitulaire({ ...titulaire, nom: e.target.value })} placeholder="Nom" autoComplete="off" aria-invalid={essaye && !titulaire.nom.trim()} />
                </label>
                <label className="field" style={{ width: 104 }}>
                  Heures / sem.
                  <input type="number" min={1} max={70} step={0.5} value={titulaire.heures} onChange={(e) => setTitulaire({ ...titulaire, heures: e.target.value })} className="num" />
                </label>
                <span style={{ width: 36 }} />
              </div>
              {essaye && !complet(titulaire) ? <span className="erreur">Indiquez le prénom et le nom du titulaire.</span> : null}
            </section>

            <hr className="sep" />
            <Lignes
              titre="Pharmaciens adjoints"
              aide="Un pharmacien doit être présent sur toute l’ouverture, pauses comprises."
              icone={<PillIcon size={18} />}
              ton="mint"
              lignes={adjoints}
              onChange={setAdjoints}
              ajouter={() => ligne('adjoint')}
              libelleAjout="Ajouter un pharmacien"
            />
            <hr className="sep" />
            <Lignes
              titre="Préparateurs"
              aide="Indiquez les heures du contrat : un temps partiel est comparé au prorata."
              icone={<Users size={18} />}
              ton="sky"
              lignes={preparateurs}
              onChange={setPreparateurs}
              ajouter={() => ligne('preparateur')}
              libelleAjout="Ajouter un préparateur"
            />
            <hr className="sep" />
            <Lignes
              titre="Autres postes"
              aide="Apprentis, étudiants en pharmacie, rayonnistes."
              icone={<Sparkles size={18} />}
              ton="peach"
              lignes={autres}
              onChange={setAutres}
              ajouter={() => ligne('apprenti', '21')}
              libelleAjout="Ajouter une personne"
              avecFonction
            />
          </div>

          <div className="row wrap accueil-actions">
            <div className="grow small soft">
              {equipe.length ? `${equipe.length} personne${equipe.length > 1 ? 's' : ''} prête${equipe.length > 1 ? 's' : ''} à être ajoutée${equipe.length > 1 ? 's' : ''}.` : 'Aucune personne saisie pour l’instant.'} Tout reste modifiable ensuite.
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                chargerExemple();
                aller('resoudre');
                setTour(0);
              }}
            >
              Découvrir avec une équipe d’exemple
            </button>
            <button type="button" className="btn magic" onClick={creer} style={{ padding: '11px 22px' }}>
              Créer mon officine <ArrowRight size={16} />
            </button>
          </div>
          <p className="tiny muted">
            Vos données restent sur cet appareil. Aucune information de santé, de religion ou de vie privée n’est demandée, ni ici ni ailleurs dans l’application.
          </p>
        </div>
      </main>
    </div>
  );
}
