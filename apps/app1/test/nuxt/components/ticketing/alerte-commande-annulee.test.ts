import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import ParticipantTitleSection from '../../../../../layers/ticketing/app/components/ticketing/ParticipantTitleSection.vue'

/**
 * Ce que l'alerte d'une commande annulée annonce — constat D3.
 *
 * ## Le défaut
 *
 * Elle disait « Cette commande a été annulée. Les billets **ne peuvent pas** être validés »
 * — au présent — au-dessus d'un « Entrée déjà validée » et d'un « Statut du billet : Valide » en
 * vert. La phrase contredisait les deux lignes qu'elle surplombait.
 *
 * ## 📊 Et ce n'est pas un cas de bord : c'est le cas RÉEL
 *
 * Dans ce système, annuler est un geste de comptabilité d'après-coup. Mesuré en datant les
 * lignes : les **deux** commandes remboursées de la base l'ont été **trois jours après la fin**
 * de leur édition, et les douze lignes annulées deux à sept jours après. Aucune annulation n'a
 * jamais eu lieu pendant qu'un guichet était ouvert. Les billets de ces commandes avaient donc
 * été validés pendant l'événement, **légitimement** — la personne est venue, elle a été
 * remboursée ensuite.
 *
 * ## ⚠️ POURQUOI ON ASSÈRE UNE DIFFÉRENCE ET NON UN TEXTE
 *
 * L'environnement de test est en **anglais**, et ces deux clés n'existent qu'en français : elles
 * y ressortent **brutes**. Asserter la phrase échouerait pour une raison étrangère au lot, et
 * asserter la clé brute serait vrai jusqu'à la synchronisation des traductions — trois tests sont
 * déjà tombés un soir pour cela. On assère donc que le message **n'est pas le même**, ce qui est
 * vrai en clé brute comme après traduction.
 */
const commande = (entreeValidee: boolean) => ({
  ticket: {
    order: {
      id: 1,
      status: 'Refunded',
      // Le gabarit lit `order.payer.firstName` sans garde : sans ce bloc, le montage lève
      // « Cannot read properties of undefined ». C'est la forme que le point d'API rend.
      payer: { firstName: 'Léa', lastName: 'Martin', email: 'lea@exemple.fr' },
      items: [
        {
          id: 10,
          type: 'Registration',
          name: 'Pass 3 jours',
          amount: 4500,
          entryValidated: entreeValidee,
          entryValidatedAt: entreeValidee ? '2026-06-01T10:00:00Z' : null,
        },
      ],
    },
  },
})

/**
 * La description de l'alerte, prise sur le composant `UAlert` lui-même.
 *
 * ⚠️⚠️ ET NON `composant.text()`, qui rendait ce test CREUX : avec une entrée validée, le badge
 * et l'icône de la ligne changent aussi, si bien que deux textes complets diffèrent **même si
 * l'alerte, elle, ne change pas**. Le test passait donc sans rien prouver — mesuré en l'écrivant.
 */
const descriptionPour = async (entreeValidee: boolean) => {
  const composant = await mountSuspended(ParticipantTitleSection, {
    props: { participant: commande(entreeValidee), type: 'ticket', isRefunded: true },
  })
  const alerte = composant.findComponent({ name: 'UAlert' })
  expect(alerte.exists(), 'l’alerte d’annulation est introuvable').toBe(true)
  return alerte.props('description') as string
}

describe('ParticipantTitleSection — l’alerte d’une commande annulée', () => {
  it('⚠️ DIT AUTRE CHOSE QUAND UNE ENTRÉE A DÉJÀ ÉTÉ VALIDÉE', async () => {
    const sansEntree = await descriptionPour(false)
    const avecEntree = await descriptionPour(true)

    expect(avecEntree).not.toBe(sansEntree)
    expect(sansEntree.length, 'la description est vide').toBeGreaterThan(0)
    expect(avecEntree.length, 'la description est vide').toBeGreaterThan(0)
  })

  it('⚠️ LE TÉMOIN : l’alerte n’apparaît PAS sur une commande qui n’est pas annulée', async () => {
    /*
     * Sans lui, un composant qui afficherait l'alerte en permanence satisferait le cas précédent
     * — et annoncerait une annulation sur chaque commande du guichet.
     */
    const composant = await mountSuspended(ParticipantTitleSection, {
      props: { participant: commande(true), type: 'ticket', isRefunded: false },
    })

    expect(composant.findComponent({ name: 'UAlert' }).exists()).toBe(false)
  })
})
