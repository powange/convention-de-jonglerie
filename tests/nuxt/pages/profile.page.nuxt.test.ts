import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /profile', () => {
  it('smoke: devrait charger la page profil', async () => {
    const page = await renderRawPage('/profile')
    expect(page.html()).toMatch(/profil|profile|email|avatar|pseudo/i)
    page.unmount?.()
  })
})
