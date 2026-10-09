import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'

import { useConfirmation } from '../../../app/composables/useConfirmation'

/**
 * La garde qui demande confirmation avant de quitter une page non enregistrée.
 *
 * ## ⚠️ POURQUOI CE FICHIER EXISTE : ELLE N'AVAIT AUCUN TEST
 *
 * `useGardeDeSortie` porte le point le plus délicat de tout le dispositif de confirmation, et c'est
 * **l'inverse** d'un détail : `onBeforeRouteLeave` attend un booléen, et `confirm()` en rendait un
 * **tout de suite**. Une modale répond plus tard, donc la garde rend une **promesse** — que le
 * routeur sait attendre, à condition qu'elle soit résolue dans **les deux sens**.
 *
 * Oublier le `renoncer` ne casse rien de visible : la navigation reste simplement **en suspens pour
 * toujours**, et la page devient **inquittable**. Rien ne lève, rien ne s'affiche. C'est le genre de
 * défaut qu'aucune relecture n'attrape et qu'aucun test n'attrapait.
 *
 * ## Le harnais
 *
 * `onBeforeRouteLeave` est remplacé par un bouchon qui **capture** la garde posée, pour pouvoir
 * l'appeler comme le routeur le ferait. C'est le seul moyen d'observer la valeur rendue.
 */
const gardesPosees: Array<() => boolean | Promise<boolean>> = []

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('useConfirmation', useConfirmation)
vi.stubGlobal('useI18n', () => ({ t: (cle: string) => cle }))
vi.stubGlobal('onBeforeRouteLeave', (garde: () => boolean | Promise<boolean>) => {
  gardesPosees.push(garde)
})
// Employés par `useSaisieNonEnregistree`, dans le même module — sans eux, l'import lèverait.
vi.stubGlobal('watch', () => {})
vi.stubGlobal('onMounted', () => {})
vi.stubGlobal('onBeforeUnmount', () => {})

const { useGardeDeSortie } = await import('../../../app/composables/useSaisieNonEnregistree')

/** La garde que le composable vient de poser, telle que le routeur l'appellerait. */
const derniereGarde = () => gardesPosees[gardesPosees.length - 1]!

describe('useGardeDeSortie', () => {
  beforeEach(() => {
    gardesPosees.length = 0
  })

  it('laisse partir quand rien n’est modifié, sans rien demander', () => {
    const { confirmation } = useGardeDeSortie(() => false)

    expect(derniereGarde()()).toBe(true)
    /*
     * ⚠️ LE TÉMOIN QUI BORNE LA GARDE. Sans lui, une garde qui demanderait confirmation à CHAQUE
     * navigation satisferait les cas suivants — et il faudrait répondre à une question pour quitter
     * une page qu'on n'a pas touchée. C'est la faute qui fait qu'« on apprend vite à cliquer sans
     * lire », ce que le composable voisin met explicitement en garde de ne pas provoquer.
     */
    expect(confirmation.ouverte.value).toBe(false)
  })

  describe('quand la page est modifiée', () => {
    it('retient la navigation et demande', () => {
      const { confirmation } = useGardeDeSortie(() => true)
      const resultat = derniereGarde()()

      expect(resultat).toBeInstanceOf(Promise)
      expect(confirmation.ouverte.value).toBe(true)
    })

    it('laisse partir une fois la confirmation obtenue', async () => {
      const { confirmation } = useGardeDeSortie(() => true)
      const resultat = derniereGarde()() as Promise<boolean>

      await confirmation.confirmer()

      await expect(resultat).resolves.toBe(true)
    })

    it('⚠️ RÉSOUT AUSSI QUAND ON RENONCE — sans quoi la page serait inquittable', async () => {
      /*
       * LE CAS QUI COMPTE. Une garde qui ne résoudrait que le « oui » laisserait la navigation en
       * suspens à chaque refus : plus aucun lien ne fonctionnerait, sans message ni erreur. Le
       * `renoncer` de `DemandeDeConfirmation` existe précisément pour ce point de sortie.
       */
      const { confirmation } = useGardeDeSortie(() => true)
      const resultat = derniereGarde()() as Promise<boolean>

      confirmation.annuler()

      await expect(resultat).resolves.toBe(false)
    })
  })

  describe('le message', () => {
    it('est générique par défaut', () => {
      const { confirmation } = useGardeDeSortie(() => true)
      derniereGarde()()

      expect(confirmation.demande.value?.description).toBe('common.unsaved_changes_warning')
      expect(confirmation.demande.value?.titre).toBe('common.unsaved_changes')
      expect(confirmation.demande.value?.libelleConfirmer).toBe('common.leave_without_saving')
    })

    it('peut dire ce que CET écran a à perdre', () => {
      /*
       * « Vous avez des modifications non enregistrées » convient à un formulaire ; pas à une séance
       * de comptage de matériel, où ce qui disparaît est un relevé à refaire allée par allée.
       * L'écran du stock avait sa propre formulation, et brancher la garde sans ce paramètre
       * l'aurait appauvrie — un remplacement qui fait perdre ce que couvrait le code remplacé.
       */
      const { confirmation } = useGardeDeSortie(() => true, undefined, {
        titre: () => 'gestion.stock.count_title',
        description: () => 'gestion.stock.count_leave_warning',
      })
      derniereGarde()()

      expect(confirmation.demande.value?.description).toBe('gestion.stock.count_leave_warning')
      expect(confirmation.demande.value?.titre).toBe('gestion.stock.count_title')
    })

    it('est relu à chaque demande, pas à l’installation', async () => {
      // Une fonction et non une chaîne : la langue courante peut avoir changé depuis le montage.
      let appels = 0
      const { confirmation } = useGardeDeSortie(() => true, undefined, {
        description: () => `message ${++appels}`,
      })

      const premier = derniereGarde()() as Promise<boolean>
      confirmation.annuler()
      await premier
      derniereGarde()()

      expect(confirmation.demande.value?.description).toBe('message 2')
    })
  })

  it('réutilise la confirmation de l’écran quand il en a déjà une', () => {
    /*
     * Un écran qui porte déjà `UiConfirmationDemandee` ne doit pas en obtenir une SECONDE : la
     * modale posée dans son gabarit serait reliée à l'une, et la garde demanderait dans l'autre —
     * la question ne s'afficherait jamais. C'est le cas exact de l'écran du stock.
     */
    const existante = useConfirmation()
    const { confirmation } = useGardeDeSortie(() => true, existante)

    expect(confirmation).toBe(existante)
    derniereGarde()()
    expect(existante.ouverte.value).toBe(true)
  })
})
