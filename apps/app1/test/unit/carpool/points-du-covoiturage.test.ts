import { describe, expect, it } from 'vitest'

import {
  cadreDesPoints,
  genreDuPoint,
  pointsDuCovoiturage,
  traitsVersLaConvention,
  type AnnonceLocalisable,
} from '../../../../../layers/carpool/app/utils/points-du-covoiturage'

/**
 * Ce que la carte du covoiturage pose, et ce qu'elle doit nommer au lieu de le perdre.
 *
 * ⚠️ POURQUOI CES TESTS. Une carte échoue en silence : une épingle manquante ne lève pas, une
 * épingle superposée est invisible, et un rectangle mal calculé laisse la vue au-dessus de rien.
 * Chaque cas ci-dessous est une de ces disparitions muettes.
 */

const offre = (id: number, ville: string, lat?: number | null, lon?: number | null) =>
  ({ id, locationCity: ville, latitude: lat, longitude: lon }) as AnnonceLocalisable

describe('regrouper les annonces en points de carte', () => {
  it('réunit en UN point les annonces d’une même ville', () => {
    /*
     * Treize offres au départ de Lyon poseraient treize épingles exactement superposées : on n'en
     * verrait qu'une, et les douze autres seraient invisibles sans qu'on puisse le soupçonner.
     */
    const { points } = pointsDuCovoiturage({
      offres: [offre(1, 'Lyon', 45.7578, 4.832), offre(2, 'Lyon', 45.7578, 4.832)],
      demandes: [offre(3, 'Lyon', 45.7578, 4.832)],
    })

    expect(points).toHaveLength(1)
    expect(points[0]!.ville).toBe('Lyon')
    expect(points[0]!.offres.map((o) => o.id)).toEqual([1, 2])
    expect(points[0]!.demandes.map((d) => d.id)).toEqual([3])
    expect(points[0]!.total).toBe(3)
  })

  it('tolère un écart de quelques mètres sur la même ville', () => {
    // Deux saisies de Lyon peuvent différer au cent-millième de degré — un mètre. Sans
    // l'arrondi de la clé, cela ferait deux points voisins illisibles.
    const { points } = pointsDuCovoiturage({
      offres: [offre(1, 'Lyon', 45.75781, 4.83201), offre(2, 'Lyon', 45.75784, 4.83203)],
    })

    expect(points).toHaveLength(1)
    expect(points[0]!.total).toBe(2)
  })

  it('ne confond pas deux villes homonymes éloignées', () => {
    // Vienne (Isère) et Vienne (Autriche) portent le même nom : seule la coordonnée les distingue,
    // et c'est exactement le piège que la migration de rattrapage a dû trancher.
    const { points } = pointsDuCovoiturage({
      offres: [offre(1, 'Vienne', 45.5252, 4.8748), offre(2, 'Vienne', 48.2084, 16.3725)],
    })

    expect(points).toHaveLength(2)
  })

  it('ignore la casse et les espaces du nom de ville', () => {
    const { points } = pointsDuCovoiturage({
      offres: [offre(1, ' Lyon ', 45.7578, 4.832), offre(2, 'lyon', 45.7578, 4.832)],
    })

    expect(points).toHaveLength(1)
    // Le libellé retenu est débarrassé de ses espaces, pas affiché tel quel.
    expect(points[0]!.ville).toBe('Lyon')
  })

  it('NOMME les annonces sans coordonnée au lieu de les écarter', () => {
    /*
     * La ville se saisit librement : il y aura toujours des annonces sans point. Les perdre
     * silencieusement est le défaut le plus facile à commettre ici — l'écran doit les lister.
     */
    const { points, sansPoint } = pointsDuCovoiturage({
      offres: [offre(1, 'Lyon', 45.7578, 4.832), offre(2, 'Chez Robert', null, null)],
      demandes: [offre(3, 'Au bout du chemin')],
    })

    expect(points).toHaveLength(1)
    expect(sansPoint).toEqual([
      { annonce: expect.objectContaining({ id: 2 }), genre: 'offre' },
      { annonce: expect.objectContaining({ id: 3 }), genre: 'demande' },
    ])
  })

  it('traite une coordonnée à moitié comme absente', () => {
    // Une latitude seule poserait une épingle sur le méridien de Greenwich — au large du golfe de
    // Guinée pour une ville française. Plausible sur une carte, et parfaitement faux.
    const { points, sansPoint } = pointsDuCovoiturage({ offres: [offre(1, 'Lyon', 45.7578, null)] })

    expect(points).toHaveLength(0)
    expect(sansPoint).toHaveLength(1)
  })

  it('écarte une coordonnée qui n’est pas un nombre fini', () => {
    const { sansPoint } = pointsDuCovoiturage({
      offres: [offre(1, 'Nulle part', Number.NaN, Number.NaN)],
    })

    expect(sansPoint).toHaveLength(1)
  })

  it('place les points les plus fournis en DERNIER', () => {
    // Dans Leaflet, le marqueur ajouté le plus tard passe devant : le point qui porte le plus
    // d'annonces doit donc sortir en fin de liste, sinon il se retrouve masqué par un voisin.
    const { points } = pointsDuCovoiturage({
      offres: [
        offre(1, 'Lyon', 45.7578, 4.832),
        offre(2, 'Lyon', 45.7578, 4.832),
        offre(3, 'Paris', 48.8535, 2.3484),
      ],
    })

    expect(points.map((p) => p.ville)).toEqual(['Paris', 'Lyon'])
  })

  it('ne rend rien sur une entrée vide ou absente', () => {
    expect(pointsDuCovoiturage({})).toEqual({ points: [], sansPoint: [] })
    expect(pointsDuCovoiturage({ offres: null, demandes: null })).toEqual({
      points: [],
      sansPoint: [],
    })
  })
})

