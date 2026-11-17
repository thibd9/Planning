import { ArrowLeft, CircleAlert, KeyRound, LogIn, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { empreinte, espaceDe, estResponsable } from '../../domain/acces';
import type { Person } from '../../domain/types';
import { nomComplet } from '../../domain/types';
import { useStore } from '../../store/store';
import { useUi } from '../../store/ui';
import { EtiquetteRole } from '../icons';
import { Avatar, Logo, Pill } from '../kit';

/** Écran de connexion : chacun choisit son profil et, s'il en a défini un, saisit son code d'accès. */
export function Connexion(): JSX.Element {
  const data = useStore((s) => s.data);
  const connecter = useUi((s) => s.connecter);
  const [choisi, setChoisi] = useState<Person | null>(null);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState(false);
  const profils = data.personnes.filter((p) => !p.externe);

  const entrer = (p: Person): void => connecter(p.id, espaceDe(data, p) === 'responsable' ? 'resoudre' : 'moi');
  const choisir = (p: Person): void => {
    if (!p.code) return entrer(p);
    setChoisi(p);
    setCode('');
    setErreur(false);
  };
  const valider = async (): Promise<void> => {
    if (!choisi) return;
    if ((await empreinte(code)) === choisi.code) entrer(choisi);
    else setErreur(true);
  };

  return (
    <main className="connexion" id="contenu">
      <div className="connexion-in">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark">
            <Logo />
          </span>
          <div>
            <div className="brand-name">Relève</div>
            <div className="brand-sub" style={{ maxWidth: 'none' }}>{data.officine.nom || 'Mon officine'}</div>
          </div>
        </div>

        {!choisi ? (
          <>
            <div>
              <h1>
                Qui se <span className="hl">connecte</span> ?
              </h1>
              <p className="soft" style={{ marginTop: 10, fontSize: 15 }}>
                Chaque personne a son espace : le responsable gère l’officine, les pharmaciens suivent leur planning et leurs gardes, l’équipe consulte son planning et fait ses demandes.
              </p>
            </div>
            <ul className="profils">
              {profils.map((p) => (
                <li key={p.id}>
                  <button type="button" className="profil" onClick={() => choisir(p)}>
                    <Avatar person={p} lg />
                    <span className="grow">
                      <b>{nomComplet(p)}</b>
                      <span className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                        <EtiquetteRole person={p} />
                        {estResponsable(data, p) ? <Pill tone="miel">Responsable</Pill> : p.gestion ? <Pill tone="iris">Accès gestion</Pill> : null}
                      </span>
                    </span>
                    {p.code ? <KeyRound size={16} aria-label="Protégé par un code" style={{ color: 'var(--ink-3)' }} /> : null}
                  </button>
                </li>
              ))}
            </ul>
            <p className="notice small">
              <ShieldCheck size={17} aria-hidden="true" />
              <span>
                Cette connexion sépare les espaces sur cet appareil. Sans serveur, elle ne protège pas les données comme un vrai compte : chacun peut définir un code d’accès dans « Mon compte » pour éviter les erreurs de profil.
              </span>
            </p>
          </>
        ) : (
          <form
            className="card pad col"
            style={{ gap: 18, maxWidth: 460 }}
            onSubmit={(e) => {
              e.preventDefault();
              void valider();
            }}
          >
            <div className="row">
              <Avatar person={choisi} lg />
              <div>
                <h1 style={{ fontSize: 24 }}>{nomComplet(choisi)}</h1>
                <div style={{ marginTop: 6 }}>
                  <EtiquetteRole person={choisi} />
                </div>
              </div>
            </div>
            <label className="field" htmlFor="code-acces">
              Code d’accès
              <input id="code-acces" type="password" inputMode="numeric" autoComplete="current-password" value={code} onChange={(e) => { setCode(e.target.value); setErreur(false); }} autoFocus aria-invalid={erreur} aria-describedby={erreur ? 'code-err' : undefined} />
              {erreur ? (
                <span className="erreur" id="code-err" role="alert">
                  <CircleAlert size={15} aria-hidden="true" /> Ce code ne correspond pas. Vérifiez-le, ou demandez au responsable de le réinitialiser.
                </span>
              ) : null}
            </label>
            <div className="row wrap">
              <button type="button" className="btn" onClick={() => setChoisi(null)}>
                <ArrowLeft size={16} aria-hidden="true" /> Changer de profil
              </button>
              <button type="submit" className="btn primary right" disabled={!code}>
                <LogIn size={16} aria-hidden="true" /> Se connecter
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
