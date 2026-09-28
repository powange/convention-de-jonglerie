import bcrypt from 'bcryptjs'
import { describe, it, expect, beforeEach } from 'vitest'

import { compterNonLusParConversation } from '../../server/utils/messenger-unread-service'
import { getEmailHash } from '../../server/utils/email-hash'
import { prismaTest } from '../setup-db'

/**
 * Le comptage des non-lus, sur une VRAIE base.
 *
 * C'est le seul test qui vaille pour cette fonction : elle est écrite en SQL à la main, parce que
 * Prisma ne sait pas grouper un `count` par relation. Un mock de `$queryRaw` rend ce qu'on lui
 * donne — il ne l'exécute pas, donc il ne dirait rien d'une faute de jointure, d'un nom de colonne
 * erroné ou d'une condition inversée. Les cas unitaires, dans
 * `test/nuxt/server/utils/messenger-non-lus.test.ts`, ne couvrent que la plomberie autour.
 *
 * Chaque cas ci-dessous correspond à une condition du SQL. Retirez-en une, un test tombe.
 *
 * Ne s'exécute que si TEST_WITH_DB=true — et JAMAIS dans le conteneur de développement, où
 * `DATABASE_URL` désigne la base de travail et où le nettoyage global la viderait.
 */
describe.skipIf(!process.env.TEST_WITH_DB)('comptage des non-lus avec DB réelle', () => {
  let lecteur: { id: number }
  let auteur: { id: number }
  let conversationId: string
  let participationLecteur: { id: string }
  let participationAuteur: { id: string }

  const creerUtilisateur = async (prefixe: string) => {
    const email = `${prefixe}-${Date.now()}-${Math.random()}@example.com`
    return prismaTest.user.create({
      data: {
        email,
        emailHash: getEmailHash(email),
        password: await bcrypt.hash('Password123!', 10),
        pseudo: `${prefixe}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        isEmailVerified: true,
      },
      select: { id: true },
    })
  }

  /** Un message envoyé par `participantId`, daté, éventuellement supprimé. */
  const ecrire = (participantId: string, createdAt: Date, deletedAt: Date | null = null) =>
    prismaTest.message.create({
      data: { conversationId, participantId, content: 'Bonjour', createdAt, deletedAt },
    })

  beforeEach(async () => {
    lecteur = await creerUtilisateur('lecteur')
    auteur = await creerUtilisateur('auteur')

    // La conversation est rattachée à une édition : c'est ce qui la fait disparaître avec elle au
    // nettoyage global. Une conversation PRIVATE, dont `editionId` est NULL, y survivrait.
    const edition = await prismaTest.edition.create({
      data: {
        event: { create: {} },
        name: `Edition non-lus ${Date.now()}`,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-03'),
        addressLine1: '1 rue du Test',
        city: 'Paris',
        country: 'France',
        postalCode: '75001',
        creator: { connect: { id: lecteur.id } },
        convention: {
          create: {
            name: `Convention non-lus ${Date.now()}`,
            author: { connect: { id: lecteur.id } },
          },
        },
      },
      select: { id: true },
    })

    const conversation = await prismaTest.conversation.create({
      data: {
        editionId: edition.id,
        type: 'ORGANIZERS_GROUP',
        participants: { create: [{ userId: lecteur.id }, { userId: auteur.id }] },
      },
      include: { participants: true },
    })

    conversationId = conversation.id
    participationLecteur = conversation.participants.find((p) => p.userId === lecteur.id)!
    participationAuteur = conversation.participants.find((p) => p.userId === auteur.id)!
  })

  it('compte les messages des autres quand rien n’a été lu', async () => {
    // `lastReadAt` est NULL : le COALESCE à 1970 doit tout laisser passer.
    await ecrire(participationAuteur.id, new Date('2026-01-01T10:00:00Z'))
    await ecrire(participationAuteur.id, new Date('2026-01-01T11:00:00Z'))

    const carte = await compterNonLusParConversation(lecteur.id)

    expect(carte.get(conversationId)).toBe(2)
  })

  it('ne compte pas les messages de l’utilisateur lui-même', async () => {
    await ecrire(participationLecteur.id, new Date('2026-01-01T10:00:00Z'))
    await ecrire(participationAuteur.id, new Date('2026-01-01T11:00:00Z'))

    const carte = await compterNonLusParConversation(lecteur.id)

    // C'est la condition `m.participantId <> cp.id`. Elle repose sur le fait qu'un utilisateur n'a
    // qu'UNE ligne de participation par conversation (`@@unique([conversationId, userId])`).
    expect(carte.get(conversationId)).toBe(1)
  })

  it('ne compte pas un message supprimé', async () => {
    await ecrire(participationAuteur.id, new Date('2026-01-01T10:00:00Z'), new Date())
    await ecrire(participationAuteur.id, new Date('2026-01-01T11:00:00Z'))

    const carte = await compterNonLusParConversation(lecteur.id)

    expect(carte.get(conversationId)).toBe(1)
  })

  it('ne compte que ce qui suit la date de dernière lecture', async () => {
    await ecrire(participationAuteur.id, new Date('2026-01-01T09:00:00Z'))
    await ecrire(participationAuteur.id, new Date('2026-01-01T12:00:00Z'))
    await prismaTest.conversationParticipant.update({
      where: { id: participationLecteur.id },
      data: { lastReadAt: new Date('2026-01-01T10:00:00Z') },
    })

    const carte = await compterNonLusParConversation(lecteur.id)

    expect(carte.get(conversationId)).toBe(1)
  })

  it('n’inscrit pas une conversation entièrement lue', async () => {
    await ecrire(participationAuteur.id, new Date('2026-01-01T09:00:00Z'))
    await prismaTest.conversationParticipant.update({
      where: { id: participationLecteur.id },
      data: { lastReadAt: new Date('2026-01-01T10:00:00Z') },
    })

    const carte = await compterNonLusParConversation(lecteur.id)

    // Absente, puisque c'est une jointure et non une jointure externe. L'absence vaut zéro, et les
    // appelants doivent compter les conversations autrement — ce qu'ils font.
    expect(carte.has(conversationId)).toBe(false)
  })

  it('ignore une conversation que l’utilisateur a quittée', async () => {
    await ecrire(participationAuteur.id, new Date('2026-01-01T10:00:00Z'))
    await prismaTest.conversationParticipant.update({
      where: { id: participationLecteur.id },
      data: { leftAt: new Date() },
    })

    const carte = await compterNonLusParConversation(lecteur.id)

    expect(carte.has(conversationId)).toBe(false)
  })

  it('sépare bien deux conversations', async () => {
    await ecrire(participationAuteur.id, new Date('2026-01-01T10:00:00Z'))

    const autre = await prismaTest.conversation.create({
      data: {
        type: 'PRIVATE',
        participants: { create: [{ userId: lecteur.id }, { userId: auteur.id }] },
      },
      include: { participants: true },
    })
    const auteurAilleurs = autre.participants.find((p) => p.userId === auteur.id)!
    for (const heure of ['08:00:00', '09:00:00', '10:00:00']) {
      await prismaTest.message.create({
        data: {
          conversationId: autre.id,
          participantId: auteurAilleurs.id,
          content: 'Ailleurs',
          createdAt: new Date(`2026-01-02T${heure}Z`),
        },
      })
    }

    const carte = await compterNonLusParConversation(lecteur.id)

    expect(carte.get(conversationId)).toBe(1)
    expect(carte.get(autre.id)).toBe(3)

    // Cette conversation-là n'est rattachée à aucune édition : le nettoyage global ne l'emporterait
    // pas, on la retire donc soi-même.
    await prismaTest.conversation.delete({ where: { id: autre.id } })
  })

  it('ne compte rien pour un utilisateur étranger à la conversation', async () => {
    await ecrire(participationAuteur.id, new Date('2026-01-01T10:00:00Z'))
    const etranger = await creerUtilisateur('etranger')

    const carte = await compterNonLusParConversation(etranger.id)

    expect(carte.size).toBe(0)
  })
})
