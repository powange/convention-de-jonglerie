import fs from 'node:fs'
import path from 'node:path'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import EchecDeChargement from '../../../app/components/ui/EchecDeChargement.vue'

/**
 * ⚠️ LES LOCALES SE LISENT SUR LE DISQUE, PAS PAR `import`. Un `import` d'un fichier de locale
 * passe, dans l'environnement Nuxt, par le compilateur de messages de vue-i18n : chaque valeur
 * devient un AST (`{ type, loc, body, static }`) et non une chaîne. L'assertion comparait donc un
 * objet à du texte et échouait sans que rien ne le dise.
 */
function messagesDErreur(langue: string): Record<string, string> {
  const chemin = path.resolve(__dirname, `../../../i18n/locales/${langue}/common.json`)
  return JSON.parse(fs.readFileSync(chemin, 'utf-8')).errors
}

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

    const texte = composant.text()

    /*
     * ⚠️ NE PAS ÉCRIRE LA TRADUCTION EN DUR, ni attendre la clé brute. Une première version de ce
     * test attendait la clé non résolue — ce qu'elle voyait en local tant que l'anglais n'avait
     * pas encore la clé. En CI, où il l'avait, elle est tombée. La locale de l'environnement de
     * test n'est donc pas une donnée sur laquelle s'appuyer : on accepte les deux langues, lues
     * dans les fichiers eux-mêmes, et c'est bien le CÂBLAGE des deux clés qui est éprouvé.
     */
    const attendus = [messagesDErreur('fr'), messagesDErreur('en')]
    expect(
      attendus.some(
        (m) =>
          texte.includes(m.chunk_load_failed_title) &&
          texte.includes(m.chunk_load_failed_description)
      )
    ).toBe(true)
    // Et la clé n'est pas restée brute, ce qui serait le symptôme d'un domaine i18n absent.
    expect(texte).not.toContain('chunk_load_failed')
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
