import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /conventions/add', () => {
  it('smoke: devrait charger le formulaire ajout convention', async () => {
    const page = await renderRawPage('/conventions/add')
    expect(page.html()).toMatch(/convention|ajout|adresse|address|nom|name/i)
    page.unmount?.()
  })
})
