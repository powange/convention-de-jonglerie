import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
  createSuccessResponse: (data: unknown) => ({ success: true, data }),
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => event.context.user,
}))

vi.mock('#server/utils/infos-personnelles', () => ({
  infosPersonnellesSelect: {},
  infosPersonnelles: () => ({}),
}))

vi.mock('#server/volunteers/ports/registry', () => ({
  useVolunteerPorts: () => ({ eventScope: { getEventDisplayData: async () => ({}) } }),
}))

import handler from '../../../../../../../layers/volunteers/server/api/user/volunteer-applications.get'

const prismaMock = (globalThis as any).prisma

/**
 * Ce point d'API a rendu 500 en production pendant une journée entière.
 *
 * Il demandait `timezone` sur la relation `event` — alors que ce champ vit sur l'ÉDITION. Prisma
 * refuse alors la requête ENTIÈRE : la page « mes candidatures bénévole » ne montrait plus rien.
 *
 * C'est la DEUXIÈME fois que ce défaut passe. Rien ne peut l'attraper en amont : un `select`
 * Prisma se rédige librement, le lint n'a pas d'avis, le typage non plus, et les tests qui
 * simulent la base rendent ce qu'on leur dit. Seule la confrontation au schéma le voit.
 */
const modeleDuSchema = (nom: string) => {
  const dossier = resolve(process.cwd(), 'prisma/schema')
  const schema = readdirSync(dossier)
    .filter((f) => f.endsWith('.prisma'))
    .map((f) => readFileSync(resolve(dossier, f), 'utf-8'))
    .join('\n')
  return schema.match(new RegExp(`^model ${nom} \\{$([\\s\\S]*?)^\\}$`, 'm'))?.[1] ?? ''
}

/** Les champs qu'un modèle déclare : scalaires et relations confondus. */
const champsDe = (nom: string) =>
  [...modeleDuSchema(nom).matchAll(/^\s{2}(\w+)\s+\S/gm)].map((m) => m[1])

describe('GET /api/user/volunteer-applications — la sélection colle au schéma', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([])
  })

  it('ne demande à `event` que des champs que le modèle Event déclare', async () => {
    await handler({ context: { user: { id: 42 } } } as any)

    const requete = prismaMock.editionVolunteerApplication.findMany.mock.calls[0][0]
    const demandes = Object.keys(requete.select.event.select)
    const declares = champsDe('Event')

    expect(declares.length, 'modèle Event introuvable dans le schéma').toBeGreaterThan(0)
    for (const champ of demandes) expect(declares).toContain(champ)
  })

  it('va chercher le fuseau sur l’ÉDITION, pas sur l’événement', async () => {
    // C'est exactement la confusion qui a cassé la page : les deux modèles sont voisins et liés
    // un à un, mais un seul porte le fuseau.
    await handler({ context: { user: { id: 42 } } } as any)

    const evenement =
      prismaMock.editionVolunteerApplication.findMany.mock.calls[0][0].select.event.select

    expect(evenement).not.toHaveProperty('timezone')
    expect(evenement.edition?.select?.timezone).toBe(true)
    expect(champsDe('Event')).not.toContain('timezone')
    expect(champsDe('Edition')).toContain('timezone')
  })
})
