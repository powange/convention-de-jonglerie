import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'

const canManageTreasuryByIdMock = vi.hoisted(() => vi.fn())
const canManageArtistsByIdMock = vi.hoisted(() => vi.fn())
const getAuthSessionMock = vi.hoisted(() => vi.fn())

vi.mock('../../../../server/utils/permissions/edition-permissions', () => ({
  canManageTreasuryById: canManageTreasuryByIdMock,
  canManageArtistsById: canManageArtistsByIdMock,
}))
vi.mock('../../../../server/utils/session-helpers', () => ({
  getAuthSession: getAuthSessionMock,
}))

const handler = (await import('../../../../server/routes/uploads/[...path].get')).default

/**
 * Un fichier qui EXISTE est-il bien servi ?
 *
 * ## Pourquoi ce fichier existe
 *
 * `uploads-justificatifs.test.ts` éprouve le REFUS, et affirmait que le cas « le fichier est servi »
 * n'était pas testable : remplacer `stat` de `node:fs/promises` n'a aucun effet sur cette route,
 * les modules natifs étant externalisés côté serveur. C'était exact, et la conclusion fausse — il
 * suffit de ne rien remplacer du tout : on écrit un VRAI fichier dans un dossier temporaire et on
 * y pointe `NUXT_FILE_STORAGE_MOUNT`. Le `stat` réel le trouve.
 *
 * Ce qui a coûté cette correction : la route a servi 404 pour TOUT fichier déposé — affiches,
 * avatars, justificatifs — pendant une journée, en production comprise. La cause était une variable
 * mal renommée au moment de poser `Cache-Control` ; l'exception tombait dans le `catch` qui
 * entourait aussi la lecture du fichier, et ressortait en « File not found ». Rien ne la
 * distinguait d'un fichier absent, et le cache de Cloudflare servait encore les images déjà vues.
 *
 * Tout test de refus restait vert : un refus et un bug rendent le même code. Seul un test qui
 * demande un fichier PRÉSENT pouvait le voir.
 *
 * ## Les aides h3, prises là où elles sont
 *
 * Le code serveur appelle `setHeader` et `sendStream` en globaux, que Nitro déclare à l'exécution.
 * `test/setup.ts` pose à leur place des `vi.fn()` neutres : il faut donc écouter CES globaux, et
 * non le `res` du faux événement, qui ne reçoit rien. `sendStream`, lui, n'est pas posé du tout —
 * l'appel y lèverait une `ReferenceError`, ce qui est tant mieux : le fait d'arriver jusqu'à lui
 * est précisément ce qu'on veut constater.
 */
const racine = mkdtempSync(join(tmpdir(), 'uploads-servis-'))
const mountInitial = process.env.NUXT_FILE_STORAGE_MOUNT
const prismaMock = (globalThis as any).prisma

/** Les fichiers posés une fois pour toutes : seul leur chemin compte, pas leur contenu. */
const FICHIERS: Record<string, string> = {
  'editions/22/affiche.jpg': 'affiche',
  'conventions/1/editions/22/treasury/ticket.jpg': 'ticket',
  'conventions/1/editions/22/treasury/facture.pdf': 'facture',
}

for (const [chemin, contenu] of Object.entries(FICHIERS)) {
  mkdirSync(join(racine, chemin, '..'), { recursive: true })
  writeFileSync(join(racine, chemin), contenu)
}

afterAll(() => {
  if (mountInitial === undefined) delete process.env.NUXT_FILE_STORAGE_MOUNT
  else process.env.NUXT_FILE_STORAGE_MOUNT = mountInitial
})

describe('route /uploads/** — servir un fichier présent', () => {
  let entetes: Record<string, string>
  let envoye: string | null

  const appeler = (path: string) => {
    entetes = {}
    envoye = null
    ;(globalThis as any).setHeader = (_e: unknown, cle: string, valeur: unknown) => {
      entetes[cle.toLowerCase()] = String(valeur)
    }
    ;(globalThis as any).sendStream = (_e: unknown, flux: { path?: string }) => {
      envoye = String(flux.path)
      return 'flux'
    }

    return handler({
      context: { params: { path } },
      node: { req: { headers: {}, method: 'GET' }, res: {} },
    } as any)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NUXT_FILE_STORAGE_MOUNT = racine
    prismaMock.editionArtist.findUnique.mockResolvedValue(null)
  })

  it('sert une affiche d’édition, sans demander de session', async () => {
    await appeler('editions/22/affiche.jpg')

    // Le flux porte bien le fichier demandé : la route est allée au bout, en-têtes posés comprise.
    expect(envoye).toBe(join(racine, 'editions/22/affiche.jpg'))
    expect(entetes['content-type']).toBe('image/jpeg')
    expect(entetes['content-length']).toBe(String(FICHIERS['editions/22/affiche.jpg']!.length))
    // Une affiche est faite pour être vue : un cache partagé peut la garder.
    expect(entetes['cache-control']).toContain('public')
    // Et rien ici n'est derrière un droit : la session n'est même pas interrogée.
    expect(getAuthSessionMock).not.toHaveBeenCalled()
  })

  it('sert un justificatif à qui en a le droit, en cache privé', async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: 42 } })
    canManageTreasuryByIdMock.mockResolvedValue(true)

    await appeler('conventions/1/editions/22/treasury/ticket.jpg')

    expect(envoye).toBe(join(racine, 'conventions/1/editions/22/treasury/ticket.jpg'))
    expect(entetes['content-type']).toBe('image/jpeg')
    /*
     * `private`, et c'est le point du test : une pièce comptable vient d'être mise derrière un
     * droit, un cache partagé la servirait sinon à quelqu'un qui ne l'a pas.
     */
    expect(entetes['cache-control']).toContain('private')
    expect(entetes['cache-control']).not.toContain('public')
  })

  it('annonce un PDF en application/pdf, et non en octet-stream', async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: 42 } })
    canManageTreasuryByIdMock.mockResolvedValue(true)

    await appeler('conventions/1/editions/22/treasury/facture.pdf')

    // Sans ce type, le navigateur téléchargeait la facture au lieu de l'ouvrir.
    expect(entetes['content-type']).toBe('application/pdf')
  })

  it('rend 404 quand le fichier n’existe vraiment pas', async () => {
    await expect(appeler('editions/22/jamais-deposee.jpg')).rejects.toThrow('File not found')
    expect(envoye).toBeNull()
  })
})
