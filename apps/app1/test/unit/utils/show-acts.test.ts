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

const EDITION = 42

/**
 * Client Prisma simulé : on n'observe que ce qui est demandé à la base.
 *
 * `artistesDeLEdition` dit quels artistes appartiennent à l'édition du spectacle. Par défaut
 * TOUS ceux qu'on demande y appartiennent — sans quoi les tests existants, qui ne parlent pas
 * d'appartenance, échoueraient sur une vérification qui n'est pas leur sujet.
 */
const clientSimule = (
  actsExistants: { id: number }[] = [],
  artistesDeLEdition: number[] | 'tous' = 'tous'
) => {
  const appels: string[] = []
  let prochainId = 100
  return {
    appels,
    client: {
      show: {
        findUnique: async () => ({ editionId: EDITION }),
      },
      editionArtist: {
        findMany: async ({ where }: any) => {
          appels.push(`artistes:${JSON.stringify(where.id?.in ?? [])}:edition${where.editionId}`)
          const demandes: number[] = where.id?.in ?? []
          return artistesDeLEdition === 'tous'
            ? demandes.map((id) => ({ id }))
            : demandes.filter((id) => artistesDeLEdition.includes(id)).map((id) => ({ id }))
        },
      },
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

/**
 * L'appartenance des artistes à l'édition du spectacle.
 *
 * ⚠️ CE QUI MANQUAIT, et pourquoi c'était exploitable. La composition écrivait les `artistIds`
 * reçus sans vérifier leur édition. Un identifiant d'`EditionArtist` appartenant à une AUTRE
 * convention était donc lié au spectacle — et cet artiste apparaissait ensuite dans la
 * billetterie de cette édition, dans son espace artiste, dans ses feuilles de repas.
 *
 * Rien ne le signalait : l'artiste existe, il a un nom, il a des spectacles. Il n'est simplement
 * pas de cette édition.
 *
 * ⚠️ L'ÉCRITURE EST AUTORISÉE PAR LE DROIT SUR L'ÉDITION, pas par l'appartenance des données.
 * C'est ce qui rendait l'oubli exploitable : quelqu'un qui gère légitimement l'édition 42
 * pouvait y rattacher les artistes de l'édition 17, sans aucun droit sur celle-ci.
 */
describe('replaceShowComposition — appartenance à l’édition', () => {
  it('REFUSE un artiste d’une autre édition, au niveau du spectacle', async () => {
    // Seul l'artiste 5 est de cette édition ; 99 vient d'ailleurs.
    const { client } = clientSimule([], [5])

    await expect(replaceShowComposition(client, 1, 'STANDARD', [5, 99], [])).rejects.toThrow(
      /Artiste inconnu dans cette édition/
    )
  })

  it('REFUSE un artiste d’une autre édition, au niveau d’un NUMÉRO', async () => {
    /*
     * Les deux niveaux comptent, et c'est le piège : un spectacle cabaret porte des artistes par
     * NUMÉRO, et ne vérifier que `artistIds` laisserait la porte grande ouverte par `act.artistIds`.
     */
    const { client } = clientSimule([], [5])

    await expect(
      replaceShowComposition(client, 1, 'CABARET', [], [numero('Jonglerie', { artistIds: [99] })])
    ).rejects.toThrow(/Artiste inconnu dans cette édition/)
  })

  it('n’écrit RIEN quand un artiste est refusé', async () => {
    /*
     * ⚠️ LA VÉRIFICATION PASSE AVANT LE `deleteMany`. Lever après avoir supprimé les liens
     * existants les perdrait pour rien. Les appelants passent par une transaction, mais tous ne le
     * garantissent pas — et compter sur un `rollback` pour réparer un ordre fautif est une dette
     * qu'on finit par payer.
     */
    const { client, appels } = clientSimule([{ id: 7 }], [5])

    await expect(
      replaceShowComposition(
        client,
        1,
        'CABARET',
        [],
        [numero('Jonglerie', { id: 7, artistIds: [99] })]
      )
    ).rejects.toThrow()

    expect(appels.some((a) => a.startsWith('deleteActs:'))).toBe(false)
    expect(appels.some((a) => a.startsWith('update:') || a.startsWith('create:'))).toBe(false)
    expect(appels.some((a) => a.startsWith('liens:'))).toBe(false)
  })

  it('ACCEPTE des artistes de l’édition', async () => {
    // La non-régression : le cas normal doit continuer de passer.
    const { client, appels } = clientSimule([], [5, 6])

    await replaceShowComposition(
      client,
      1,
      'CABARET',
      [],
      [numero('Jonglerie', { artistIds: [5, 6] })]
    )

    expect(appels.some((a) => a.startsWith('liens:'))).toBe(true)
  })

  it('borne la requête d’artistes à L’ÉDITION du spectacle', async () => {
    /*
     * Le test qui tient la garde. Sans `editionId` au `where`, la requête retrouverait TOUS les
     * artistes demandés — le compte coÿnciderait, et la vérification laisserait tout passer en
     * paraissant faite.
     */
    const { client, appels } = clientSimule([], 'tous')

    await replaceShowComposition(client, 1, 'STANDARD', [5], [])

    expect(appels).toContain(`artistes:[5]:edition${EDITION}`)
  })

  it('ne demande RIEN quand aucun artiste n’est lié', async () => {
    // Le cas courant d'un spectacle sans artiste ne doit pas payer une requête pour rien.
    const { client, appels } = clientSimule([], 'tous')

    await replaceShowComposition(client, 1, 'STANDARD', [], [])

    expect(appels.some((a) => a.startsWith('artistes:'))).toBe(false)
  })

  it('dédoublonne avant de vérifier', async () => {
    /*
     * Le même artiste peut figurer au niveau du spectacle ET dans un numéro. Sans dédoublonnage,
     * la requête demanderait deux fois le même identifiant, en recevrait UNE ligne, et le
     * `length !== length` refuserait un artiste parfaitement légitime.
     */
    const { client } = clientSimule([], [5])

    await expect(
      replaceShowComposition(client, 1, 'CABARET', [5], [numero('Jonglerie', { artistIds: [5] })])
    ).resolves.toBeUndefined()
  })
})
