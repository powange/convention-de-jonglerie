import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /editions/[id]/objets-trouves', () => {
  it('smoke: devrait charger la page objets-trouves', async () => {
    const page = await renderRawPage('/editions/1/objets-trouves')
    expect(page.html()).toMatch(/objets|trouvés|lost|found|item/i)
    page.unmount?.()
  })
})
