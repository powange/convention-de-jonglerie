import { describe, it, expect, vi } from 'vitest'

import { chargerTraductionsPourRoute } from '../../../app/utils/chargement-traductions'

/**
 * Charger les domaines de traduction d'une route, dans une langue donnée.
 *
 * ⚠️ POURQUOI CETTE FONCTION A ÉTÉ EXTRAITE. La boucle vivait dans `SelectLanguage.vue`, et seul
 * ce composant savait la faire. Le jour où il a fallu appliquer la langue du PROFIL à
 * l'hydratation de la session, il n'y avait le choix qu'entre la recopier ou l'extraire — et
 * recopiée, elle aurait divergé au premier domaine ajouté : la langue changée à la main aurait
 * chargé ses traductions, celle du profil non, et la moitié de l'écran serait restée en clés
 * brutes. Sans erreur, comme toujours avec l'i18n de ce projet.
 *
 * Les dépendances sont passées en arguments, ce qui rend la DÉCISION éprouvable sans monter de
 * composant Nuxt : quels domaines, dans quel ordre, et que faire d'un loader qui échoue.
 */

const domaine = (contenu: Record<string, unknown>) => () => Promise.resolve({ default: contenu })

describe('chargerTraductionsPourRoute', () => {
  it('fusionne chaque domaine de la route, dans la locale visée', async () => {
    const fusionner = vi.fn()

    const charges = await chargerTraductionsPourRoute({
      chemin: '/editions/42',
      locale: 'nl',
      fusionner,
      domainesDeLaRoute: () => ['edition', 'common'],
      loaders: {
        edition: { nl: domaine({ edition: { title: 'Titel' } }) },
        common: { nl: domaine({ common: { save: 'Opslaan' } }) },
      } as any,
    })

    expect(charges).toEqual(['edition', 'common'])
    expect(fusionner).toHaveBeenCalledTimes(2)
    expect(fusionner).toHaveBeenCalledWith('nl', { edition: { title: 'Titel' } })
    expect(fusionner).toHaveBeenCalledWith('nl', { common: { save: 'Opslaan' } })
  })

  it('respecte l’ORDRE des domaines de la route', async () => {
    /*
     * L'ordre n'est pas indifférent : plusieurs fichiers partagent une même racine dans ce projet
     * (`gestion.json`, `gestion-map`, `gestion-tasks`…). Le dernier fusionné a le dernier mot sur
     * les clés communes, exactement comme côté serveur.
     */
    const ordre: string[] = []

    await chargerTraductionsPourRoute({
      chemin: '/x',
      locale: 'fr',
      fusionner: (_l, m) => ordre.push(Object.keys(m)[0]!),
      domainesDeLaRoute: () => ['a', 'b', 'c'],
      loaders: {
        a: { fr: domaine({ a: 1 }) },
        b: { fr: domaine({ b: 1 }) },
        c: { fr: domaine({ c: 1 }) },
      } as any,
    })

    expect(ordre).toEqual(['a', 'b', 'c'])
  })

  it('ignore un domaine que la locale ne fournit pas', async () => {
    // Tous les domaines n'existent pas dans toutes les langues : l'absence d'un loader n'est pas
    // une erreur, c'est une donnée.
    const fusionner = vi.fn()

    const charges = await chargerTraductionsPourRoute({
      chemin: '/x',
      locale: 'uk',
      fusionner,
      domainesDeLaRoute: () => ['present', 'absent'],
      loaders: { present: { uk: domaine({ present: 1 }) }, absent: {} } as any,
    })

    expect(charges).toEqual(['present'])
    expect(fusionner).toHaveBeenCalledTimes(1)
  })

  it('un domaine qui ÉCHOUE n’empêche pas les suivants', async () => {
    /*
     * L'invariant qui protège l'écran. Sans cette tolérance, une seule requête ratée — réseau
     * instable, fichier absent du déploiement — laisserait la page SANS AUCUN libellé au lieu
     * d'un bloc manquant. Le comportement était déjà celui de `SelectLanguage` ; l'extraction ne
     * devait pas le perdre, et rien ne le vérifiait.
     */
    const fusionner = vi.fn()
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {})

    const charges = await chargerTraductionsPourRoute({
      chemin: '/x',
      locale: 'fr',
      fusionner,
      domainesDeLaRoute: () => ['casse', 'marche'],
      loaders: {
        casse: { fr: () => Promise.reject(new Error('404')) },
        marche: { fr: domaine({ marche: 1 }) },
      } as any,
    })

    expect(charges).toEqual(['marche'])
    expect(fusionner).toHaveBeenCalledTimes(1)
    expect(erreur).toHaveBeenCalled()

    erreur.mockRestore()
  })

  it('rend la liste des domaines CHARGÉS, pas celle des domaines demandés', async () => {
    /*
     * Ce retour n'est pas une commodité de test : c'est le seul moyen, à l'exécution, de
     * distinguer « aucun domaine n'était à charger » de « les loaders ont tous échoué ». Les deux
     * donnent un écran identique.
     */
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {})

    const aucun = await chargerTraductionsPourRoute({
      chemin: '/x',
      locale: 'fr',
      fusionner: vi.fn(),
      domainesDeLaRoute: () => [],
      loaders: {} as any,
    })

    const tousCasses = await chargerTraductionsPourRoute({
      chemin: '/x',
      locale: 'fr',
      fusionner: vi.fn(),
      domainesDeLaRoute: () => ['a'],
      loaders: { a: { fr: () => Promise.reject(new Error('boum')) } } as any,
    })

    expect(aucun).toEqual([])
    expect(tousCasses).toEqual([])
    // Ce qui les distingue est la trace, pas le retour — et c'est pourquoi la trace existe.
    expect(erreur).toHaveBeenCalledTimes(1)

    erreur.mockRestore()
  })

  it('accepte un module sans `default`', async () => {
    // Les fichiers de locales sont parfois importés en modules d'espace de noms : `m.default || m`
    // couvre les deux formes, et le perdre chargerait `undefined` sans lever.
    const fusionner = vi.fn()

    await chargerTraductionsPourRoute({
      chemin: '/x',
      locale: 'fr',
      fusionner,
      domainesDeLaRoute: () => ['a'],
      loaders: { a: { fr: () => Promise.resolve({ a: { titre: 'Titre' } }) } } as any,
    })

    expect(fusionner).toHaveBeenCalledWith('fr', { a: { titre: 'Titre' } })
  })
})
