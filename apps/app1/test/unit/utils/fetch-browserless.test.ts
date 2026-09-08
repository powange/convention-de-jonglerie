import { afterEach, describe, expect, it, vi } from 'vitest'

import { BROWSER_HEADERS, fetchWithBrowserless } from '../../../server/utils/fetch-helpers'

/**
 * Browserless s'annonce « HeadlessChrome » s'il n'a pas d'ordre contraire, et les protections
 * anti-robot le referment aussitôt : la page d'import recevait le défi Cloudflare de HelloAsso
 * (« Just a moment… ») au lieu de l'événement, et le bouton « Tester les URLs » rendait un 403.
 *
 * Le nom du navigateur est bien le point décisif : vingt secondes d'attente supplémentaires
 * n'ont rien changé, le seul User-Agent oui. La règle est donc verrouillée ici plutôt que laissée
 * à la mémoire de celui qui relira ce corps de requête.
 */
const corpsEnvoye = (appel: ReturnType<typeof vi.fn>) =>
  JSON.parse((appel.mock.calls[0]?.[1] as RequestInit).body as string)

const reponseHtml = (html: string) => ({ ok: true, text: async () => html }) as unknown as Response

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchWithBrowserless', () => {
  it('demande un User-Agent de navigateur réel', async () => {
    const appel = vi.fn(async () => reponseHtml('<html></html>'))
    vi.stubGlobal('fetch', appel)

    await fetchWithBrowserless('http://browserless:3001', 'https://exemple.fr')

    const corps = corpsEnvoye(appel)
    expect(corps.userAgent).toBe(BROWSER_HEADERS['User-Agent'])
    expect(corps.userAgent).not.toMatch(/headless/i)
  })

  it("transmet l'URL visée et l'attente de réseau inactif", async () => {
    const appel = vi.fn(async () => reponseHtml('<html>ok</html>'))
    vi.stubGlobal('fetch', appel)

    const html = await fetchWithBrowserless('http://browserless:3001', 'https://exemple.fr/page')

    const corps = corpsEnvoye(appel)
    expect(corps.url).toBe('https://exemple.fr/page')
    expect(corps.gotoOptions.waitUntil).toBe('networkidle2')
    expect(html).toBe('<html>ok</html>')
  })

  it('sait attendre le seul chargement du document', async () => {
    const appel = vi.fn(async () => reponseHtml(''))
    vi.stubGlobal('fetch', appel)

    await fetchWithBrowserless('http://browserless:3001', 'https://exemple.fr', {
      waitForNetworkIdle: false,
    })

    expect(corpsEnvoye(appel).gotoOptions.waitUntil).toBe('domcontentloaded')
  })

  it('remonte une erreur du service plutôt que de rendre un HTML vide', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => ({ ok: false, status: 500, text: async () => 'boum' }) as unknown as Response
      )
    )

    await expect(
      fetchWithBrowserless('http://browserless:3001', 'https://exemple.fr')
    ).rejects.toThrow(/500/)
  })
})
