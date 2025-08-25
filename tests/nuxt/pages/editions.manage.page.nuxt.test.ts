import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

describe('Page /editions/[id]/gestion', () => {
  it('smoke: devrait charger la page de gestion édition', async () => {
    const page = await renderRawPage('/editions/1/gestion')
    expect(page.html()).toMatch(/gestion|manage|collaborateur|collaborator|droits|rights/i)
    page.unmount?.()
  })
})
