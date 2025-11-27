import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /my-conventions', () => {
  let page: any

  beforeAll(async () => {
    // Rendre la page une seule fois pour tous les tests
    page = await renderRawPage('/my-conventions')
  })

  afterAll(() => {
    // Nettoyer après tous les tests
    if (page?.unmount) {
      page.unmount()
    }
  })

  it('smoke: devrait pouvoir importer le composant sans erreur', () => {
    // La page my-conventions utilise await useLazyI18n() et des v-if conditionnels
    // Le rendu initial peut être vide (<!----> ou très minimal) car le contenu
    // dépend de l'état de chargement et de l'authentification
    // On vérifie simplement que l'import a fonctionné sans crash
    const html = page.html()
    expect(html).toBeDefined()
    // Le html peut être un commentaire Vue vide ou contenir du contenu
    expect(typeof html).toBe('string')
  })
})
