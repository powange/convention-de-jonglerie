import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page auth/forgot-password', () => {
  it('smoke: devrait charger la page mot de passe oublié', async () => {
    const page = await renderRawPage('/auth/forgot-password')
    expect(page.html()).toMatch(
      /email|mot de passe|r\u00e9initialisation|oubli\u00e9|password|forgot/i
    )
    page.unmount?.()
  })
})
