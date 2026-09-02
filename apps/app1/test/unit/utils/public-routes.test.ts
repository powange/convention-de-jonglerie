import { describe, it, expect } from 'vitest'

import { publicRoutes, trouverRoutePublique } from '../../../server/constants/public-routes'

/**
 * La liste blanche des routes publiques est tenue à la main, et porte deux risques opposés :
 * un **oubli** ferme un endpoint public — 401 chez un visiteur —, une entrée **trop large** en
 * ouvre d'autres. Les tests d'endpoints appellent les handlers directement et ne franchissent
 * jamais ce middleware : ni l'un ni l'autre n'y serait vu.
 *
 * Ces tests couvrent surtout le second risque, le plus grave. Le premier ne se prouve pas — on
 * ne peut pas deviner qu'un endpoint *devrait* être public — mais quelques routes réellement
 * ouvertes sont vérifiées, pour qu'un remaniement de la liste ne les referme pas en silence.
 */

/** Ce qui ne doit jamais être public. Un échec ici signale une entrée trop large. */
const CHEMINS_SENSIBLES: [string, string][] = [
  // Administration
  ['/api/admin/users', 'GET'],
  ['/api/admin/backup/list', 'GET'],
  ['/api/admin/backup/restore', 'POST'],
  ['/api/admin/api-tokens', 'GET'],
  // Données personnelles
  ['/api/profile', 'GET'],
  ['/api/profile/update', 'PUT'],
  ['/api/notifications', 'GET'],
  ['/api/messenger/conversations', 'GET'],
  // Gestion d'une édition
  ['/api/editions/1/volunteers/applications', 'GET'],
  ['/api/editions/1/ticketing/orders', 'GET'],
  ['/api/editions/1/ticketing/stats', 'GET'],
  ['/api/editions/1/meals', 'GET'],
  ['/api/editions/1/tasks', 'GET'],
  // Mutations sur des ressources publiques en lecture
  ['/api/editions/1', 'PUT'],
  ['/api/editions/1', 'DELETE'],
  ['/api/editions/1/zones', 'POST'],
  ['/api/editions/1/markers', 'POST'],
  ['/api/conventions/1', 'PUT'],
  ['/api/editions', 'POST'],
]

/** Quelques routes réellement publiques, une par famille. */
const CHEMINS_PUBLICS: [string, string][] = [
  ['/api/auth/login', 'POST'],
  ['/api/auth/register', 'POST'],
  ['/api/editions', 'GET'],
  ['/api/editions/42', 'GET'],
  ['/api/editions/42/zones', 'GET'],
  ['/api/editions/42/markers', 'GET'],
  ['/api/editions/42/program', 'GET'],
  ['/api/editions/42/faq', 'GET'],
  ['/api/editions/42/posts', 'GET'],
  ['/api/editions/42/carpool-offers', 'GET'],
  ['/api/editions/42/volunteers/info', 'GET'],
  ['/api/editions/42/ticketing/tiers/public', 'GET'],
  ['/api/conventions/42', 'GET'],
  ['/api/countries', 'GET'],
  ['/api/uploads/profiles/1/photo.jpg', 'GET'],
  ['/api/public/error-logs', 'GET'],
]

describe('routes publiques — ce qui doit rester fermé', () => {
  it.each(CHEMINS_SENSIBLES)('%s %s n’est pas public', (chemin, methode) => {
    expect(trouverRoutePublique(chemin, methode)).toBeUndefined()
  })

  it('n’ouvre pas une famille entière par un préfixe trop court', () => {
    // Les deux seuls préfixes admis désignent des espaces sans données privées : les fichiers
    // servis et l'API par token, qui fait son propre contrôle dans le handler.
    const prefixes = publicRoutes
      .filter((r): r is Extract<typeof r, { prefix: string }> => 'prefix' in r)
      .map((r) => r.prefix)

    for (const prefix of prefixes) {
      // Un préfixe doit désigner un sous-espace, jamais `/api/` ni une ressource entière.
      expect(prefix.split('/').filter(Boolean).length).toBeGreaterThanOrEqual(2)
      expect(prefix.endsWith('/')).toBe(true)
    }
  })

  it('ne rend publique aucune écriture sur une édition ou une convention', () => {
    for (const methode of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      for (const chemin of ['/api/editions/1', '/api/conventions/1', '/api/editions/1/zones']) {
        expect(trouverRoutePublique(chemin, methode)).toBeUndefined()
      }
    }
  })
})

describe('routes publiques — ce qui doit rester ouvert', () => {
  it.each(CHEMINS_PUBLICS)('%s %s est public', (chemin, methode) => {
    expect(trouverRoutePublique(chemin, methode)).toBeDefined()
  })

  it('ignore la méthode non déclarée sur une route publique', () => {
    // `/api/editions` est publique en lecture seule : une création doit rester protégée.
    expect(trouverRoutePublique('/api/editions', 'GET')).toBeDefined()
    expect(trouverRoutePublique('/api/editions', 'POST')).toBeUndefined()
  })

  it('n’ouvre pas les sous-ressources d’une route déclarée exacte', () => {
    // `path` est un égal strict, pas un préfixe : sans quoi `/api/editions` ouvrirait tout.
    expect(trouverRoutePublique('/api/editions/1/volunteers/applications', 'GET')).toBeUndefined()
    expect(trouverRoutePublique('/api/countries/secret', 'GET')).toBeUndefined()
  })

  it('échoue fermé sur les formes inhabituelles d’un chemin', () => {
    // Une barre finale, une casse différente : rien de tout cela ne doit *ouvrir* une route.
    // Le sens de l'échec compte — mieux vaut un 401 sur une forme exotique qu'une ouverture
    // involontaire. Ce test se casserait si quelqu'un ajoutait une normalisation permissive.
    expect(trouverRoutePublique('/api/editions/', 'GET')).toBeUndefined()
    expect(trouverRoutePublique('/API/editions', 'GET')).toBeUndefined()
    expect(trouverRoutePublique('/api/editions', 'get')).toBeUndefined()
  })

  it('ancre ses motifs des deux côtés', () => {
    // Un motif non ancré laisserait passer un suffixe : `/api/editions/1/zones/42/secret`.
    expect(trouverRoutePublique('/api/editions/1/zones/42', 'GET')).toBeUndefined()
    expect(trouverRoutePublique('/prefixe/api/editions/1', 'GET')).toBeUndefined()
  })
})
