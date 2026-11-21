import { Construction, FlaskConical, HardDrive, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Dialog } from '../kit';

/** Une fois vue, la fenêtre ne revient pas tant que l'onglet reste ouvert ; elle revient à la prochaine ouverture. */
const CLE = 'releve.avis-test';

function dejaVu(): boolean {
  try {
    return sessionStorage.getItem(CLE) === 'vu';
  } catch {
    return false;
  }
}

/** À l'ouverture de Solvéa : il s'agit d'une version de test, dont certaines fonctionnalités sont encore en chantier. */
export function AvisTest(): JSX.Element | null {
  const [ouvert, setOuvert] = useState(() => !dejaVu());
  if (!ouvert) return null;
  const fermer = (): void => {
    try {
      sessionStorage.setItem(CLE, 'vu');
    } catch {
      // Stockage refusé (navigation privée) : la fenêtre se ferme quand même, elle reviendra au prochain chargement.
    }
    setOuvert(false);
  };
  return (
    <Dialog
      title="Version de test"
      subtitle="Vous utilisez une version de test de Solvéa, destinée à découvrir et à essayer l’application."
      onClose={fermer}
      classe="avis-test"
      footer={
        <button type="button" className="btn primary" id="avis-test-ok" onClick={fermer} data-autofocus>
          J’ai compris
        </button>
      }
    >
      <div className="notice warn">
        <FlaskConical size={17} aria-hidden="true" />
        <span>
          <b>Certaines fonctionnalités sont encore en chantier</b> et en cours d’amélioration : des écrans peuvent changer et certains résultats peuvent encore être inexacts.
        </span>
      </div>
      <ul className="dx-liste">
        <li>
          <span className="dx-pic" aria-hidden="true">
            <Construction size={18} />
          </span>
          <span className="grow">
            <b>Des fonctions qui évoluent</b>
            <span className="small soft">Certaines sont incomplètes ou changent encore d’une version à l’autre.</span>
          </span>
        </li>
        <li>
          <span className="dx-pic" aria-hidden="true">
            <HardDrive size={18} />
          </span>
          <span className="grow">
            <b>Des données sur cet appareil seulement</b>
            <span className="small soft">Tout est enregistré dans ce navigateur : rien n’est partagé avec l’équipe ni sauvegardé en ligne.</span>
          </span>
        </li>
        <li>
          <span className="dx-pic" aria-hidden="true">
            <ShieldCheck size={18} />
          </span>
          <span className="grow">
            <b>Des plannings à vérifier</b>
            <span className="small soft">Les propositions et les contrôles sont une aide : relisez-les avant de les appliquer dans votre officine.</span>
          </span>
        </li>
      </ul>
      <p className="small soft" style={{ margin: 0 }}>
        Pour vos essais, utilisez des données fictives, sans information de santé réelle.
      </p>
    </Dialog>
  );
}
