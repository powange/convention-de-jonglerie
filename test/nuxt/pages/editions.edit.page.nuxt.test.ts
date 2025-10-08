import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /editions/[id]/edit', () => {
  it('smoke: devrait charger la page édition (edit)', async () => {
    const page = await renderRawPage('/editions/1/edit')
    expect(page.html()).toMatch(/edition|édit|edit|description|services?/i)
    page.unmount?.()
  })
})
