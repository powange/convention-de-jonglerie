import { describe, it, expect } from 'vitest'

import { replaceShowComposition } from '../../../server/utils/show-acts'

/**
 * Ce que ces tests verrouillent : **un numéro garde son identifiant** d'un enregistrement à
 * l'autre.
 *
 * La recomposition supprimait puis recréait tout. Deux conséquences vues en production le
 * 2 septembre 2026 : les identifiants changeaient sous les autres utilisateurs — un artiste en
 * train de saisir ses besoins techniques voyait sa ligne disparaître — et le `deleteMany`
 * verrouillait toutes les lignes du spectacle le temps de la transaction, jusqu'à faire expirer
 * l'attente de cet artiste (`Lock wait timeout exceeded`, erreur 500).
 */

/** Client Prisma simulé : on n'observe que ce qui est demandé à la base. */
const clientSimule = (actsExistants: { id: number }[] = []) => {
  const appels: string[] = []
  let prochainId = 100
  return {
    appels,
    client: {
      showAct: {
        findMany: async () => actsExistants,
        update: async ({ where, data }: any) => {
          appels.push(`update:${where.id}:${data.title}:pos${data.position}`)
          return { id: where.id }
        },
        create: async ({ data }: any) => {
          const id = prochainId++
          appels.push(`create:${id}:${data.title}:pos${data.position}`)
          return { id }
        },
        deleteMany: async ({ where }: any) => {
          appels.push(`deleteActs:${JSON.stringify(where.id ?? 'tous')}`)
          return { count: 0 }
        },
      },
      showArtist: {
        deleteMany: async () => ({ count: 0 }),
        createMany: async ({ data }: any) => {
          appels.push(`liens:${data.map((d: any) => `${d.actId}-${d.artistId}`).join(',')}`)
          return { count: data.length }
        },
      },
    } as any,
  }
}

const numero = (titre: string, extra: Record<string, unknown> = {}) => ({
  title: titre,
  artistIds: [],
  ...extra,
})

describe('replaceShowComposition — numéros de cabaret', () => {
  it('met à jour un numéro existant au lieu de le remplacer', async () => {
    const { client, appels } = clientSimule([{ id: 7 }])

    await replaceShowComposition(client, 1, 'CABARET', [], [numero('Jonglerie', { id: 7 })])

    // L'identifiant 7 survit : c'est tout l'objet du correctif.
    expect(appels).toContain('update:7:Jonglerie:pos0')
    expect(appels.some((a) => a.startsWith('create:'))).toBe(false)
  })

  it('crée les numéros sans identifiant, et garde l’ordre du tableau', async () => {
    const { client, appels } = clientSimule([{ id: 7 }])

    await replaceShowComposition(
      client,
      1,
      'CABARET',
      [],
      [numero('Ouverture'), numero('Jonglerie', { id: 7 })]
    )

    expect(appels).toContain('create:100:Ouverture:pos0')
    expect(appels).toContain('update:7:Jonglerie:pos1')
  })

  it('traite comme nouveau un identifiant qui n’appartient pas au spectacle', async () => {
    // Sans cette garde, il suffirait d'inventer un identifiant pour réécrire le numéro d'un
    // autre spectacle.
    const { client, appels } = clientSimule([{ id: 7 }])

    await replaceShowComposition(client, 1, 'CABARET', [], [numero('Intrus', { id: 999 })])

    expect(appels).toContain('create:100:Intrus:pos0')
    expect(appels.some((a) => a.startsWith('update:'))).toBe(false)
  })

  it('supprime les numéros que le client ne renvoie plus', async () => {
    const { client, appels } = clientSimule([{ id: 7 }, { id: 8 }])

    await replaceShowComposition(client, 1, 'CABARET', [], [numero('Jonglerie', { id: 7 })])

    expect(appels).toContain('deleteActs:{"notIn":[7]}')
  })

  it('supprime tous les numéros quand il n’en reste aucun', async () => {
    const { client, appels } = clientSimule([{ id: 7 }])

    await replaceShowComposition(client, 1, 'CABARET', [], [])

    // `notIn: []` correspondrait à toutes les lignes : la requête doit être sans condition d'id.
    expect(appels).toContain('deleteActs:"tous"')
  })

  it('rattache les artistes au numéro conservé', async () => {
    const { client, appels } = clientSimule([{ id: 7 }])

    await replaceShowComposition(
      client,
      1,
      'CABARET',
      [],
      [{ title: 'Duo', artistIds: [3, 4, 3], id: 7 }]
    )

    // Les doublons sont écartés, et le lien porte l'identifiant conservé.
    expect(appels).toContain('liens:7-3,7-4')
  })
})

describe('replaceShowComposition — spectacle standard', () => {
  it('efface les numéros d’un ancien cabaret', async () => {
    const { client, appels } = clientSimule([{ id: 7 }])

    await replaceShowComposition(client, 1, 'STANDARD', [5], [])

    expect(appels).toContain('deleteActs:"tous"')
    expect(appels).toContain('liens:undefined-5')
  })
})
