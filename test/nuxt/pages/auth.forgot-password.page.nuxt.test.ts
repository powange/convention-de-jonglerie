import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page auth/forgot-password', () => {
  let page: any

  beforeAll(async () => {
    // Rendre la page une seule fois pour tous les tests
    page = await renderRawPage('/auth/forgot-password')
  })

  afterAll(() => {
    // Nettoyer après tous les tests
    if (page?.unmount) {
      page.unmount()
    }
  })

  it('smoke: devrait charger la page mot de passe oublié', () => {
    expect(page.html()).toMatch(
      /email|mot de passe|r\u00e9initialisation|oubli\u00e9|password|forgot/i
    )
  })
})
