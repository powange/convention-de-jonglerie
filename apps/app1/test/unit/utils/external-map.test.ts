import { describe, it, expect } from 'vitest'

import {
  parseExternalMapUrl,
  externalMapEmbedUrl,
  externalMapViewerUrl,
} from '../../../shared/utils/external-map'

describe('parseExternalMapUrl', () => {
  it("accepte l'URL du visualiseur Google, celle que l'organisateur a sous la main", () => {
    expect(
      parseExternalMapUrl(
        'https://www.google.com/maps/d/u/0/viewer?mid=1-7HQv2Tn1ydkOaZvqLRBUUT6Oz-oMMc&ll=46.42%2C15.86&z=17'
      )
    ).toEqual({ provider: 'google', ref: '1-7HQv2Tn1ydkOaZvqLRBUUT6Oz-oMMc' })
  })

  it("accepte la forme intégrable et celle d'édition", () => {
    expect(parseExternalMapUrl('https://www.google.com/maps/d/embed?mid=abc123')).toEqual({
      provider: 'google',
      ref: 'abc123',
    })
    expect(
      parseExternalMapUrl('https://www.google.com/maps/d/edit?mid=abc123&usp=sharing')
    ).toEqual({ provider: 'google', ref: 'abc123' })
  })

  it('accepte les domaines Google nationaux', () => {
    expect(parseExternalMapUrl('https://www.google.fr/maps/d/viewer?mid=abc123')).toEqual({
      provider: 'google',
      ref: 'abc123',
    })
    expect(parseExternalMapUrl('https://www.google.co.uk/maps/d/viewer?mid=abc123')).toEqual({
      provider: 'google',
      ref: 'abc123',
    })
  })

  it('accepte un identifiant collé seul', () => {
    expect(parseExternalMapUrl('1-7HQv2Tn1ydkOaZvqLRBUUT6Oz-oMMc')).toEqual({
      provider: 'google',
      ref: '1-7HQv2Tn1ydkOaZvqLRBUUT6Oz-oMMc',
    })
  })

  it('ignore les espaces autour', () => {
    expect(parseExternalMapUrl('  https://www.google.com/maps/d/viewer?mid=abc123  ')).toEqual({
      provider: 'google',
      ref: 'abc123',
    })
  })

  // Le champ ne doit pas devenir un moyen d'intégrer une page arbitraire dans le site.
  it("refuse un domaine qui n'est pas Google", () => {
    expect(parseExternalMapUrl('https://evil.example.com/maps/d/viewer?mid=abc123')).toBeNull()
    expect(parseExternalMapUrl('https://google.evil.com/maps/d/viewer?mid=abc')).toBeNull()
  })

  it('refuse une URL Google qui ne désigne pas une carte My Maps', () => {
    expect(parseExternalMapUrl('https://www.google.com/maps?q=Paris')).toBeNull()
    expect(parseExternalMapUrl('https://www.google.com/search?mid=abc123')).toBeNull()
  })

  it('refuse un identifiant aux caractères inattendus', () => {
    expect(parseExternalMapUrl('https://www.google.com/maps/d/viewer?mid=abc<script>')).toBeNull()
  })

  // Les autres services viendront plus tard : d'ici là, ils doivent être refusés explicitement
  // plutôt qu'intégrés au petit bonheur.
  it("refuse un service de cartographie qui n'est pas encore pris en charge", () => {
    expect(parseExternalMapUrl('https://umap.openstreetmap.fr/fr/map/ma-carte_12345')).toBeNull()
  })

  it('refuse une entrée vide ou absente', () => {
    expect(parseExternalMapUrl('')).toBeNull()
    expect(parseExternalMapUrl('   ')).toBeNull()
    expect(parseExternalMapUrl(null)).toBeNull()
    expect(parseExternalMapUrl(undefined)).toBeNull()
  })
})

describe('externalMapEmbedUrl / externalMapViewerUrl', () => {
  it('reconstruit les deux formes à partir du couple stocké', () => {
    const map = { provider: 'google', ref: 'abc123' } as const
    expect(externalMapEmbedUrl(map)).toBe('https://www.google.com/maps/d/embed?mid=abc123')
    expect(externalMapViewerUrl(map)).toBe('https://www.google.com/maps/d/viewer?mid=abc123')
  })

  // Une valeur en base issue d'une version plus récente ne doit pas casser l'affichage.
  it('ne rend rien pour un fournisseur inconnu', () => {
    const map = { provider: 'inconnu', ref: 'abc123' } as unknown as Parameters<
      typeof externalMapEmbedUrl
    >[0]
    expect(externalMapEmbedUrl(map)).toBeNull()
    expect(externalMapViewerUrl(map)).toBeNull()
  })
})
