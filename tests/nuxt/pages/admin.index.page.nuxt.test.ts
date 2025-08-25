import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /admin', () => {
  it('smoke: devrait charger la page dashboard admin', async () => {
    const page = await renderRawPage('/admin')
    expect(page.html()).toMatch(/admin|dashboard|utilisateur|user|feedback/i)
    page.unmount?.()
  })
})
