import { describe, it, expect, vi } from 'vitest'
import { ref, computed } from 'vue'

import { useConfirmation } from '../../../app/composables/useConfirmation'

// Auto-imports Nuxt employés par le composable. `useConfirmation` est le VRAI : c'est son
// interaction avec la fermeture qu'on veut éprouver, pas un bouchon qui dirait toujours oui.
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('useConfirmation', useConfirmation)

const { useFermetureProtegee } = await import('../../../app/composables/useFermetureProtegee')

/**
 * Fermer une modale sans perdre une saisie non enregistrée.
 *
 * ## ⚠️ LE DÉFAUT : LA GARDE NE COUVRAIT QU'UNE SORTIE SUR TROIS
 *
 * Les trois modales de repas appelaient leur `closeModal` **depuis le bouton « Annuler »
 * uniquement**. Or une `UModal` liée par `v-model:open` est **contrôlée** : la touche **Échap** et
 * le **clic à côté** écrivent directement dans le modèle, donc dans son `set` — sans passer par la
 * garde. Les deux façons les plus naturelles de fermer une modale perdaient la saisie **sans un
 * mot**.
 *
 * Une garde qui ne couvre qu'une sortie sur trois donne la tranquillité sans la protection.
 *
 * ## Ce que ces cas mesurent
 *
 * Le composable rend le modèle lui-même : écrire `false` dedans — ce que font Échap et le clic à
 * côté — doit déclencher la confirmation au lieu de fermer. C'est la seule forme qui n'ait plus de
 * « côté » à oublier, et c'est donc ce chemin-là qui est éprouvé, pas seulement le bouton.
 */
describe('useFermetureProtegee', () => {
  /** Un décor minimal : on observe ce qui est RÉELLEMENT appliqué au modèle. */
  const decor = (modifie: boolean) => {
    const applique: boolean[] = []
    const ouvertReel = ref(true)
    const f = useFermetureProtegee({
      ouvert: () => ouvertReel.value,
      modifie: () => modifie,
      description: () => 'La saisie en cours sera perdue.',
      appliquer: (valeur) => {
        applique.push(valeur)
        ouvertReel.value = valeur
      },
    })
    return { ...f, applique, ouvertReel }
  }

  describe('sans saisie en cours', () => {
    it('ferme tout de suite, sans rien demander', () => {
      const { demanderFermeture, confirmation, applique } = decor(false)

      demanderFermeture()

      expect(applique).toEqual([false])
      // ⚠️ Le témoin qui borne la garde : sans lui, une confirmation demandée À CHAQUE fermeture
      // satisferait le cas ci-dessus, et il faudrait répondre à une question pour refermer une
      // modale qu'on n'a pas touchée.
      expect(confirmation.ouverte.value).toBe(false)
    })

    it('ferme tout de suite aussi par le modèle', () => {
      const { ouvert, applique, confirmation } = decor(false)

      ouvert.value = false

      expect(applique).toEqual([false])
      expect(confirmation.ouverte.value).toBe(false)
    })
  })

  describe('avec une saisie en cours', () => {
    it('ne ferme pas sur le bouton, et demande', () => {
      const { demanderFermeture, confirmation, applique } = decor(true)

      demanderFermeture()

      expect(applique).toEqual([])
      expect(confirmation.ouverte.value).toBe(true)
      expect(confirmation.demande.value?.description).toContain('perdue')
    })

    it('⚠️ ne ferme pas non plus par le MODÈLE — Échap et le clic à côté', () => {
      /*
       * LE CAS QUI FERME LE DÉFAUT. C'est par ce chemin que passaient Échap et le clic à côté, et
       * c'est lui qui n'était pas gardé. Un correctif qui n'aurait touché que `closeModal` — la
       * correction évidente — laisserait ce cas rouge.
       */
      const { ouvert, confirmation, applique } = decor(true)

      ouvert.value = false

      expect(applique).toEqual([])
      expect(confirmation.ouverte.value).toBe(true)
    })

    it('ferme une fois la confirmation obtenue', async () => {
      const { ouvert, confirmation, applique } = decor(true)

      ouvert.value = false
      await confirmation.confirmer()

      expect(applique).toEqual([false])
      expect(confirmation.ouverte.value).toBe(false)
    })

    it('reste ouverte si on renonce, et la saisie n’est pas touchée', () => {
      /*
       * Renoncer, c'est ne rien faire — mais encore faut-il que la modale reste OUVERTE. Sans ce
       * cas, une fermeture appliquée malgré le refus passerait : on aurait perdu la saisie après
       * avoir explicitement répondu « non ».
       */
      const { ouvert, confirmation, applique, ouvertReel } = decor(true)

      ouvert.value = false
      confirmation.annuler()

      expect(applique).toEqual([])
      expect(ouvertReel.value).toBe(true)
      expect(ouvert.value).toBe(true)
    })
  })

  describe("l'ouverture", () => {
    it('passe sans question, même avec une saisie en cours', () => {
      /*
       * ⚠️ L'ASYMÉTRIE EST VOLONTAIRE, et ce cas la fige : ouvrir ne fait rien perdre. Un filtre
       * posé sur les deux sens empêcherait la modale de s'ouvrir — une garde qui empêche ce qu'elle
       * garde, défaut déjà payé ailleurs dans ce dépôt.
       */
      const { ouvert, applique, confirmation } = decor(true)

      ouvert.value = true

      expect(applique).toEqual([true])
      expect(confirmation.ouverte.value).toBe(false)
    })
  })

  it('relit la description à chaque demande', () => {
    // Une fonction et non une chaîne : la langue courante peut avoir changé entre deux ouvertures.
    let appels = 0
    const f = useFermetureProtegee({
      ouvert: () => true,
      modifie: () => true,
      description: () => `demande ${++appels}`,
      appliquer: () => {},
    })

    f.demanderFermeture()
    f.confirmation.annuler()
    f.demanderFermeture()

    expect(f.confirmation.demande.value?.description).toBe('demande 2')
  })
})
