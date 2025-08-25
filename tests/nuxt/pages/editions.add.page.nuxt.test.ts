import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /editions/add', () => {
  it('smoke: devrait charger le formulaire ajout édition', async () => {
    const page = await renderRawPage('/editions/add')
    expect(page.html()).toMatch(/edition|ajout|date|nom|name/i)
    page.unmount?.()
  })
})
