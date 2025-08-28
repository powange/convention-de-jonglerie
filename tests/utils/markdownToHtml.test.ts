import { describe, it, expect } from 'vitest'

// dynamic import to mirror runtime usage
async function render(md: string) {
  const mod = (await import('../../app/utils/markdown')) as {
    markdownToHtml: (s: string) => Promise<string>
  }
  return mod.markdownToHtml(md)
}

describe('markdownToHtml', () => {
  it('rend du HTML simple', async () => {
    const html = await render('# Titre')
    expect(html).toContain('<h1')
    expect(html).toContain('Titre')
  })

  it('sanitise script tag', async () => {
    const html = await render('Hello <script>alert(1)</script>')
    expect(html).toContain('Hello')
    expect(html).not.toContain('<script')
  })

  it('gère le GFM (liste + emphase)', async () => {
    const html = await render('- *item*')
    expect(html).toContain('<ul')
    expect(html).toContain('<em>item</em>')
  })
})
