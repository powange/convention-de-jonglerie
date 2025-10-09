import { describe, it, expect } from 'vitest'

describe('Page /admin/feedback', () => {
  it('smoke: devrait pouvoir importer le composant sans erreur', async () => {
    // Test simple : vérifier que le composant peut être importé
    // Cette page est complexe et nécessite beaucoup de données API,
    // donc on évite de la rendre complètement dans les tests unitaires
    const modulePath = '../../../app/pages/admin/feedback.vue'
    const module = await import(modulePath)

    expect(module.default).toBeDefined()
    expect(typeof module.default).toBe('object')
  })

  // Note: Tests fonctionnels complets en e2e car cette page nécessite
  // l'environnement Nuxt complet avec API, middleware super-admin, etc.
})
