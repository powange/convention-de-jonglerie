import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /editions/[id]/commentaires', () => {
  // Import mis en cache pour éviter de recharger le composant à chaque test
  let pageModule: any
  let renderedPage: any

  beforeAll(async () => {
    // Charger le module une seule fois
    const modulePath = '../../../app/pages/editions/[id]/commentaires.vue'
    pageModule = await import(modulePath)

    // Rendre la page une seule fois
    renderedPage = await renderRawPage('/editions/1/commentaires')
  })

  afterAll(() => {
    // Nettoyer après tous les tests
    if (renderedPage?.unmount) {
      renderedPage.unmount()
    }
  })

  it('smoke: devrait importer le composant sans erreur', () => {
    // Test simple : vérifier que le composant peut être importé
    // sans planter à cause de useFetch ou autres composables SSR
    expect(pageModule.default).toBeDefined()
    expect(typeof pageModule.default).toBe('object')
  })

  it('smoke: devrait pouvoir instancier le composant sans planter', () => {
    // Test que le composant peut être instancié sans erreur fatale
    // même si le rendu complet ne fonctionne pas en environnement de test
    expect(renderedPage).toBeDefined()
    expect(renderedPage.html).toBeDefined()
    expect(renderedPage.unmount).toBeDefined()
  })

  // Note: Tests fonctionnels complets en e2e car useFetch nécessite
  // l'environnement Nuxt complet pour fonctionner correctement
})
