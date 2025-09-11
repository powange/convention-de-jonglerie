import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /editions/[id]/carpool', () => {
  it('smoke: devrait charger la page carpool', async () => {
    const page = await renderRawPage('/editions/1/carpool')
    expect(page.html()).toMatch(
      /covoiturage|carpool|offre|demande|offer|request|loading|editions\.loading_details/i
    )
    page.unmount?.()
  })
})
