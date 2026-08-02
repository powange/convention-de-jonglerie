import { describe, expect, it } from 'vitest'

import {
  classifyRequest,
  MAX_CACHED_TILES,
  OFFLINE_CACHES,
  shouldPrecachePage,
  type CacheKind,
} from '../../../shared/utils/offline-cache'

const ORIGIN = 'https://juggling-convention.com'

describe('classifyRequest', () => {
  it('garde les tuiles des fonds de carte', () => {
    expect(classifyRequest('https://tile.openstreetmap.org/15/16/11.png', 'image', ORIGIN)).toBe(
      'tile'
    )
    expect(
      classifyRequest(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/11/16',
        'image',
        ORIGIN
      )
    ).toBe('tile')
  })

  it('garde les zones et les points de repère d’une édition', () => {
    expect(classifyRequest(`${ORIGIN}/api/editions/24/zones`, 'empty', ORIGIN)).toBe('map-data')
    expect(classifyRequest(`${ORIGIN}/api/editions/24/markers`, 'empty', ORIGIN)).toBe('map-data')
  })

  /**
   * Constaté à l'usage : la page d'accueil était conservée mais pas sa liste d'éditions, si bien
   * qu'elle s'affichait vide hors ligne — un site en apparence cassé plutôt qu'un contenu daté.
   * Ces réponses sont publiques et identiques pour tous.
   */
  it('garde la liste des éditions et leur fiche', () => {
    expect(classifyRequest(`${ORIGIN}/api/editions`, 'empty', ORIGIN)).toBe('map-data')
    expect(classifyRequest(`${ORIGIN}/api/editions?limit=20`, 'empty', ORIGIN)).toBe('map-data')
    expect(classifyRequest(`${ORIGIN}/api/editions/24`, 'empty', ORIGIN)).toBe('map-data')
  })

  /**
   * Une carte datée reste utile ; une commande ou un droit périmé induit en erreur. La règle par
   * défaut de l'API est donc de ne rien garder.
   */
  it('ne garde rien du reste de l’API', () => {
    for (const path of [
      '/api/editions/24/treasury',
      '/api/editions/24/ticketing/orders',
      '/api/auth/session',
      '/api/editions/24/volunteers',
    ]) {
      expect(classifyRequest(ORIGIN + path, 'empty', ORIGIN), path).toBeNull()
    }
  })

  it('garde les pages consultées', () => {
    expect(classifyRequest(`${ORIGIN}/editions/24/map`, 'document', ORIGIN)).toBe('page')
    expect(classifyRequest(`${ORIGIN}/`, 'document', ORIGIN)).toBe('page')
  })

  // Un tiers quelconque ne doit rien laisser dans le cache d'un visiteur.
  it('ignore les autres origines', () => {
    expect(classifyRequest('https://exemple.test/quelque-chose', 'document', ORIGIN)).toBeNull()
    expect(classifyRequest('https://api.iconify.design/lucide.json', 'empty', ORIGIN)).toBeNull()
  })

  // Une page en cache sans ses scripts s'affiche vide : constaté en navigateur, le rechargement
  // hors ligne réussissait sur une page entièrement blanche.
  it('garde les fichiers de build', () => {
    expect(classifyRequest(`${ORIGIN}/_nuxt/entry.B3kf9.js`, 'script', ORIGIN)).toBe('asset')
    expect(classifyRequest(`${ORIGIN}/_nuxt/entry.aQ2x1.css`, 'style', ORIGIN)).toBe('asset')
  })

  it('ignore ce qui n’est ni page ni donnée de carte', () => {
    expect(classifyRequest(`${ORIGIN}/images/logo.png`, 'image', ORIGIN)).toBeNull()
  })

  it('ne lève pas sur une URL illisible', () => {
    expect(classifyRequest('pas une url', 'document', ORIGIN)).toBeNull()
  })
})

/**
 * Le service worker reçoit le **source** de la fonction, pas la fonction elle-même : une
 * référence à un identifiant extérieur y serait introuvable, et le classement échouerait
 * silencieusement — donc plus aucun cache, précisément là où il sert.
 *
 * Ce test reconstruit la fonction depuis son propre source, comme le fait l'injection, et la
 * rejoue. C'est la seule façon de vérifier ici ce qui ne casserait qu'en production.
 */
