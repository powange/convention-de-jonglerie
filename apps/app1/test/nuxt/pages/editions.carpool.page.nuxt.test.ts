import { describe, it, expect } from 'vitest'

describe('Page /editions/[id]/carpool', () => {
  it('smoke: devrait pouvoir importer le composant sans erreur', async () => {
    // Test simple : vérifier que le composant peut être importé
    // Le rendu complet est lent (~2s) et sera couvert par les tests e2e
    // Page déplacée dans le layer carpool (modularisation).
    // Littéral inliné (pas de variable) pour que Vite résolve le chemin au transform,
    // relativement à ce fichier (monorepo : layers à la racine, ../../../../../layers).
    const module = await import(
      '../../../../../layers/carpool/app/pages/editions/[id]/carpool/index.vue'
    )

    expect(module.default).toBeDefined()
    expect(typeof module.default).toBe('object')
  })

  // Note: Tests fonctionnels complets en e2e car cette page nécessite
  // l'environnement Nuxt complet avec stores, router, données d'API, etc.
})
