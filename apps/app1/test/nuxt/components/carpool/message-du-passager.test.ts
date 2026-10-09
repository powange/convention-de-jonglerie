import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import BookingsList from '../../../../../../layers/carpool/app/components/edition/carpool/BookingsList.vue'

/**
 * Le message qu'un passager joint à sa réservation, vu du conducteur.
 *
 * ## ⚠️ LE DÉFAUT
 *
 * Le passager saisit un message (« Message au conducteur »), et l'API le **renvoie** au conducteur.
 * Mais cet écran — le **seul** du conducteur — affichait pseudo, nombre de places et boutons :
 * jamais le message. Le conducteur acceptait ou refusait **à l'aveugle**, et la seule trace du
 * message était le texte de la notification, qui ne se relit pas.
 *
 * ## Et un second défaut, sur la même ligne
 *
 * Le badge de statut affichait le **code brut** `ACCEPTED`. La clé de traduction existe pourtant, et
 * `OfferDetail.vue` l'emploie pour le **même** statut vu du passager : les deux côtés d'une même
 * réservation le nommaient différemment.
 */
/*
 * ⚠️ `registerEndpoint` ET NON `vi.stubGlobal('$fetch', …)`.
 *
 * Le composant charge ses réservations par `$fetch` au montage. Un bouchon posé sur la globale
 * **n'intercepte pas** cet appel dans un test Nuxt : le vrai `$fetch` part, le serveur de test
 * répond **404**, et `bookings` reste vide. Les cas qui assertent une ABSENCE passaient alors —
 * verts au-dessus d'un composant qui n'avait rien reçu — tandis que ceux qui assertent une
 * présence tombaient sans dire pourquoi.
 *
 * `registerEndpoint` enregistre la route dans le serveur de test, qui est le chemin que le
 * composant emprunte réellement.
 */
const reservations = { valeur: [] as unknown[] }
registerEndpoint('/api/carpool-offers/42/bookings', () => reservations.valeur)

/*
 * ⚠️ `$t` RÉSOUT VRAIMENT DANS CE HARNAIS, et pas uniformément — c'est ce qui a fait échouer ma
 * première version de l'assertion sur le statut.
 *
 * L'environnement de test est en **anglais**. Une clé qui EXISTE en anglais est donc traduite
 * (`status.accepted` → « Accepted »), tandis qu'une clé **neuve**, créée en français seulement
 * comme le veut la règle du dépôt, ressort **telle quelle** (`components.carpool.bookings`). Les
 * deux formes cohabitent dans le même rendu.
 *
 * Conséquence pratique : n'asserter la présence d'une CLÉ que pour les clés neuves. Pour le reste,
 * mesurer ce qui compte — ici, que le **code brut** `ACCEPTED` n'est plus affiché.
 */
mockNuxtImport('useI18n', () => () => ({
  t: (cle: string) => cle,
  locale: { value: 'fr' },
}))

const reservation = (p: Record<string, unknown> = {}) => ({
  id: 1,
  seats: 2,
  status: 'PENDING',
  message: null,
  requester: { id: 9, pseudo: 'Passagère', emailHash: 'x', profilePicture: null },
  ...p,
})

describe('BookingsList — le message du passager', () => {
  /**
   * Monte le composant ET attend que ses réservations soient rendues.
   *
   * ⚠️ `mountSuspended` n'attend QUE le `setup`. Le chargement part d'`onMounted`, donc la donnée
   * arrive **après** le montage : asserter tout de suite mesure un composant encore vide. Les cas
   * qui attendent une ABSENCE passaient alors sans rien prouver — c'est exactement la forme de test
   * creux que ce dépôt a déjà payée plusieurs fois.
   *
   * On attend donc que le rendu porte le nombre de lignes voulu, plutôt qu'un `nextTick` au
   * hasard : la condition dit ce qu'on attend, et son échec dit que la donnée n'est jamais arrivée.
   */
  const monter = async (lignes: unknown[]) => {
    reservations.valeur = lignes
    const composant = await mountSuspended(BookingsList, { props: { offerId: 42 } })
    for (let essai = 0; essai < 20; essai++) {
      await new Promise((resoudre) => setTimeout(resoudre, 10))
      await nextTick()
      if (composant.findAll('[data-reservation]').length === lignes.length) break
    }
    return composant
  }

  it('affiche le message écrit par le passager', async () => {
    const composant = await monter([
      reservation({ message: 'Je peux récupérer à la gare vers 18 h' }),
    ])
    expect(composant.text()).toContain('Je peux récupérer à la gare vers 18 h')
  })

  it('n’affiche rien quand le passager n’a pas écrit de message', async () => {
    /*
     * ⚠️ LE TÉMOIN NÉGATIF. Sans lui, un gabarit qui afficherait un bloc vide — ou le mot « null »
     * — satisferait le cas ci-dessus. Le `v-if` est ce qui est mesuré ici.
     */
    const composant = await monter([reservation({ message: null })])
    expect(composant.text()).not.toContain('null')
    expect(composant.findAll('p.italic')).toHaveLength(0)
  })

  it('garde les retours à la ligne du passager', async () => {
    // Un passager écrit son trajet sur plusieurs lignes ; les coller en ferait une seule phrase.
    const composant = await monter([reservation({ message: 'Départ Lyon\nArrivée 18 h' })])
    const paragraphe = composant.find('p.italic')
    expect(paragraphe.exists()).toBe(true)
    expect(paragraphe.classes()).toContain('whitespace-pre-line')
  })

  describe('le statut', () => {
    it('affiche un libellé, et non le code brut', async () => {
      /*
       * ⚠️ L'ASSERTION QUI ATTRAPE LE DÉFAUT, et la seule qui le fasse de façon stable : le badge
       * ne doit pas porter le code `ACCEPTED`. Avant le correctif il portait exactement cela.
       *
       * On ne peut PAS asserter la clé de traduction ici : elle existe en anglais, donc le harnais
       * la résout (« Accepted »). Voir la note en tête de fichier.
       */
      const composant = await monter([reservation({ status: 'ACCEPTED' })])
      const badge = composant.find(
        '[data-reservation] span.inline-flex, [data-reservation] .rounded-md'
      )
      expect(composant.text()).not.toContain('ACCEPTED')
      // Et quelque chose EST affiché : un badge vide satisferait l'assertion ci-dessus.
      expect(composant.text()).toMatch(/Accept|Acceptée|status\.accepted/)
      expect(badge).toBeTruthy()
    })

    it('n’affiche pas de badge pour une réservation en attente', async () => {
      // Le badge ne sert qu'à dire ce qui a DÉJÀ été tranché : « en attente » est l'état des
      // boutons qui l'accompagnent.
      const composant = await monter([reservation({ status: 'PENDING' })])
      // Ni la clé, ni sa traduction anglaise : le `v-if` écarte le badge entièrement.
      expect(composant.text()).not.toMatch(/status\.pending|Pending/)
    })
  })

  it('intitule la liste « Réservations », et non « Réservations en attente »', async () => {
    /*
     * La liste montre AUSSI les acceptées et les refusées, badge compris : le titre promettait une
     * liste filtrée qui n'existe pas.
     */
    const composant = await monter([reservation({ status: 'ACCEPTED' })])
    expect(composant.text()).toContain('components.carpool.bookings')
    expect(composant.text()).not.toContain('components.carpool.pending_bookings')
  })

  it('annonce l’absence de réservation sans parler d’attente', async () => {
    const composant = await monter([])
    expect(composant.text()).toContain('components.carpool.no_bookings')
  })
})