describe('injection dans le service worker', () => {
  it('la fonction survit à sa sérialisation', () => {
    const rebuilt = new Function(`return (${classifyRequest.toString()})`)() as (
      url: string,
      destination: string,
      origin: string
    ) => CacheKind

    expect(rebuilt('https://tile.openstreetmap.org/15/16/11.png', 'image', ORIGIN)).toBe('tile')
    expect(rebuilt(`${ORIGIN}/api/editions/24/zones`, 'empty', ORIGIN)).toBe('map-data')
    expect(rebuilt(`${ORIGIN}/editions/24/map`, 'document', ORIGIN)).toBe('page')
    expect(rebuilt(`${ORIGIN}/_nuxt/entry.B3kf9.js`, 'script', ORIGIN)).toBe('asset')
    expect(rebuilt(`${ORIGIN}/api/editions/24/treasury`, 'empty', ORIGIN)).toBeNull()
  })
})

describe('paramètres des caches', () => {
  it('nomme les trois caches avec la même version', () => {
    const versions = Object.values(OFFLINE_CACHES).map((name) => name.split('-').pop())
    expect(new Set(versions).size).toBe(1)
  })

  it('plafonne les tuiles conservées', () => {
    expect(MAX_CACHED_TILES).toBeGreaterThan(0)
    expect(MAX_CACHED_TILES).toBeLessThanOrEqual(2000)
  })
})

/**
 * La première visite d'une page n'est jamais contrôlée par le service worker, qui s'installe
 * après elle : sans mise en cache explicite, il aurait fallu deux visites en ligne pour qu'une
 * page soit disponible hors ligne. Mesuré en navigateur avant d'être corrigé — le cache des
 * pages restait vide après une visite complète.
 */
describe('shouldPrecachePage', () => {
  it('garde l’accueil et la carte d’une édition', () => {
    expect(shouldPrecachePage('/')).toBe(true)
    expect(shouldPrecachePage('/editions/24/map')).toBe(true)
    expect(shouldPrecachePage('/editions/24/map/')).toBe(true)
  })

  // Chaque page gardée coûte une requête supplémentaire sur une connexion déjà mauvaise.
  it('ne garde pas le reste du site', () => {
    for (const path of [
      '/editions/24',
      '/editions/24/gestion/map',
      '/editions/24/mapping',
      '/profile',
      '/editions',
    ]) {
      expect(shouldPrecachePage(path), path).toBe(false)
    }
  })
})

/**
 * Observé en interrogeant la page réelle : les traductions ne passent pas par le dossier des
 * fichiers de build, contrairement à ce que j'avais supposé pendant trois correctifs. Le module
 * i18n les prérend en fichiers statiques hachés servis depuis un chemin à part.
 *
 * Sans cette règle, l'interface revenait hors ligne avec ses clés à la place des libellés.
 */
describe('ressources servies hors du dossier de build', () => {
  it('garde les messages de traduction', () => {
    expect(classifyRequest(`${ORIGIN}/_i18n/66788b4e/fr/messages.json`, 'empty', ORIGIN)).toBe(
      'asset'
    )
    expect(classifyRequest(`${ORIGIN}/_i18n/66788b4e/pl/messages.json`, 'empty', ORIGIN)).toBe(
      'asset'
    )
  })

  // Servies par l'API, mais publiques et stables. Sans elles, plus le moindre pictogramme.
  it('garde les collections d’icônes', () => {
    expect(
      classifyRequest(`${ORIGIN}/api/_nuxt_icon/lucide.json?icons=moon`, 'empty', ORIGIN)
    ).toBe('asset')
  })

  // La règle des icônes ne doit pas ouvrir le reste de l'API.
  it('n’ouvre pas le reste de l’API au passage', () => {
    expect(classifyRequest(`${ORIGIN}/api/session/me`, 'empty', ORIGIN)).toBeNull()
    expect(classifyRequest(`${ORIGIN}/api/editions/24/treasury`, 'empty', ORIGIN)).toBeNull()
  })
})