describe('le cadre de la vue', () => {
  it('englobe les villes ET le lieu de la convention', () => {
    // Une carte du covoiturage sans la destination ne dit pas d'où l'on vient : le lieu de la
    // convention fait partie du cadre, c'est le point de la demande.
    const { points } = pointsDuCovoiturage({ offres: [offre(1, 'Lyon', 45.7578, 4.832)] })

    const cadre = cadreDesPoints(points, { latitude: 43.6045, longitude: 1.4442 })

    expect(cadre).toEqual([
      [43.6045, 1.4442],
      [45.7578, 4.832],
    ])
  })

  it('rend un cadre même si la convention est le seul point connu', () => {
    // Dégénéré, mais Leaflet le centre correctement — là où un `null` laisserait la carte sur sa
    // vue par défaut, quelque part au-dessus de la France.
    const cadre = cadreDesPoints([], { latitude: 43.6045, longitude: 1.4442 })

    expect(cadre).toEqual([
      [43.6045, 1.4442],
      [43.6045, 1.4442],
    ])
  })

  it('rend `null` quand il n’y a vraiment rien à montrer', () => {
    expect(cadreDesPoints([], null)).toBeNull()
    expect(cadreDesPoints([], { latitude: null, longitude: null })).toBeNull()
  })
})

describe('le genre d’un point', () => {
  const du = (offres: number, demandes: number) =>
    pointsDuCovoiturage({
      offres: Array.from({ length: offres }, (_, i) => offre(i + 1, 'Lyon', 45.7578, 4.832)),
      demandes: Array.from({ length: demandes }, (_, i) => offre(100 + i, 'Lyon', 45.7578, 4.832)),
    }).points[0]!

  it('distingue offres seules, demandes seules et les deux', () => {
    // C'est cette valeur qui décide la couleur de l'épingle ET celle de son trait. Remontée ici
    // depuis le composant, où deux ternaires jumeaux auraient fini par se contredire.
    expect(genreDuPoint(du(2, 0))).toBe('offres')
    expect(genreDuPoint(du(0, 2))).toBe('demandes')
    expect(genreDuPoint(du(1, 1))).toBe('mixte')
  })
})

describe('les traits vers la convention', () => {
  it('relie chaque ville au lieu de la convention', () => {
    const { points } = pointsDuCovoiturage({
      offres: [offre(1, 'Lyon', 45.7578, 4.832), offre(2, 'Paris', 48.8535, 2.3484)],
    })

    const traits = traitsVersLaConvention(points, { latitude: 43.6045, longitude: 1.4442 })

    expect(traits).toHaveLength(2)
    for (const trait of traits) {
      // La convention est TOUJOURS la seconde extrémité : Leaflet trace dans l'ordre donné, et
      // l'inverser ferait partir les pointillés du mauvais bout sans que cela se voie.
      expect(trait.segment[1]).toEqual([43.6045, 1.4442])
    }
    // Sans ordre imposé : l'ordre des points a son propre test, et le réasserter ici rendrait
    // celui-ci sensible à un détail qu'il ne cherche pas à éprouver.
    expect(traits.map((t) => t.segment[0])).toEqual(
      expect.arrayContaining([
        [45.7578, 4.832],
        [48.8535, 2.3484],
      ])
    )
  })

  it('ne trace RIEN si le lieu de la convention est inconnu', () => {
    /*
     * ⚠️ Les coordonnées d'une édition sont nullables. Sans cette garde, les traits partiraient
     * vers `[0, 0]` : neuf droites filant vers le golfe de Guinée — un dessin parfaitement
     * plausible et parfaitement faux.
     */
    const { points } = pointsDuCovoiturage({ offres: [offre(1, 'Lyon', 45.7578, 4.832)] })

    expect(traitsVersLaConvention(points, null)).toEqual([])
    expect(traitsVersLaConvention(points, {})).toEqual([])
    expect(traitsVersLaConvention(points, { latitude: 43.6, longitude: null })).toEqual([])
    expect(traitsVersLaConvention(points, { latitude: Number.NaN, longitude: 1.44 })).toEqual([])
  })

  it('reprend le genre du point, pour que le trait ait la couleur de son épingle', () => {
    const { points } = pointsDuCovoiturage({
      offres: [offre(1, 'Lyon', 45.7578, 4.832)],
      demandes: [offre(2, 'Lyon', 45.7578, 4.832), offre(3, 'Paris', 48.8535, 2.3484)],
    })

    const traits = traitsVersLaConvention(points, { latitude: 43.6045, longitude: 1.4442 })
    const parVille = new Map(traits.map((t) => [t.cle.split('|')[0], t.genre]))

    expect(parVille.get('lyon')).toBe('mixte')
    expect(parVille.get('paris')).toBe('demandes')
  })
})
