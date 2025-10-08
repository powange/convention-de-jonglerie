import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /admin/feedback', () => {
  it('smoke: devrait charger la page admin feedback', async () => {
    const page = await renderRawPage('/admin/feedback')
    expect(page.html()).toMatch(/feedback|stat|filtre|filter/i)
    page.unmount?.()
  })
})
