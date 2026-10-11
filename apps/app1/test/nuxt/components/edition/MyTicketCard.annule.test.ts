import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'

import MyTicketCard from '../../../../app/components/edition/MyTicketCard.vue'

/**
 * Un billet annulé le DIT, sur la carte du participant — constat B8.
 *
 * ## Le défaut
 *
 * `my-tickets` ne connaissait pas l'annulation : ni l'état de la ligne, ni le statut de la
 * commande n'entraient dans sa requête, et la réponse ne les portait pas. Un billet `Canceled`
 * chez HelloAsso, ou une commande remboursée, apparaissait donc dans « Mon billet » **avec son
 * code QR et sans un mot**.
 *
 * Au guichet, ce même billet est **refusé** par `billetAnnule()`. **Le participant découvrait
 * l'annulation devant la file.**
 *
 * ## 📍 ANNONCÉ, JAMAIS MASQUÉ
 *
 * Filtrer le billet aurait été pire : il disparaîtrait de « Mes billets » sans explication, et la
 * personne croirait n'en avoir jamais eu. Un test tient cette décision.
 *
 * ## ⚠️ POURQUOI CES TESTS VISENT DES ANCRES `data-*` ET NON LE TEXTE
 *
 * L'environnement de test est en **anglais** : une clé i18n neuve, créée en français seulement, y
 * ressort **brute** (« ticketing.my_ticket.cancelled_badge »), puis **change** à la
 * synchronisation des traductions. Asserter le libellé serait donc vrai aujourd'hui et faux la
 * semaine prochaine — trois tests sont déjà tombés un soir pour cette raison dans ce dépôt. Les
 * ancres, elles, disent l'ÉTAT et ne bougent pas.
 */
const monterAvec = async (tickets: unknown[]) => {
  registerEndpoint('/api/editions/21/my-tickets', () => ({ tickets }))
  const composant = await mountSuspended(MyTicketCard, { props: { editionId: 21 } })
  // Les billets sont chargés APRÈS le montage : sans cette attente, la carte est encore vide et
  // toute assertion d'absence passerait pour la mauvaise raison.
  await vi.waitFor(() => expect(composant.text()).toContain('Pass 3 jours'))
  return composant
}

const billet = (extra: Record<string, unknown> = {}) => ({
  id: 1,
  type: 'ticket',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.org',
  qrCode: 'abc',
  tierName: 'Pass 3 jours',
  amount: 4200,
  provider: null,
  entryValidated: false,
  entryValidatedAt: null,
  annule: false,
  ...extra,
})

/** Le bouton qui ouvre le code QR. */
const boutonQr = (composant: { findAll: (s: string) => any[] }) =>
  composant.findAll('button').find((b) => b.text().includes('QR Code'))

describe('carte des billets — un billet annulé', () => {
  it('⚠️ LE BILLET RESTE AFFICHÉ, avec une mention « Annulé »', async () => {
    const composant = await monterAvec([billet({ annule: true })])

    // Toujours là : le masquer laisserait croire qu'on n'a jamais eu de billet.
    expect(composant.text()).toContain('Pass 3 jours')
    expect(composant.find('[data-billet-annule]').exists()).toBe(true)
  })

  it('⚠️ LE BOUTON DU CODE QR EST DÉSACTIVÉ', async () => {
    /*
     * C'est le geste qu'on fait devant la file : présenter le code. Le laisser actif sur un billet
     * refusé par le guichet revient à inviter à l'erreur.
     */
    const composant = await monterAvec([billet({ annule: true })])

    expect(boutonQr(composant)!.attributes('disabled')).toBeDefined()
  })

  it('⚠️ « ANNULÉ » PRÉVAUT SUR « ENTRÉE VALIDÉE » — les deux peuvent être vrais', async () => {
    /*
     * L'ASSERTION LA PLUS UTILE DU FICHIER. Un billet peut avoir été validé à l'entrée PUIS
     * annulé côté billetterie. Afficher la validation masquerait alors l'annulation — c'est-à-dire
     * exactement l'information que la personne doit lire. Un `v-if` sur `entryValidated` posé
     * avant celui de l'annulation produirait ce défaut, et rien à l'écran ne le signalerait.
     */
    const composant = await monterAvec([billet({ annule: true, entryValidated: true })])

    expect(composant.find('[data-billet-annule]').exists()).toBe(true)
    expect(composant.find('[data-entree-validee]').exists()).toBe(false)
  })

  it('un billet VALIDE garde sa mention de validation et son bouton actif', async () => {
    /*
     * LE TÉMOIN. Sans lui, un composant qui afficherait « Annulé » et désactiverait le bouton
     * POUR TOUS satisferait les trois cas précédents — et personne ne pourrait plus présenter son
     * billet.
     */
    const composant = await monterAvec([billet({ entryValidated: true })])

    expect(composant.find('[data-entree-validee]').exists()).toBe(true)
    expect(composant.find('[data-billet-annule]').exists()).toBe(false)
    expect(boutonQr(composant)!.attributes('disabled')).toBeUndefined()
  })
})
