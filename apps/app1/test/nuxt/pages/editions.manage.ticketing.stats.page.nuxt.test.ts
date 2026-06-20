import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /editions/[id]/gestion/ticketing/stats', () => {
  it('smoke: devrait charger la page de statistiques de billeterie', async () => {
    const page = await renderRawPage('/editions/1/gestion/ticketing/stats')
    expect(page.html()).toMatch(
      /stats|statistiques|billeterie|ticketing|gestion|manage|loading|editions\.loading_details/i
    )
    page.unmount?.()
  })
})
