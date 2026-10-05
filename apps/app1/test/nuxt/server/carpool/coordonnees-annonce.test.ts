import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * `vi.hoisted` est indispensable ici : `vi.mock` est remonté au-dessus de tout le fichier, et une
 * `const` ordinaire serait encore dans sa zone morte quand la fabrique s'exécute — « Cannot access
 * 'mockGeocodeVille' before initialization », et le fichier ne joue AUCUN test.
 */
const { mockGeocodeVille } = vi.hoisted(() => ({ mockGeocodeVille: vi.fn() }))
vi.mock('#server/utils/geocoding', () => ({ geocodeVille: mockGeocodeVille }))

import {
  coordonneesPourCreation,
  coordonneesPourMiseAJour,
} from '../../../../../layers/carpool/server/utils/coordonnees-annonce'

/**
 * Ce qui finit en base comme coordonnée d'une annonce de covoiturage.
 *
 * ⚠️ POURQUOI CES TESTS. Quatre points d'API écrivent ces deux colonnes — création et mise à jour,
 * pour les offres comme pour les demandes. Chaque cas ci-dessous correspond à une façon précise de
 * poser un marqueur FAUX, et un marqueur faux ne se voit pas : c'est un point sur une carte, aussi
 * plausible qu'un autre.
 */
describe('la coordonnée d’une annonce à la création', () => {
  beforeEach(() => mockGeocodeVille.mockReset())

  it('retient celle du formulaire sans rien demander à Nominatim', async () => {
    // C'est la personne qui a tranché entre deux homonymes en choisissant une suggestion. Aucune
    // heuristique serveur ne vaut ce choix — et c'est aussi une requête épargnée.
    const r = await coordonneesPourCreation({
      ville: 'Vienne',
      latitude: 45.5252,
      longitude: 4.8748,
    })

    expect(r).toEqual({ latitude: 45.5252, longitude: 4.8748 })
    expect(mockGeocodeVille).not.toHaveBeenCalled()
  })

  it('géocode la ville quand le formulaire n’a pas de coordonnée', async () => {
    // Cas de la saisie libre : la ville est acceptée sans suggestion, il n'y a donc rien à reprendre.
    mockGeocodeVille.mockResolvedValue({ latitude: 43.2964, longitude: 5.3778 })

    const r = await coordonneesPourCreation({ ville: 'Marseille' })

    expect(mockGeocodeVille).toHaveBeenCalledWith('Marseille')
    expect(r).toEqual({ latitude: 43.2964, longitude: 5.3778 })
  })

  it('traite une coordonnée à moitié comme absente', async () => {
    /*
     * Une latitude seule n'est pas un point : écrite en base, elle poserait un marqueur sur le
     * méridien de Greenwich — au large du golfe de Guinée pour une ville française.
     */
    mockGeocodeVille.mockResolvedValue({ latitude: 48.8535, longitude: 2.3484 })

    const r = await coordonneesPourCreation({ ville: 'Paris', latitude: 48.8535 })

    expect(mockGeocodeVille).toHaveBeenCalledWith('Paris')
    expect(r).toEqual({ latitude: 48.8535, longitude: 2.3484 })
  })

  it('laisse l’annonce sans point quand la ville est introuvable', async () => {
    // Un échec de géocodage ne doit JAMAIS empêcher la création : la ville se saisit librement, et
    // l'écran nomme les annonces sans point au lieu de les perdre.
    mockGeocodeVille.mockResolvedValue(null)

    const r = await coordonneesPourCreation({ ville: 'Chez Robert' })

    expect(r).toEqual({ latitude: null, longitude: null })
  })
})

describe('la coordonnée d’une annonce à la mise à jour', () => {
  beforeEach(() => mockGeocodeVille.mockReset())

  it('ne touche à rien quand la ville ne change pas', async () => {
    const r = await coordonneesPourMiseAJour({ villeAvant: 'Lyon', villeApres: 'Lyon' })

    expect(r).toBeUndefined()
    expect(mockGeocodeVille).not.toHaveBeenCalled()
  })

  it('ne touche à rien quand la modification ne parle pas de la ville', async () => {
    // Changer le nombre de places ne doit pas relancer un géocodage.
    const r = await coordonneesPourMiseAJour({ villeAvant: 'Lyon' })

    expect(r).toBeUndefined()
    expect(mockGeocodeVille).not.toHaveBeenCalled()
  })

  it('RECALCULE le point quand la ville change', async () => {
    /*
     * ⚠️ LE PIÈGE QUE CETTE RÈGLE FERME. Sans elle, l'ancienne coordonnée survivait et désignait la
     * ville d'avant : un marqueur à des centaines de kilomètres, sans erreur ni avertissement.
     */
    mockGeocodeVille.mockResolvedValue({ latitude: 43.6045, longitude: 1.4442 })

    const r = await coordonneesPourMiseAJour({ villeAvant: 'Lyon', villeApres: 'Toulouse' })

    expect(mockGeocodeVille).toHaveBeenCalledWith('Toulouse')
    expect(r).toEqual({ latitude: 43.6045, longitude: 1.4442 })
  })

  it('EFFACE le point quand la nouvelle ville est introuvable', async () => {
    // Pas de point vaut mieux qu'un point faux : l'écran sait nommer une annonce sans coordonnée,
    // il ne sait pas deviner qu'un marqueur ment.
    mockGeocodeVille.mockResolvedValue(null)

    const r = await coordonneesPourMiseAJour({ villeAvant: 'Lyon', villeApres: 'Chez Robert' })

    expect(r).toEqual({ latitude: null, longitude: null })
  })

  it('retient la coordonnée fournie plutôt que de géocoder', async () => {
    const r = await coordonneesPourMiseAJour({
      villeAvant: 'Lyon',
      villeApres: 'Vienne',
      latitude: 45.5252,
      longitude: 4.8748,
    })

    expect(mockGeocodeVille).not.toHaveBeenCalled()
    expect(r).toEqual({ latitude: 45.5252, longitude: 4.8748 })
  })

  it('obéit à un retrait explicite du point', async () => {
    // Le formulaire envoie `null` pour les deux quand la saisie s'est écartée de la suggestion.
    // C'est une information, pas une absence : on efface sans rien redemander.
    const r = await coordonneesPourMiseAJour({
      villeAvant: 'Lyon',
      villeApres: 'Lyon',
      latitude: null,
      longitude: null,
    })

    expect(mockGeocodeVille).not.toHaveBeenCalled()
    expect(r).toEqual({ latitude: null, longitude: null })
  })
})
