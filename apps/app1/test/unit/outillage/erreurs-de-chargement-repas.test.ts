import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

/**
 * Les deux chargements du module repas n'avalent plus leur erreur — constat F2.
 *
 * ## Le défaut
 *
 * `fetchParticipants` (list.vue) et `fetchMealStats` (validate.vue) tenaient leur échec dans un
 * `catch` : le premier posait `participants = []`, et l'écran affichait alors « Aucun
 * participant » ; le second posait `mealStats = null`, et tout le bloc d'avancement disparaissait
 * — son `catch` ne journalisait même pas. Un 403 après perte de session, un 500 ou une coupure
 * réseau produisaient donc une **affirmation sur les données** au lieu d'un signe de panne.
 *
 * ## ⚠️⚠️ CE QUE CETTE GARDE EST, ET CE QU'ELLE N'EST PAS
 *
 * C'est une garde de **source**. Elle lit le texte de ces deux écrans et vérifie le câblage et
 * **l'ordre des branches** ; elle **ne monte rien** et ne prouve donc pas ce qui s'affiche. Monter
 * ces deux pages — 1 400 et 900 lignes, une dizaine de chargements, des onglets — coûterait plus
 * que ce qu'il y a à éprouver, et les pièges connus de ces montages (cache de `useFetch` rejoué
 * d'un test à l'autre, panneaux d'onglets démontés) rendraient le résultat moins fiable que cette
 * lecture-ci. **Ne pas lire ces cas comme « l'encart s'affiche »** : ils disent que le code pour
 * l'afficher est en place et dans le bon ordre.
 *
 * 📍 L'ORDRE EST L'INVARIANT, et pas un détail de style : la liste est vide dans les deux cas. Si
 * la branche du vide passait avant celle de l'erreur, « Aucun participant » l'emporterait et le
 * défaut reviendrait **à l'identique**, alors que tout le reste du câblage serait en place.
 */
const RACINE = path.resolve(__dirname, '../../../../..')

const ECRANS = {
  liste: 'layers/meals/app/pages/editions/[id]/gestion/meals/list.vue',
  comptoir: 'layers/meals/app/pages/editions/[id]/gestion/meals/validate.vue',
}

function source(relatif: string): string {
  return fs.readFileSync(path.resolve(RACINE, relatif), 'utf8')
}

/** Le code d'un écran, commentaires retirés — ceux de HTML compris. */
function sansCommentaires(relatif: string): string {
  return source(relatif)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('repas — les chargements n’avalent plus leur erreur', () => {
  describe('la liste des participants', () => {
    it('ne retombe plus sur un console.error qui vide la liste', () => {
      const code = sansCommentaires(ECRANS.liste)
      expect(code).not.toContain("console.error('Failed to fetch participants:'")
    })

    it('passe par useApiAction, avec un message d’erreur', () => {
      const code = sansCommentaires(ECRANS.liste)
      expect(code).toContain('const { execute: fetchParticipants, loading } = useApiAction(')
      expect(code).toContain("t('gestion.meals.error_loading_participants')")
    })

    it('lève un drapeau d’erreur distinct de la liste vide', () => {
      const code = sansCommentaires(ECRANS.liste)
      expect(code).toContain('const erreurParticipants = ref(false)')
      // Posé dans `onError`, retiré dans `onSuccess` : sans la remise à `false`, l'encart
      // resterait après un rechargement réussi.
      expect(code).toContain('erreurParticipants.value = true')
      expect(code).toContain('erreurParticipants.value = false')
    })

    it("montre l'encart d'erreur AVANT l'état « Aucun participant »", () => {
      // 📍 L'invariant du constat. Dans l'autre ordre, le défaut revient à l'identique.
      const code = sansCommentaires(ECRANS.liste)
      const erreur = code.indexOf('v-else-if="erreurParticipants"')
      const vide = code.indexOf('v-else-if="formattedParticipants.length === 0"')
      expect(erreur).toBeGreaterThan(-1)
      expect(vide).toBeGreaterThan(-1)
      expect(erreur).toBeLessThan(vide)
    })
  })

  describe("l'avancement du comptoir", () => {
    it('ne retombe plus sur un catch muet', () => {
      // L'ancienne forme, littéralement : un `catch` sans liaison, qui ne journalisait rien.
      expect(sansCommentaires(ECRANS.comptoir)).not.toMatch(
        /catch\s*\{\s*mealStats\.value = null\s*\}/
      )
    })

    it('passe par useApiAction, avec un message d’erreur', () => {
      const code = sansCommentaires(ECRANS.comptoir)
      expect(code).toContain('executeFetchMealStats')
      expect(code).toContain("t('gestion.meals.error_loading_stats')")
    })

    it('lève un drapeau d’erreur distinct de l’absence de statistiques', () => {
      const code = sansCommentaires(ECRANS.comptoir)
      expect(code).toContain('const erreurStats = ref(false)')
      expect(code).toContain('erreurStats.value = true')
      expect(code).toContain('erreurStats.value = false')
      expect(code).toContain('v-else-if="selectedMeal && erreurStats"')
    })

    it("garde l'appel sous une condition sur le repas choisi", () => {
      // ⚠️ L'endpoint cite `selectedMeal` : sans cette garde, un appel partirait sur une URL
      // contenant `undefined` dès que l'écran n'a pas encore de repas sélectionné.
      const code = sansCommentaires(ECRANS.comptoir)
      const garde = code.indexOf('if (!selectedMeal.value) {')
      const appel = code.indexOf('await executeFetchMealStats()')
      expect(garde).toBeGreaterThan(-1)
      expect(appel).toBeGreaterThan(garde)
    })
  })

  it('les quatre clés citées existent en français', () => {
    // Sans ce cas, les précédents seraient satisfaits par une clé inventée, que les deux écrans
    // afficheraient brute à la place du message.
    const fr = JSON.parse(
      fs.readFileSync(path.resolve(RACINE, 'apps/app1/i18n/locales/fr/gestion.json'), 'utf8')
    )
    const repas = fr.gestion.meals
    for (const cle of [
      'error_loading_participants',
      'error_loading_participants_description',
      'error_loading_stats',
      'error_loading_stats_description',
    ]) {
      expect(repas[cle], `gestion.meals.${cle}`).toBeTruthy()
    }
  })
})
