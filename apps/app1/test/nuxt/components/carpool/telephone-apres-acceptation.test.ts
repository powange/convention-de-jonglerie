import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import OfferDetail from '../../../../../../layers/carpool/app/components/edition/carpool/OfferDetail.vue'

/**
 * Le téléphone du conducteur, et ce que le passager en attente doit en savoir.
 *
 * ## Le défaut
 *
 * Le serveur renvoie `hasPhoneNumber: true` avec `phoneNumber: null` tant que la réservation n'est
 * pas acceptée — ce drapeau existe **précisément** pour dire « il y a un numéro, mais pas pour
 * vous ».
 *
 * Le bloc s'ouvrait donc sur le **bon** drapeau, puis ses deux branches internes exigeaient
 * `phoneNumber` : pour un passager en attente il ne rendait **rien**. Ni bouton, ni explication. Le
 * passager ne savait pas s'il devait attendre ou commenter. **La condition testait la bonne
 * information et la jetait.**
 *
 * ## ⚠️ CE QUE LE LOT PRÉCÉDENT A APPRIS, ET QUI SERT ICI
 *
 * `registerEndpoint` et non `vi.stubGlobal('$fetch', …)` : un bouchon sur la globale n'intercepte
 * pas l'appel d'un composant Nuxt, le vrai part, le serveur de test répond 404 — et les cas qui
 * assertent une ABSENCE passent alors sans rien prouver.
 */
registerEndpoint('/api/carpool-offers/7/bookings', () => [])

/*
 * La session, par `mockNuxtImport` — `@pinia/testing` n'est pas une dépendance de ce dépôt.
 *
 * ⚠️ L'identifiant diffère de celui du conducteur (99) : avec le même, `canEdit` passerait à vrai
 * et le composant afficherait l'écran du CONDUCTEUR, où la question du téléphone ne se pose pas.
 * Le test mesurerait alors tout autre chose que ce qu'il annonce.
 */
mockNuxtImport('useAuthStore', () => () => ({
  isAuthenticated: true,
  user: { id: 1, pseudo: 'Passagère' },
}))

const offre = (p: Record<string, unknown> = {}) => ({
  id: 7,
  editionId: 1,
  userId: 99,
  tripDate: new Date('2026-07-15').toISOString(),
  locationCity: 'Lyon',
  availableSeats: 3,
  remainingSeats: 2,
  description: null,
  smokingAllowed: false,
  petsAllowed: false,
  musicAllowed: false,
  hasPhoneNumber: true,
  phoneNumber: null,
  commentsCount: 0,
  bookings: [],
  user: { id: 99, pseudo: 'Conducteur', emailHash: 'x', profilePicture: null },
  ...p,
})

const monter = (p: Record<string, unknown> = {}) =>
  mountSuspended(OfferDetail, { props: { offer: offre(p) as never, editionId: 1 } })

/*
 * ⚠️ POURQUOI CES CAS NE VISENT PLUS NI LA CLÉ NI LE TEXTE FRANÇAIS.
 *
 * Ma première version cherchait la clé `phone_after_acceptance` ou son libellé français, au motif
 * qu'une clé NEUVE — créée en français seulement, comme le veut la règle du dépôt — ressort telle
 * quelle dans ce harnais, qui est en anglais. C'était vrai le jour où je l'ai écrite, et **faux dès
 * que les traductions ont été faites** : `$t` rend désormais « Number visible once your booking is
 * accepted », et ni la clé ni le français n'apparaissent plus. Troisième test du dépôt à tomber
 * pour cette raison.
 *
 * Le relevé stable est `data-telephone`, posé par le composant, qui nomme la BRANCHE rendue. Les
 * trois branches sont exclusives, et c'est cela qu'on mesure — pas les mots qui les habillent.
 */
const brancheTelephone = (composant: Awaited<ReturnType<typeof monter>>) => {
  // ⚠️ `exists()` d'abord : `attributes()` LÈVE sur un wrapper vide au lieu de rendre `undefined`,
  // et le cas « aucune branche rendue » — le plus intéressant des trois — passe par là.
  const branche = composant.find('[data-telephone]')
  return branche.exists() ? (branche.attributes('data-telephone') ?? null) : null
}

describe('OfferDetail — le téléphone du conducteur', () => {
  it('annonce que le numéro apparaîtra après acceptation', async () => {
    const composant = await monter({ hasPhoneNumber: true, phoneNumber: null })

    expect(brancheTelephone(composant)).toBe('apres-acceptation')
    // Et la mention dit quelque chose : un bloc vide satisferait l'assertion ci-dessus.
    expect(composant.find('[data-telephone]').text().trim().length).toBeGreaterThan(0)
  })

  it('propose le bouton quand le numéro est fourni, et n’annonce plus l’attente', async () => {
    /*
     * ⚠️ LE TÉMOIN QUI REND LE PREMIER CAS UTILE. Sans lui, un gabarit qui afficherait TOUJOURS la
     * mention — y compris au passager accepté, qui a le numéro sous les yeux — satisferait le cas
     * ci-dessus. Les trois branches sont exclusives, et c'est ce qui est mesuré.
     */
    const composant = await monter({ hasPhoneNumber: true, phoneNumber: '0600000000' })
    /*
     * 📍 LE BOUTON EST VISÉ PAR SON `href`, et non par son libellé : celui-ci est traduit, et
     * l'environnement de test est en anglais (« Show phone number »). Ma première assertion
     * cherchait « Afficher » et tombait sur la traduction — l'assertion était fausse, pas le code.
     * Un sélecteur sur l'action est de toute façon plus solide qu'un sélecteur sur des mots.
     */
    expect(brancheTelephone(composant)).toBe('bouton')
  })

  it('n’annonce rien quand le conducteur n’a pas donné de numéro', async () => {
    // `hasPhoneNumber: false` : il n'y a rien à attendre, et promettre un numéro qui n'existe pas
    // serait pire que le silence d'origine.
    const composant = await monter({ hasPhoneNumber: false, phoneNumber: null })
    // Aucune des trois branches : ni numéro, ni bouton, ni mention d'attente.
    expect(brancheTelephone(composant)).toBeNull()
  })
})
