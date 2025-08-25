import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /editions/[id]/commentaires', () => {
  it('smoke: devrait charger la page commentaires', async () => {
    const page = await renderRawPage('/editions/1/commentaires')
    expect(page.html()).toMatch(
      /commentaire|comment|auteur|author|loading|editions\.loading_details/i
    )
    page.unmount?.()
  })
})
