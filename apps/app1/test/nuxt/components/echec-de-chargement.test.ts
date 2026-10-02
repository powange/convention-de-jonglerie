import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import EchecDeChargement from '../../../app/components/ui/EchecDeChargement.vue'

/**
 * Le secours affiché quand la bribe d'un composant différé n'arrive pas.
 *
 * ⚠️ CE QUE CE TEST GARDE, et ce n'est pas l'apparence : que le bouton SOIT RENDU et qu'il émette.
 * Il vit dans le slot `#actions` d'un `UAlert` — un nom de slot erroné ne lève aucune erreur, ne
 * fait pas tomber le typage, et le bouton disparaît simplement. C'est exactement ce qui s'est
 * produit ailleurs avec neuf infobulles muettes (`text` écrit `content`). Sans ce bouton, le
 * visiteur n'a plus aucun moyen de rattraper un aléa de réseau d'une seconde.
 */
describe('UiEchecDeChargement', () => {
  it('annonce le problème et propose de réessayer', async () => {
    const composant = await mountSuspended(EchecDeChargement)

    /*
     * Les clés, et non leur traduction : l'environnement de test ne charge pas le domaine
     * `common` du français. Ce que l'assertion porte reste entier — que le titre et la
     * description soient bien transmis à l'encart, et non laissés vides.
     */
    expect(composant.text()).toContain('errors.chunk_load_failed_title')
    expect(composant.text()).toContain('errors.chunk_load_failed_description')
    // Le bouton lui-même, et non seulement son libellé quelque part dans la page.
    expect(composant.find('button').exists()).toBe(true)
    expect(composant.find('button').text().trim()).not.toBe('')
  })

  it('émet « reessayer » au clic, plutôt que de recharger la page', async () => {
    /*
     * 🔬 L'événement est le cœur du composant : l'appelant y branche le `clear` de son
     * `<NuxtErrorBoundary>`, ce qui remonte le composant et rejoue l'`import()`. Un
     * `window.location.reload()` aurait fait repayer tout le chargement de la page et perdu les
     * filtres en cours.
     */
    const composant = await mountSuspended(EchecDeChargement)

    await composant.find('button').trigger('click')

    expect(composant.emitted('reessayer')).toHaveLength(1)
  })
})
