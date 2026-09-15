import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'

import MyTicketCard from '../../../../app/components/edition/MyTicketCard.vue'

/**
 * Le logo de provenance sur la carte des billets du participant.
 *
 * La condition portait sur un booléen `isHelloAsso` calculé par l'API : un billet Infomaniak
 * n'affichait donc AUCUN logo, et l'ajout d'un fournisseur aurait demandé de retoucher l'API et
 * l'écran. La carte passe désormais par l'utilitaire partagé, qui connaît tous les fournisseurs
 * et retombe sur le logo du site.
 *
 * Ce fichier garde aussi l'import lui-même : l'utilitaire vit dans le layer `ticketing`, la carte
 * dans `apps/app1`. C'est le seul endroit du dépôt qui franchit cette frontière, et un chemin
 * erroné n'y échouerait qu'au build — pas en développement.
 */
const monterAvec = async (tickets: unknown[]) => {
  registerEndpoint('/api/editions/21/my-tickets', () => ({ tickets }))
  const composant = await mountSuspended(MyTicketCard, { props: { editionId: 21 } })
  // Les billets sont chargés APRÈS le montage : sans cette attente, la carte est encore vide et
  // toute assertion d'absence passerait pour la mauvaise raison.
  await vi.waitFor(() => expect(composant.text()).toContain('Pass 3 jours'))
  return composant
}

const billet = (extra: Record<string, unknown>) => ({
  id: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.org',
  qrCode: 'abc',
  tierName: 'Pass 3 jours',
  amount: 4200,
  entryValidated: false,
  entryValidatedAt: null,
  ...extra,
})

describe('carte des billets — le logo de provenance', () => {
  it('montre le logo du fournisseur pour un billet importé', async () => {
    const composant = await monterAvec([billet({ type: 'ticket', provider: 'INFOMANIAK' })])

    const logo = composant.find('img[title="Infomaniak"]')
    expect(logo.exists()).toBe(true)
  })

  it('montre le logo du site pour un billet créé sur place', async () => {
    // `provider` nul ne veut pas dire « origine inconnue » : il veut dire « saisi ici ».
    const composant = await monterAvec([billet({ type: 'ticket', provider: null })])

    expect(composant.find('img[src="/logos/logo-jc.svg"]').exists()).toBe(true)
  })

  it('n’en montre aucun pour un badge de bénévole', async () => {
    // Le logo répond à « d'où vient ce billet » — un badge de bénévole n'en a pas.
    // La carte est bien rendue (le libellé est présent) : l'absence d'image est donc constatée,
    // et non l'effet d'un composant vide.
    const composant = await monterAvec([billet({ type: 'volunteer' })])

    expect(composant.text()).toContain('Pass 3 jours')
    expect(composant.findAll('img').length).toBe(0)
  })
})
