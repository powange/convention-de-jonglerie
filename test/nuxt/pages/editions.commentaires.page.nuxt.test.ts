import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /editions/[id]/commentaires', () => {
  it('smoke: devrait importer le composant sans erreur', async () => {
    // Test simple : vérifier que le composant peut être importé
    // sans planter à cause de useFetch ou autres composables SSR
    const modulePath = '../../../app/pages/editions/[id]/commentaires.vue'

    // On teste juste l'import du module, pas son rendu complet
    const module = await import(modulePath)
    expect(module.default).toBeDefined()
    expect(typeof module.default).toBe('object')
  })

  it('smoke: devrait pouvoir instancier le composant sans planter', async () => {
    // Test que le composant peut être instancié sans erreur fatale
    // même si le rendu complet ne fonctionne pas en environnement de test
    const page = await renderRawPage('/editions/1/commentaires')

    // Le rendu peut être vide à cause des limitations SSR en test,
    // mais au moins il ne devrait pas planter
    expect(page).toBeDefined()
    expect(page.html).toBeDefined()
    expect(page.unmount).toBeDefined()

    page.unmount?.()
  })

  // Note: Tests fonctionnels complets en e2e car useFetch nécessite
  // l'environnement Nuxt complet pour fonctionner correctement
})
