import { describe, it, expect, vi, beforeEach } from 'vitest'

import { updateUserInfo } from '../../../../../../server/utils/editions/ticketing/user-info-update'

const prismaMock = (globalThis as any).prisma

/**
 * La réécriture des informations d'un compte depuis le guichet.
 *
 * Ce chemin existe pour rattraper la faute de frappe d'un artiste, d'un organisateur ou d'un
 * bénévole **ajouté à la main** : son compte vient d'être créé et n'a jamais servi. Il n'a jamais
 * servi à changer l'adresse de quelqu'un qui utilise déjà la sienne — et le laisser faire ouvrait
 * une prise de compte, puisque la réinitialisation de mot de passe envoie son lien à l'adresse
 * inscrite sans rien exiger de plus. Le point d'API appelant est ouvert aux bénévoles en créneau
 * de contrôle d'accès.
 *
 * Le test qui compte le plus n'est pourtant pas celui du refus : c'est celui de l'adresse
 * INCHANGÉE. L'écran pré-remplit ce champ et l'envoie à chaque validation d'entrée. Refuser sur
 * la seule présence de l'adresse bloquerait l'entrée de toute personne au compte vérifié,
 * c'est-à-dire la file entière — une correction de sécurité qui casse le guichet le jour J.
 */
describe('updateUserInfo', () => {
  const NON_VERIFIE = { id: 7, email: 'alicee@exemple.fr', isEmailVerified: false }
  const VERIFIE = { id: 8, email: 'bob@exemple.fr', isEmailVerified: true }

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 })
  })

  it('corrige l’adresse d’un compte NON vérifié', async () => {
    prismaMock.user.findMany.mockResolvedValue([NON_VERIFIE])

    await updateUserInfo([7], { email: 'alice@exemple.fr' })

    const ecriture = prismaMock.user.updateMany.mock.calls[0]![0]
    expect(ecriture.data.email).toBe('alice@exemple.fr')
  })

  it('recalcule l’empreinte du gravatar avec l’adresse', async () => {
    // Ce chemin ne la recalculait pas, contrairement à profile/update.put.ts : l'avatar
    // continuait d'afficher celui de l'adresse fautive, sans que rien ne le signale.
    prismaMock.user.findMany.mockResolvedValue([NON_VERIFIE])

    await updateUserInfo([7], { email: 'alice@exemple.fr' })

    const ecriture = prismaMock.user.updateMany.mock.calls[0]![0]
    expect(ecriture.data.emailHash).toBeTruthy()
    expect(ecriture.data.emailHash).not.toBe('alice@exemple.fr')
  })

  it('REFUSE de réécrire l’adresse d’un compte vérifié', async () => {
    // Le compte appartient à quelqu'un ; le réécrire permettrait d'en demander la
    // réinitialisation du mot de passe, donc de le prendre.
    prismaMock.user.findMany.mockResolvedValue([VERIFIE])

    await expect(updateUserInfo([8], { email: 'pirate@exemple.fr' })).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
  })

  it('laisse passer une validation d’entrée ordinaire sur un compte vérifié', async () => {
    // L'écran renvoie l'adresse déjà enregistrée à CHAQUE validation. Si ce cas échouait, plus
    // personne au compte vérifié ne pourrait entrer.
    prismaMock.user.findMany.mockResolvedValue([VERIFIE])

    await updateUserInfo([8], {
      firstName: 'Bob',
      lastName: 'Martin',
      email: 'bob@exemple.fr',
      phone: '0600000000',
    })

    const ecriture = prismaMock.user.updateMany.mock.calls[0]![0]
    expect(ecriture.data.prenom).toBe('Bob')
    // Le nom et le téléphone passent ; l'adresse n'est simplement pas réécrite.
    expect(ecriture.data).not.toHaveProperty('email')
    expect(ecriture.data).not.toHaveProperty('emailHash')
  })

  it('ne se laisse pas tromper par la casse ni les espaces', async () => {
    prismaMock.user.findMany.mockResolvedValue([VERIFIE])

    await updateUserInfo([8], { email: '  BOB@Exemple.FR ' })

    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
  })

  it('ne cherche PAS de doublon quand rien ne change', async () => {
    // Sinon, renvoyer sa propre adresse déclenchait une requête d'unicité inutile — et, avec un
    // homonyme mal filtré, un 409 sur une validation que personne n'avait demandée.
    prismaMock.user.findMany.mockResolvedValue([VERIFIE])

    await updateUserInfo([8], { email: 'bob@exemple.fr' })

    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })

  it('refuse toujours une adresse déjà prise par quelqu’un d’autre', async () => {
    prismaMock.user.findMany.mockResolvedValue([NON_VERIFIE])
    prismaMock.user.findFirst.mockResolvedValue({ id: 99 })

    await expect(updateUserInfo([7], { email: 'occupe@exemple.fr' })).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('bloque le lot entier si UN seul compte visé est vérifié', async () => {
    // Une écriture partielle serait pire : on ne saurait plus qui a été modifié.
    prismaMock.user.findMany.mockResolvedValue([NON_VERIFIE, VERIFIE])

    await expect(updateUserInfo([7, 8], { email: 'autre@exemple.fr' })).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
  })

  it('ne touche à rien quand le bloc est vide', async () => {
    await updateUserInfo([7], {})
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
  })
})
