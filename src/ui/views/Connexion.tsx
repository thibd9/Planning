import { ArrowLeft, ArrowRight, CalendarClock, CircleAlert, Info, LogIn, MessageSquare, RotateCcw, ShieldCheck, Sparkles, Store } from 'lucide-react';
import { useState } from 'react';
import { empreinte, espaceDe, estResponsable, memeIdentifiant } from '../../domain/acces';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { tutorielDejaVu } from '../Tour';
import { Logo, LogoNom } from '../kit';

type Ecran = 'connexion' | 'oubli';

/**
 * Porte d'entrée de l'application : le formulaire de connexion s'affiche dès l'ouverture,
 * avec à côté la création d'une pharmacie pour une première visite.
 */
export function Connexion({ onCreer }: { onCreer: () => void }): JSX.Element {
  const { data, autres, officineId, changerOfficine, definirMotDePasse, reinitialiser, chargerExemple } = useStore();
  const { connecter, setTour, toutOublier } = useUi();
  const [ecran, setEcran] = useState<Ecran>('connexion');
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [cle, setCle] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [info, setInfo] = useState('');
  const [effacer, setEffacer] = useState('');
  const toutes = [{ id: officineId, d: data }, ...Object.entries(autres).map(([id, d]) => ({ id, d }))];

  const vide = !toutes.some(({ d }) => d.personnes.length);

  const entrer = (): void => {
    if (vide) return setErreur('Aucun compte n’existe encore sur cet appareil. Créez votre pharmacie pour obtenir vos identifiants.');
    // La pharmacie ouverte d'abord, puis les autres pharmacies de l'appareil.
    for (const { id, d } of toutes) {
      const p = d.personnes.find((x) => !x.externe && memeIdentifiant(x.identifiant, identifiant) && x.code === empreinte(motDePasse));
      if (!p) continue;
      if (id !== officineId) changerOfficine(id);
      const responsable = espaceDe(d, p) === 'responsable';
      connecter(p.identifiant as string, responsable ? 'tableau' : 'moi');
      if (responsable && !tutorielDejaVu()) setTour(0);
      return;
    }
    setErreur('Identifiant ou mot de passe incorrect.');
  };

  const redefinir = (): void => {
    const pharmacie = toutes.find(({ d }) => d.personnes.some((p) => estResponsable(d, p) && memeIdentifiant(p.identifiant, identifiant)));
    if (!pharmacie) return setErreur('Cet identifiant n’est pas celui d’un titulaire principal.');
    if (!pharmacie.d.officine.secours || cle.trim().toUpperCase() !== pharmacie.d.officine.secours) return setErreur('La clé de secours ne correspond pas.');
    if (nouveau.length < 6) return setErreur('Le nouveau mot de passe doit compter au moins 6 caractères.');
    definirMotDePasse(identifiant, empreinte(nouveau));
    setErreur('');
    setMotDePasse('');
    setEcran('connexion');
    setInfo('Mot de passe redéfini. Vous pouvez vous connecter.');
  };

  // L'exemple se charge, puis on se connecte comme tout le monde : identifiants préremplis.
  const exemple = (): void => {
    chargerExemple();
    setIdentifiant('helene.marchetti');
    setMotDePasse('demo');
    setErreur('');
    setInfo('Équipe d’exemple chargée. Les identifiants sont préremplis : il reste à vous connecter.');
  };

  return (
    <main className="connexion" id="contenu">
      <div className="connexion-in">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark">
            <Logo />
          </span>
          <div>
            <div className="brand-name">
              <LogoNom />
            </div>
            <div className="brand-sub" style={{ maxWidth: 'none' }}>Le planning de l’officine</div>
          </div>
        </div>

        <div className={ecran === 'connexion' ? 'connexion-grille' : undefined}>
        {ecran === 'connexion' ? (
          <form
            className="card pad col"
            style={{ gap: 18 }}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              entrer();
            }}
          >
            <div>
              <h1 style={{ fontSize: 28 }}>
                Se <span className="hl">connecter</span>
              </h1>
              <p className="soft" style={{ marginTop: 8 }}>Titulaire, pharmacien, préparateur ou autre poste : chacun retrouve son espace.</p>
            </div>
            {info ? (
              <p className="notice ok small" role="status">
                <ShieldCheck size={16} aria-hidden="true" /> <span>{info}</span>
              </p>
            ) : null}
            <label className="field" htmlFor="cx-identifiant">
              Identifiant
              <input id="cx-identifiant" value={identifiant} onChange={(e) => { setIdentifiant(e.target.value); setErreur(''); }} autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus aria-describedby="cx-aide" aria-invalid={!!erreur} />
              <span className="aide" id="cx-aide">Votre adresse électronique, ou prenom.nom.</span>
            </label>
            <label className="field" htmlFor="cx-mdp">
              Mot de passe
              <input id="cx-mdp" type="password" value={motDePasse} onChange={(e) => { setMotDePasse(e.target.value); setErreur(''); }} autoComplete="current-password" aria-invalid={!!erreur} aria-describedby={erreur ? 'cx-err' : undefined} />
            </label>
            {erreur ? (
              <p className="erreur" id="cx-err" role="alert">
                <CircleAlert size={15} aria-hidden="true" /> {erreur}
              </p>
            ) : null}
            <button type="submit" className="btn primary" disabled={!identifiant.trim() || !motDePasse} style={{ minHeight: 46 }}>
              <LogIn size={17} aria-hidden="true" /> Se connecter
            </button>
            {!vide ? (
              <button type="button" className="btn ghost sm" onClick={() => { setEcran('oubli'); setErreur(''); setInfo(''); }}>
                Mot de passe oublié ou remise à zéro
              </button>
            ) : null}
            {data.demo ? (
              <p className="notice info small">
                <Info size={16} aria-hidden="true" />
                <span>
                  Équipe d’exemple : identifiant <b>helene.marchetti</b> (titulaire principale), <b>karim.benali</b> (pharmacien) ou <b>camille.roussel</b> (préparatrice), mot de passe <b>demo</b>.
                </span>
              </p>
            ) : null}
          </form>
        ) : null}
        {ecran === 'connexion' ? (
          <aside className="card pad col premiere" aria-labelledby="premiere-titre" style={{ gap: 16 }}>
            <div>
              <h2 id="premiere-titre" className="h3">Première visite ?</h2>
              <p className="soft small" style={{ marginTop: 6 }}>Créez votre pharmacie en trois étapes. Vous choisissez votre identifiant et votre mot de passe, puis l’équipe reçoit les siens.</p>
            </div>
            <ul className="atouts">
              <li>
                <CalendarClock size={17} aria-hidden="true" /> Vos horaires en un coup d’œil, sur ordinateur et téléphone
              </li>
              <li>
                <Sparkles size={17} aria-hidden="true" /> Un planning proposé, contrôlé et expliqué
              </li>
              <li>
                <MessageSquare size={17} aria-hidden="true" /> Messages, remplacements et demandes d’horaires
              </li>
            </ul>
            <button type="button" className="btn" onClick={onCreer} style={{ minHeight: 46 }}>
              <Store size={17} aria-hidden="true" /> Créer ma pharmacie <ArrowRight size={16} aria-hidden="true" />
            </button>
            {vide ? (
              <button type="button" className="btn ghost sm" onClick={exemple}>
                Découvrir avec une équipe d’exemple
              </button>
            ) : null}
          </aside>
        ) : null}
        {ecran === 'oubli' ? (
          <div className="card pad col" style={{ gap: 20 }}>
            <div>
              <h1 style={{ fontSize: 26 }}>Mot de passe oublié</h1>
              <p className="soft" style={{ marginTop: 8 }}>
                <b>Membre de l’équipe :</b> demandez au titulaire principal de vous donner un nouveau mot de passe provisoire, depuis votre fiche dans « Équipe ».
              </p>
            </div>
            <form
              className="col"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                redefinir();
              }}
            >
              <h2 className="h3">Titulaire principal : redéfinir avec la clé de secours</h2>
              <label className="field" htmlFor="ob-identifiant">
                Identifiant
                <input id="ob-identifiant" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoComplete="username" autoCapitalize="none" />
              </label>
              <label className="field" htmlFor="ob-cle">
                Clé de secours
                <input id="ob-cle" value={cle} onChange={(e) => setCle(e.target.value)} autoComplete="off" aria-describedby="ob-cle-aide" />
                <span className="aide" id="ob-cle-aide">Affichée dans « Mon compte » du titulaire principal, à noter lors de la création.</span>
              </label>
              <label className="field" htmlFor="ob-nouveau">
                Nouveau mot de passe
                <input id="ob-nouveau" type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} autoComplete="new-password" />
              </label>
              {erreur ? (
                <p className="erreur" role="alert">
                  <CircleAlert size={15} aria-hidden="true" /> {erreur}
                </p>
              ) : null}
              <button type="submit" className="btn primary" disabled={!identifiant || !cle || !nouveau}>
                Redéfinir le mot de passe
              </button>
            </form>
            <hr className="sep" />
            <div className="col">
              <h2 className="h3">Remettre l’application à zéro</h2>
              <p className="small soft">Efface de cet appareil toutes les pharmacies, les équipes, les plannings et les comptes. Cette action est définitive.</p>
              <label className="field" htmlFor="ob-effacer">
                Pour confirmer, saisissez EFFACER
                <input id="ob-effacer" value={effacer} onChange={(e) => setEffacer(e.target.value)} autoComplete="off" />
              </label>
              <button type="button" className="btn danger" disabled={effacer.trim().toUpperCase() !== 'EFFACER'} onClick={() => {
                reinitialiser();
                toutOublier();
                setEcran('connexion');
                setEffacer('');
                setIdentifiant('');
                setMotDePasse('');
                setInfo('Tout a été effacé de cet appareil.');
              }}>
                <RotateCcw size={16} aria-hidden="true" /> Tout effacer et recommencer
              </button>
            </div>
            <button type="button" className="btn" onClick={() => { setEcran('connexion'); setErreur(''); }}>
              <ArrowLeft size={16} aria-hidden="true" /> Retour à la connexion
            </button>
          </div>
        ) : null}
        </div>
        <p className="tiny muted">Sans serveur, cette connexion sépare les espaces sur cet appareil ; elle ne remplace pas de vrais comptes en ligne.</p>
      </div>
    </main>
  );
}
