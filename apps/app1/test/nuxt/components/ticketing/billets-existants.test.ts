import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'

import AddParticipantModal from '../../../../../layers/ticketing/app/components/ticketing/AddParticipantModal.vue'

/**
 * Le guichet est averti quand un billet existe déjà pour cette adresse.
 *
 * ⚠️ CE QUI MANQUAIT. Rien ne signalait au guichet qu'une personne avait déjà un billet : on
 * saisissait de bonne foi une seconde commande, la personne PAYAIT DEUX FOIS, et le doublon ne se
 * découvrait qu'au scan — ou jamais. La recherche par adresse existait pourtant déjà, sur l'écran
 * d'à côté.
 *
 * ⚠️ L'ENCART NE BLOQUE RIEN, et c'est un choix : un billet légitime peut parfaitement s'ajouter à
 * un existant — un accompagnant, un second jour, un autre tarif. Le bloquer transformerait une
 * information utile en obstacle, devant quelqu'un qui attend.
 *
 * 🔬 DEUX PIÈGES DE HARNAIS, tous deux rencontrés ici.
 *
 * 1. Le point d'API est servi par `registerEndpoint` plutôt que remplacé par un mock de `$fetch` :
 *    le composant appelle le `$fetch` auto-importé de Nuxt, que `vi.stubGlobal` n'intercepte pas.
 *
 * 2. `UModal` TÉLÉPORTE son contenu dans `document.body` : `composant.text()` rend une chaîne
 *    VIDE, quoi qu'affiche la modale. Mes assertions `not.toContain` passaient donc À VIDE — elles
 *    auraient été vertes avec ou sans encart. On lit `document.body.textContent`.
 *
 *    Corollaire : le corps du document est PARTAGÉ entre les tests, et un test qui échoue
 *    n'atteint pas son démontage. D'où le nettoyage en `afterEach`, sans quoi l'encart d'un test
 *    serait lu par le suivant.
 */

const EDITION = 42
const ADRESSE = 'camille@example.com'

/** Ce que le point d'API de recherche doit renvoyer, réglé test par test. */
const billetsServis = vi.hoisted(() => ({ liste: [] as any[] }))

registerEndpoint(`/api/editions/${EDITION}/ticketing/search`, {
  method: 'POST',
  handler: () => ({
    success: true,
    data: { results: { tickets: billetsServis.liste, total: billetsServis.liste.length } },
  }),
})

// L'adresse saisie correspond à un compte : le composant préremplit puis cherche les billets.
registerEndpoint('/api/users/search', () => ({
  data: { users: [{ prenom: 'Camille', nom: 'Martin', email: ADRESSE }] },
}))

// Les appels que le composant fait à son ouverture, et qui ne concernent pas ce test.
registerEndpoint(`/api/editions/${EDITION}/ticketing/options`, () => ({ data: [] }))
registerEndpoint(`/api/editions/${EDITION}/ticketing/tiers/available`, () => ({ data: [] }))

mockNuxtImport('useToast', () => () => ({ add: vi.fn() }))

/** Un billet tel que le point d'API du guichet le rend. */
const billet = (surcharges: Record<string, any> = {}) => ({
  type: 'ticket',
  participant: {
    found: true,
    ticket: {
      id: 1,
      qrCode: 'qr-existant',
      name: 'Entrée week-end',
      entryValidated: false,
      user: { firstName: 'Camille', lastName: 'Martin', email: ADRESSE },
      order: { payer: { email: ADRESSE } },
      ...surcharges,
    },
  },
})

