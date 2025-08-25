import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /editions/[id]/covoiturage', () => {
  it('smoke: devrait charger la page covoiturage', async () => {
    const page = await renderRawPage('/editions/1/covoiturage')
    expect(page.html()).toMatch(/covoiturage|carpool|offre|demande|offer|request/i)
    page.unmount?.()
  })
})
