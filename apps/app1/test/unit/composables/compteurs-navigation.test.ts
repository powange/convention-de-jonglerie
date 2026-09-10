import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  compteurNavigation,
  enregistrerFournisseurCompteur,
  oublierCompteursNavigation,
  rafraichirCompteursNavigation,
} from '../../../../../layers/ui/app/composables/useCompteursNavigation'

/**
 * Une pastille n'est utile que si elle se voit sans ouvrir la page qu'elle signale : c'est donc la
 * navigation qui porte le compte, alors qu'elle n'a aucune raison de savoir comment on le calcule.
 *
 * Ce registre tient cette inversion. Ce qui compte le plus, ici, est l'isolement : une barre de
 * navigation qui disparaîtrait parce qu'un module a mal répondu serait pire que la pastille
 * manquante.
 */
describe('registre des compteurs de navigation', () => {
  const retraits: Array<() => void> = []

  const enregistrer = (cle: string, charger: (c: any) => Promise<number | null>) => {
    retraits.push(enregistrerFournisseurCompteur({ cle, charger }))
  }

  beforeEach(() => {
    while (retraits.length) retraits.pop()!()
    oublierCompteursNavigation()
  })

  it('rend le compte publié par un fournisseur', async () => {
    enregistrer('emprunts', async () => 3)
    await rafraichirCompteursNavigation({ editionId: 22 })

    expect(compteurNavigation('emprunts').value).toBe(3)
  })

  it('transmet le contexte au fournisseur', async () => {
    // Le registre ne sait pas ce qu'il transmet, et c'est voulu : il n'a pas à connaître les
    // besoins des modules.
    const charger = vi.fn(async () => 1)
    enregistrer('emprunts', charger)
    await rafraichirCompteursNavigation({ editionId: 22, truc: 'machin' })

    expect(charger).toHaveBeenCalledWith({ editionId: 22, truc: 'machin' })
  })

  it('rend null pour une clé inconnue', async () => {
    expect(compteurNavigation('jamais-vue').value).toBeNull()
  })

  it('isole l’échec d’un fournisseur', async () => {
    // Le point capital. Sans isolement, un module en panne emporterait toutes les pastilles.
    enregistrer('casse', async () => {
      throw new Error('API indisponible')
    })
    enregistrer('sain', async () => 7)

    await expect(rafraichirCompteursNavigation({})).resolves.toBeUndefined()
    expect(compteurNavigation('casse').value).toBeNull()
    expect(compteurNavigation('sain').value).toBe(7)
  })

  it('efface le compteur d’un fournisseur qui rend null', async () => {
    // Le module s'est désactivé, ou les droits ont changé : la pastille doit disparaître, pas
    // rester figée sur sa dernière valeur.
    let valeur: number | null = 4
    enregistrer('emprunts', async () => valeur)

    await rafraichirCompteursNavigation({})
    expect(compteurNavigation('emprunts').value).toBe(4)

    valeur = null
    await rafraichirCompteursNavigation({})
    expect(compteurNavigation('emprunts').value).toBeNull()
  })

  it('interroge les fournisseurs en parallèle', async () => {
    // Trois modules qui répondent en cent millisecondes ne doivent pas coûter trois cents.
    const lent = () => new Promise<number>((resolve) => setTimeout(() => resolve(1), 30))
    enregistrer('a', lent)
    enregistrer('b', lent)
    enregistrer('c', lent)

    const debut = Date.now()
    await rafraichirCompteursNavigation({})

    expect(Date.now() - debut).toBeLessThan(80)
  })

  it('oublie les comptes sans oublier les fournisseurs', async () => {
    // Au changement de contexte : on efface ce qui était affiché, mais les modules restent
    // déclarés — sans quoi il faudrait recharger la page pour les revoir.
    enregistrer('emprunts', async () => 5)
    await rafraichirCompteursNavigation({})

    oublierCompteursNavigation()
    expect(compteurNavigation('emprunts').value).toBeNull()

    await rafraichirCompteursNavigation({})
    expect(compteurNavigation('emprunts').value).toBe(5)
  })

  it('le retrait d’un fournisseur emporte son compteur', async () => {
    const retirer = enregistrerFournisseurCompteur({ cle: 'ephemere', charger: async () => 2 })
    await rafraichirCompteursNavigation({})
    expect(compteurNavigation('ephemere').value).toBe(2)

    retirer()
    expect(compteurNavigation('ephemere').value).toBeNull()
  })

  it('deux fournisseurs de même clé : le dernier gagne', async () => {
    // Le cas d'un rechargement à chaud en développement, qui rejouerait le plugin.
    enregistrer('emprunts', async () => 1)
    enregistrer('emprunts', async () => 9)
    await rafraichirCompteursNavigation({})

    expect(compteurNavigation('emprunts').value).toBe(9)
  })
})
