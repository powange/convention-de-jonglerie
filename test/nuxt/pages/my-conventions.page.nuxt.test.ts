import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /my-conventions', () => {
  it('smoke: devrait charger la page mes conventions', async () => {
    const page = await renderRawPage('/my-conventions')
    expect(page.html()).toMatch(/mes|my|conventions|favori|favorite/i)
    page.unmount?.()
  })
})
