import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Aucun mode de paiement ne doit être coché d'avance.
 *
 * ⚠️ POURQUOI CE DÉFAUT ÉTAIT INVISIBLE. `null` n'est pas l'absence de choix : c'est le choix
 * « Non payé », qui laisse la commande en attente de règlement. Partir de `null` cochait donc ce
 * choix à l'ouverture, et un clic sur « Créer la commande » enregistrait un impayé que personne
 * n'avait décidé — sur une commande qu'on venait peut-être d'encaisser en espèces.
 *
 * Rien ne le signalait : l'écran était cohérent, le serveur acceptait, et la commande partait en
 * « Pending ». On ne s'en aperçoit qu'en comptant la caisse.
 *
 * 📍 Un test de rendu coûterait de monter deux modales et leur parcours en quatre étapes, pour
 * vérifier une valeur initiale. Cette garde-ci coûte une lecture de fichier.
 */

const RACINE = join(import.meta.dirname, '../../../../../layers/ticketing/app/components/ticketing')

/** Les deux écrans qui demandent comment une commande est réglée. */
const ECRANS = ['AddParticipantModal.vue', 'ParticipantDetailsModal.vue']

function sansCommentaires(fichier: string): string {
  return readFileSync(join(RACINE, fichier), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('le mode de paiement n’est jamais coché d’avance', () => {
  it.each(ECRANS)('%s part de « pas encore choisi »', (fichier) => {
    const source = sansCommentaires(fichier)
    const declaration = source.match(/const paymentMethod = ref<[^>]*>\(([^)]*)\)/)

    expect(declaration, 'déclaration de `paymentMethod` introuvable').not.toBeNull()
    expect(declaration![1].trim(), '`null` est le choix « Non payé », pas son absence').toBe(
      'undefined'
    )
  })

  it.each(ECRANS)('%s interdit de poursuivre sans choix', (fichier) => {
    /*
     * L'autre moitié : repartir de `undefined` sans garder le bouton laisserait envoyer une
     * commande sans mode de paiement — le serveur la rangerait en « Pending », c'est-à-dire
     * exactement l'impayé qu'on cherchait à ne plus poser par défaut.
     */
    const source = sansCommentaires(fichier)

    expect(source, 'le bouton ne teste pas `paymentMethod === undefined`').toMatch(
      /paymentMethod === undefined/
    )
  })

  it('le sélecteur distingue bien les trois états', () => {
    /*
     * `null` doit rester un choix affichable — « Non payé » existe et doit pouvoir se cocher. Si
     * le sélecteur cessait de le reconnaître, la vignette ne se mettrait jamais en avant et l'on
     * croirait n'avoir rien choisi après l'avoir fait.
     */
    const selecteur = sansCommentaires('PaymentMethodSelector.vue')

    expect(selecteur).toContain('modelValue === null')
    expect(selecteur, 'le prop doit accepter `undefined`').toMatch(/modelValue\?:\s*PaymentMethod/)
  })
})
