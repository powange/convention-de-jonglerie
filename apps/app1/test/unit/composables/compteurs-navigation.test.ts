import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  compteurNavigation,
  enregistrerFournisseurCompteur,
  oublierCompteursNavigation,
  rafraichirCompteurs,
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

/**
 * Une barre de navigation ne devrait jamais produire d'erreur pour quelqu'un qui n'a rien demandé.
 * Interroger le compteur d'un module auquel l'utilisateur n'a pas droit provoque un refus côté
 * serveur — et remplit le journal d'erreurs de 403 parfaitement légitimes.
 */
describe('registre — entrées visibles seulement', () => {
  const retraits: Array<() => void> = []

  beforeEach(() => {
    while (retraits.length) retraits.pop()!()
    oublierCompteursNavigation()
  })

  const enregistrer = (cle: string, charger: (c: any) => Promise<number | null>) => {
    retraits.push(enregistrerFournisseurCompteur({ cle, charger }))
  }

  it("n'interroge pas un module absent du menu", async () => {
    const interdit = vi.fn(async () => 1)
    enregistrer('interdit', interdit)
    enregistrer('permis', async () => 4)

    await rafraichirCompteursNavigation({}, ['permis'])

    expect(interdit).not.toHaveBeenCalled()
    expect(compteurNavigation('permis').value).toBe(4)
  })

  it('efface le compteur d’un module devenu invisible', async () => {
    // Changement d'édition, droits révoqués : la pastille de la visite précédente ne doit pas
    // survivre à la disparition de son entrée.
    enregistrer('stock', async () => 3)
    await rafraichirCompteursNavigation({}, ['stock'])
    expect(compteurNavigation('stock').value).toBe(3)

    await rafraichirCompteursNavigation({}, [])
    expect(compteurNavigation('stock').value).toBeNull()
  })

  it('interroge tout le monde sans liste fournie', async () => {
    // Une navigation qui ne filtre rien garde le comportement d'avant.
    enregistrer('a', async () => 1)
    enregistrer('b', async () => 2)

    await rafraichirCompteursNavigation({})

    expect(compteurNavigation('a').value).toBe(1)
    expect(compteurNavigation('b').value).toBe(2)
  })

  describe('rafraîchissement ciblé', () => {
    it('recharge la clé visée sans toucher aux autres', async () => {
      // Le défaut que ce module referme : l'écran des emprunts se rafraîchissait en passant sa
      // seule clé comme « liste des entrées visibles », ce qui effaçait toutes les autres. Sans
      // conséquence tant qu'il n'y avait qu'un compteur, visible dès qu'il y en a eu trois.
      let emprunts = 2
      enregistrer('stock-emprunts', async () => emprunts)
      enregistrer('benevoles-candidatures', async () => 5)

      await rafraichirCompteursNavigation({ editionId: 1 }, [
        'stock-emprunts',
        'benevoles-candidatures',
      ])
      emprunts = 0

      await rafraichirCompteurs('stock-emprunts')

      expect(compteurNavigation('stock-emprunts').value).toBe(0)
      expect(compteurNavigation('benevoles-candidatures').value).toBe(5)
    })

    it('réemploie le contexte du dernier rafraîchissement complet', async () => {
      // L'écran qui appelle connaît son édition, mais pas ce que la navigation a résolu pour lui.
      const vus: unknown[] = []
      enregistrer('emprunts', async (contexte) => {
        vus.push(contexte.editionId)
        return 1
      })

      await rafraichirCompteursNavigation({ editionId: 22 }, ['emprunts'])
      await rafraichirCompteurs('emprunts')

      expect(vus).toEqual([22, 22])
    })

    it('ignore une clé que l’utilisateur ne voit pas', async () => {
      // L'interroger lui vaudrait un refus du serveur, et le journal se remplirait de 403
      // parfaitement légitimes.
      const charger = vi.fn(async () => 3)
      enregistrer('cachee', charger)
      enregistrer('visible', async () => 1)

      await rafraichirCompteursNavigation({ editionId: 1 }, ['visible'])
      charger.mockClear()

      await rafraichirCompteurs('cachee')

      expect(charger).not.toHaveBeenCalled()
      expect(compteurNavigation('cachee').value).toBeNull()
    })

    it('ignore une clé inconnue sans rien casser', async () => {
      enregistrer('emprunts', async () => 4)
      await rafraichirCompteursNavigation({ editionId: 1 }, ['emprunts'])

      await rafraichirCompteurs('module-qui-n-existe-pas', 'emprunts')

      expect(compteurNavigation('emprunts').value).toBe(4)
    })

    it('ne fait rien avant le premier rafraîchissement complet', async () => {
      // Ni contexte, ni pastille affichée : il n'y a rien à mettre à jour, et deviner l'édition
      // reviendrait à compter sur la mauvaise.
      const charger = vi.fn(async () => 9)
      enregistrer('emprunts', charger)

      await rafraichirCompteurs('emprunts')

      expect(charger).not.toHaveBeenCalled()
      expect(compteurNavigation('emprunts').value).toBeNull()
    })

    it('oublie le contexte au changement d’édition', async () => {
      // Sinon un rafraîchissement ciblé recompterait sur l'édition qu'on vient de quitter.
      const charger = vi.fn(async () => 6)
      enregistrer('emprunts', charger)
      await rafraichirCompteursNavigation({ editionId: 1 }, ['emprunts'])

      oublierCompteursNavigation()
      charger.mockClear()
      await rafraichirCompteurs('emprunts')

      expect(charger).not.toHaveBeenCalled()
    })

    it('isole l’échec d’un compteur', async () => {
      enregistrer('fautif', async () => {
        throw new Error('500')
      })
      enregistrer('sain', async () => 7)
      await rafraichirCompteursNavigation({ editionId: 1 }, ['fautif', 'sain'])

      await expect(rafraichirCompteurs('fautif', 'sain')).resolves.toBeUndefined()
      expect(compteurNavigation('fautif').value).toBeNull()
      expect(compteurNavigation('sain').value).toBe(7)
    })
  })
})
