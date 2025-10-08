import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /admin/users', () => {
  it('smoke: devrait charger la page admin users', async () => {
    const page = await renderRawPage('/admin/users')
    expect(page.html()).toMatch(/user|utilisateur|email|role|rôle/i)
    page.unmount?.()
  })
})
