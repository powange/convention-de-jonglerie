import { describe, it, expect } from 'vitest'

// Import statique pour optimiser les performances
import { markdownToHtml } from '../../../app/utils/markdown'

describe('markdownToHtml', () => {
  it('rend du HTML simple', async () => {
    const html = await markdownToHtml('# Titre')
    expect(html).toContain('<h1')
    expect(html).toContain('Titre')
  })

  it('sanitise script tag', async () => {
    const html = await markdownToHtml('Hello <script>alert(1)</script>')
    expect(html).toContain('Hello')
    expect(html).not.toContain('<script')
  })

  it('gère le GFM (liste + emphase)', async () => {
    const html = await markdownToHtml('- *item*')
    expect(html).toContain('<ul')
    expect(html).toContain('<em>item</em>')
  })
})