describe('AddParticipantModal — billets déjà existants', () => {
  const montes: { unmount: () => void }[] = []

  beforeEach(() => {
    billetsServis.liste = []
  })

  afterEach(() => {
    while (montes.length) montes.pop()?.unmount()
    // Le corps du document est partagé : une modale laissée ouverte serait lue par le test suivant.
    document.body.innerHTML = ''
  })

  /** Ce que la modale affiche RÉELLEMENT — téléporté hors du composant. */
  const texteAffiche = () => document.body.textContent ?? ''

  /** Monte la modale, saisit l'adresse, et déclenche la recherche. */
  const saisirLAdresse = async () => {
    const composant = await mountSuspended(AddParticipantModal, {
      props: { open: true, editionId: EDITION },
    })
    montes.push(composant)

    const vm = composant.vm as any
    vm.form.payerEmail = ADRESSE
    await vm.searchUserByEmail()
    await nextTick()

    return composant
  }

  it('affiche l’encart quand un billet existe déjà', async () => {
    billetsServis.liste = [billet()]

    const composant = await saisirLAdresse()

    expect((composant.vm as any).billetsExistants).toHaveLength(1)
    expect(texteAffiche()).toContain('Entrée week-end')
  })

  it('n’affiche RIEN quand aucun billet n’existe', async () => {
    // Le cas de loin le plus fréquent. Un encart affiché à vide apprendrait à l'ignorer, et le
    // jour où il compte, personne ne le lit.
    const composant = await saisirLAdresse()

    expect((composant.vm as any).billetsExistants).toHaveLength(0)
    expect(texteAffiche()).not.toContain('Entrée week-end')
  })

  it('IGNORE le billet de quelqu’un d’autre', async () => {
    /*
     * ⚠️ LE TEST QUI COMPTE LE PLUS. Le point d'API du guichet est une recherche PAR MOTS-CLÉS :
     * elle découpe le terme et rapproche nom, prénom et adresse. Passer une adresse peut donc
     * ramener le billet d'UNE AUTRE PERSONNE dont le nom contient l'un des mots.
     *
     * Annoncer au guichet un doublon qui n'existe pas est PIRE que de ne rien annoncer : on
     * refuserait une vente légitime, en croyant éviter une erreur.
     */
    billetsServis.liste = [
      billet({
        user: { firstName: 'Camille', lastName: 'Dubois', email: 'camille.dubois@example.com' },
        order: { payer: { email: 'camille.dubois@example.com' } },
        name: 'Billet de quelqu’un d’autre',
      }),
    ]

    const composant = await saisirLAdresse()

    expect((composant.vm as any).billetsExistants).toHaveLength(0)
    expect(texteAffiche()).not.toContain('quelqu’un d’autre')
  })

  it('retient un billet dont seul le PAYEUR porte l’adresse', async () => {
    /*
     * Quelqu'un a payé pour un tiers : l'adresse du billet est celle du tiers, celle du payeur est
     * la nôtre. C'est bien un billet de cette personne, et l'ignorer laisserait passer le doublon
     * le plus courant au guichet — celui d'une commande groupée.
     */
    billetsServis.liste = [
      billet({
        user: { firstName: 'Alex', lastName: 'Martin', email: 'alex@example.com' },
        order: { payer: { email: ADRESSE } },
      }),
    ]

    const composant = await saisirLAdresse()

    expect((composant.vm as any).billetsExistants).toHaveLength(1)
  })

  it('n’EMPÊCHE PAS l’ajout', async () => {
    /*
     * L'invariant du lot. Un accompagnant, un second jour, un autre tarif : le doublon apparent
     * est souvent légitime. Si l'encart bloquait, il faudrait le contourner — et on cesserait de
     * le lire.
     */
    billetsServis.liste = [billet()]

    const composant = await saisirLAdresse()
    const vm = composant.vm as any

    // `canSubmit` ne dépend en rien des billets trouvés.
    const avant = vm.canSubmit
    vm.billetsExistants = []
    await nextTick()

    expect(vm.canSubmit).toBe(avant)
  })

  it('oublie les billets à la fermeture', async () => {
    /*
     * Sans cela, l'encart d'une personne resterait affiché à l'ouverture suivante — pour quelqu'un
     * d'autre. Un faux doublon, attribué au mauvais participant.
     */
    billetsServis.liste = [billet()]

    const composant = await saisirLAdresse()
    const vm = composant.vm as any
    expect(vm.billetsExistants).toHaveLength(1)

    vm.closeModal()
    await nextTick()

    expect(vm.billetsExistants).toHaveLength(0)
  })

  it('une recherche en PANNE ne casse pas la saisie', async () => {
    /*
     * L'encart est un confort. S'il empêchait d'ajouter un participant quand la recherche tombe,
     * il serait pire que son absence : le guichet se retrouverait bloqué par une fonction qui ne
     * sert qu'à prévenir.
     */
    billetsServis.liste = [{ participant: null }] // forme inattendue : rien d'exploitable

    const composant = await saisirLAdresse()
    const vm = composant.vm as any

    expect(vm.billetsExistants).toHaveLength(0)
    // Les champs nom/prénom sont bien apparus : la saisie continue.
    expect(vm.showNameFields).toBe(true)
  })
})
