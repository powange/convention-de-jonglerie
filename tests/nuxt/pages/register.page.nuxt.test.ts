import { describe, it, expect } from 'vitest'
import { renderRawPage } from '../utils/renderPage'

// Smoke test page register

describe('Page /register', () => {
  it('devrait se rendre et contenir indices de formulaire', async () => {
  const page = await renderRawPage('/register')
  expect(page.html()).toMatch(/register|email|pseudo|auth/i)
  page.unmount?.()
  })
})
