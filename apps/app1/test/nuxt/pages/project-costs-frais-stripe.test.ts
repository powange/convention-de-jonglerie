import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'

/** Ce que le point d'API rend, réglé cas par cas. */
const reponse = vi.hoisted(() => ({
  valeur: {} as Record<string, unknown>,
}))

registerEndpoint('/api/project-costs/donations', () => reponse.valeur)
// Les autres appels de la page, qui ne concernent pas ce test.
registerEndpoint('/api/project-costs', () => ({ expenses: [] }))

import PageDesCouts from '../../../app/pages/project-costs/index.vue'

/**
 * Le BRANCHEMENT de l'affichage des frais Stripe — constat B4.
 *
 * ## ⚠️ POURQUOI CE FICHIER EXISTE, alors que le point d'API a ses cinq cas
 *
 * Le défaut était à moitié dans l'écran : il affichait `totalCents − totalNetCents`, une
 * DIFFÉRENCE, sous le libellé « frais Stripe ». Un point d'API juste n'y change rien tant que la
 * page recalcule la même soustraction — et c'est précisément ce qu'un test d'endpoint ne peut pas
 * voir.
 *
 * ## ⚠️⚠️ CE QUI EST ASSERTÉ : LE MONTANT, PAS LE LIBELLÉ
 *
 * L'environnement de test est en **anglais**, et la mention « frais en attente » est une clé créée
 * en français seulement : elle y ressort **brute**. On vise donc des ancres `data-*`, insensibles à
 * la langue, et l'on compare le CHIFFRE — « 0.68 » contre « 10.68 », c'est-à-dire exactement
 * l'écart entre les frais réels et l'ancienne soustraction.
 */
const avecUnDonEnAttente = {
  donationsEnabled: true,
  totalCoffees: 3,
  totalDonations: 3,
  totalCents: 3000,
  // 19,32 € confirmés + 10 € dont les frais sont inconnus
  totalNetCents: 2932,
  totalFeeCents: 68,
  pendingFeeCount: 1,
  totalCostCents: 0,
  estimatedHours: null,
}

/**
 * ⚠️⚠️ LA RÉPONSE DU SERVEUR D'AVANT, et c'est le seul jeu d'essai qui prouve quelque chose du
 * premier cas.
 *
 * Mon premier essai employait la réponse CORRIGÉE ci-dessus — où `totalCents − totalNetCents`
 * vaut justement 68. La soustraction et `totalFeeCents` y donnent donc le MÊME chiffre, et le cas
 * restait vert avec l'ancien gabarit : il ne mesurait rien. C'est le sabotage qui l'a dit, en ne
 * faisant tomber qu'un autre cas.
 *
 * Ici `totalNetCents` vaut 19,32 € — le net que l'ancien serveur calculait, en excluant le don
 * dont les frais manquent. La soustraction rendrait « 10,68 € de frais » là où Stripe n'en a
 * prélevé que 0,68 : exactement le symptôme du constat. Un écran qui lit `totalFeeCents` est
 * insensible à cet écart, et c'est ce qu'on vérifie.
 */
const REPONSE_DU_SERVEUR_DAVANT = {
  ...avecUnDonEnAttente,
  totalNetCents: 1932,
}

let monte: { unmount: () => void } | null = null
afterEach(() => {
  monte?.unmount()
  monte = null
})

const rendre = async (valeur: Record<string, unknown>) => {
  reponse.valeur = valeur
  const wrapper = await mountSuspended(PageDesCouts)
  monte = wrapper
  await new Promise((r) => setTimeout(r, 30))
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('Page des coûts — les frais Stripe', () => {
  it('⚠️ ANNONCE LES FRAIS RÉELS, ET NON LA DIFFÉRENCE', async () => {
    const page = await rendre(REPONSE_DU_SERVEUR_DAVANT)

    const frais = page.find('[data-frais-stripe]')
    expect(frais.exists(), 'la ligne des frais est introuvable').toBe(true)
    // 0,68 € de frais connus — l'ancienne soustraction affichait 10,68 €.
    expect(frais.text()).toContain('0.68')
    expect(frais.text()).not.toContain('10.68')
  })

  it('dit qu’un don attend encore ses frais', async () => {
    const page = await rendre(avecUnDonEnAttente)

    expect(page.find('[data-frais-en-attente]').exists()).toBe(true)
  })

  it('ne dit rien à attendre quand tous les frais sont connus', async () => {
    /*
     * LE TÉMOIN. Sans lui, une page qui afficherait TOUJOURS la mention satisferait le cas
     * précédent — et l'on annoncerait des frais en attente sur une page où tout est soldé, ce qui
     * ferait douter du reste des chiffres.
     */
    const page = await rendre({ ...avecUnDonEnAttente, totalFeeCents: 102, pendingFeeCount: 0 })

    expect(page.find('[data-frais-en-attente]').exists()).toBe(false)
    expect(page.find('[data-frais-stripe]').text()).toContain('1.02')
  })
})
