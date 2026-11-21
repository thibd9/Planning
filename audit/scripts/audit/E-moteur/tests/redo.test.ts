import { it } from 'vitest';
import { addDays, mondayOf } from '/home/user/releve-planning/src/domain/time';
import { useStore } from '/home/user/releve-planning/src/store/store';
import { rmSync } from 'node:fs';
import { DOSSIER, constat } from './aide';
const s = () => useStore.getState();
rmSync(`${DOSSIER}/redo.jsonl`, { force: true });
it('redo', () => {
  s().chargerExemple(true); s().setActeur('p_helene');
  const lundi = addDays(mondayOf(s().today), 21);
  s().copierSemaine(addDays(mondayOf(s().today), 7), lundi);
  s().publier(lundi, [], 0);
  s().undo();
  const apresUndo = s().data.semaines[lundi]?.statut ?? 'aucun';
  s().redo();
  const apresRedo = s().data.semaines[lundi]?.statut ?? 'aucun';
  // Autre enchaînement : publier puis faire une retouche, puis Annuler : la retouche seule est annulée ?
  s().saveShift({ ...s().data.shifts.find((x) => x.date >= lundi && x.date <= addDays(lundi, 5))!, end: 17 * 60 });
  s().undo();
  const apresRetouche = s().data.semaines[lundi]?.statut ?? 'aucun';
  constat('redo', { id: 'PU7b', regle: 'store.redo', scenario: 'Après « Annuler » qui a dépublié : « Rétablir » ; puis une retouche et « Annuler »', attendu: 'Rétablir ramène la publication ; Annuler d’une retouche ne touche qu’à la retouche', obtenu: `après Annuler ${apresUndo}, après Rétablir ${apresRedo}, après retouche + Annuler ${apresRetouche}`, ok: apresRedo === 'publie' && apresRetouche === 'publie' });
});
