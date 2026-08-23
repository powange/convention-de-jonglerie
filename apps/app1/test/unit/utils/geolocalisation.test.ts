import { describe, it, expect } from 'vitest'

import {
  distanceKm,
  editionSurPlace,
  PRECISION_INEXPLOITABLE_KM,
  RAYON_SUR_PLACE_KM,
  TOLERANCE_PRECISION_MAX_KM,
} from '../../../shared/utils/geolocalisation'

const PARIS = { latitude: 48.8566, longitude: 2.3522 }
const LYON = { latitude: 45.764, longitude: 4.8357 }

describe('distanceKm', () => {
  it('mesure une distance connue à moins de 1 % près', () => {
    // Paris–Lyon à vol d'oiseau : environ 392 km.
    expect(distanceKm(PARIS, LYON)).toBeGreaterThan(388)
    expect(distanceKm(PARIS, LYON)).toBeLessThan(396)
  })

  it('rend zéro pour deux fois le même point', () => {
    expect(distanceKm(PARIS, PARIS)).toBe(0)
  })

  it('est symétrique', () => {
    expect(distanceKm(PARIS, LYON)).toBeCloseTo(distanceKm(LYON, PARIS), 6)
  })
})

describe('editionSurPlace', () => {
  const edition = (id: number, latitude: number, longitude: number) => ({ id, latitude, longitude })

  it('retient une édition située dans le rayon', () => {
    // ~1,1 km au nord de Paris : en deçà des 2 km retenus.
    const proche = edition(1, 48.8666, 2.3522)
    expect(editionSurPlace(PARIS, [proche])?.id).toBe(1)
  })

  it('écarte une édition hors du rayon', () => {
    expect(editionSurPlace(PARIS, [edition(1, LYON.latitude, LYON.longitude)])).toBeNull()
  })

  // Deux conventions la même semaine à quelques kilomètres : proposer la mauvaise serait pire
  // que de ne rien proposer.
  it('retient la plus proche et non la première de la liste', () => {
    const lointaine = edition(1, 48.8716, 2.3522) // ~1,7 km
    const proche = edition(2, 48.8596, 2.3522) // ~0,3 km
    expect(editionSurPlace(PARIS, [lointaine, proche])?.id).toBe(2)
  })

  it('ne rend rien sans position', () => {
    expect(editionSurPlace(null, [edition(1, 48.8666, 2.3522)])).toBeNull()
    expect(editionSurPlace(undefined, [edition(1, 48.8666, 2.3522)])).toBeNull()
  })

  it('ignore une position aux coordonnées non numériques', () => {
    const position = { latitude: Number.NaN, longitude: 2.3522 }
    expect(editionSurPlace(position, [edition(1, 48.8666, 2.3522)])).toBeNull()
  })

  it('ignore une édition dont les coordonnées manquent', () => {
    const sansCoords = { id: 1, latitude: Number.NaN, longitude: Number.NaN }
    expect(editionSurPlace(PARIS, [sansCoords])).toBeNull()
  })

  it('ne rend rien quand aucune édition n’est en cours', () => {
    expect(editionSurPlace(PARIS, [])).toBeNull()
  })

  it('accepte un rayon personnalisé', () => {
    const aUnKm = edition(1, 48.8656, 2.3522)
    expect(editionSurPlace(PARIS, [aUnKm], 0.5)).toBeNull()
    expect(editionSurPlace(PARIS, [aUnKm], RAYON_SUR_PLACE_KM)?.id).toBe(1)
  })

  // Cas réel : sur place, mais l'ordinateur n'a pas de GPS et déduit sa position du réseau. Le
  // navigateur annonce alors une incertitude de plusieurs kilomètres ; la comparer à un rayon
  // strict de deux kilomètres répondait toujours « non », y compris depuis le site.
  describe('imprécision de la position', () => {
    // ~4 km au nord : hors des 2 km, mais dans la marge d'une mesure imprécise à ±4 km.
    const aQuatreKm = { id: 1, latitude: 48.8926, longitude: 2.3522 }

    it('écarte une édition hors rayon quand la position est précise', () => {
      expect(editionSurPlace({ ...PARIS, precisionM: 20 }, [aQuatreKm])).toBeNull()
    })

    it('retient la même édition quand la mesure est annoncée imprécise', () => {
      expect(editionSurPlace({ ...PARIS, precisionM: 4000 }, [aQuatreKm])?.id).toBe(1)
    })

    it('plafonne la tolérance accordée à l’imprécision', () => {
      // Une incertitude de 15 km n'élargit que du plafond : au-delà, tout deviendrait proche.
      const auDela = {
        id: 1,
        latitude: 48.8566 + (RAYON_SUR_PLACE_KM + TOLERANCE_PRECISION_MAX_KM + 1) / 111,
        longitude: 2.3522,
      }
      expect(editionSurPlace({ ...PARIS, precisionM: 15000 }, [auDela])).toBeNull()
    })

    it('ne conclut rien d’une position trop grossière', () => {
      const juste = { id: 1, latitude: 48.8576, longitude: 2.3522 } // ~100 m
      const trop = (PRECISION_INEXPLOITABLE_KM + 1) * 1000
      expect(editionSurPlace({ ...PARIS, precisionM: trop }, [juste])).toBeNull()
    })

    it('se comporte comme avant quand la précision est absente', () => {
      const proche = { id: 1, latitude: 48.8666, longitude: 2.3522 }
      expect(editionSurPlace(PARIS, [proche])?.id).toBe(1)
      expect(editionSurPlace({ ...PARIS, precisionM: null }, [proche])?.id).toBe(1)
    })
  })
})
