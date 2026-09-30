import { describe, it, expect, beforeEach, vi } from 'vitest'

const limiteurCode = vi.hoisted(() => vi.fn(async () => undefined))
const limiteurCourriel = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('../../../../../server/utils/rate-limiter', () => ({
  verificationCodeRateLimiter: limiteurCode,
  emailRateLimiter: limiteurCourriel,
}))

vi.mock('../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 7, pseudo: 'demandeur', prenom: 'Dé' })),
}))

vi.mock('../../../../../server/utils/emailService', () => ({
  sendEmail: vi.fn(async () => true),
}))

import verifier from '../../../../../server/api/conventions/[id]/claim/verify.post'
import demander from '../../../../../server/api/conventions/[id]/claim.post'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * La revendication d'une convention : limiteurs et compteur d'échecs.
 *
 * ⚠️ CE QUE CE FLUX PORTE. Revendiquer une convention en transfère la propriété, ainsi que celle de
 * toutes ses éditions. La seule preuve exigée est un code à SIX CHIFFRES, valable une heure, envoyé
 * à l'adresse de contact de la convention.
 *
 * Sans compteur d'échecs, ce code se force : un million de combinaisons, une heure, et un limiteur
 * par IP qu'il suffit de contourner en changeant d'adresse. Le limiteur RALENTIT, il ne FERME pas —
 * c'est pourquoi les deux existent, et pourquoi le compteur est porté par la demande elle-même,
 * donc indépendant de l'origine des essais.
 *
 * ⚠️ Ce point d'API n'avait AUCUN test.
 */

const CONVENTION = 12
const evenement = { context: { params: { id: String(CONVENTION) } } }

const demandeEnBase = (attempts = 0) => ({
  id: 'demande-1',
  conventionId: CONVENTION,
  userId: 7,
  code: '123456',
  attempts,
  expiresAt: new Date(Date.now() + 3600_000),
})

describe('POST /api/conventions/[id]/claim/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.readBody = vi.fn().mockResolvedValue({ code: '123456' })
    global.getRouterParam = vi.fn(() => String(CONVENTION))
    // `verify` lit d'abord la convention (elle doit exister et être sans créateur) : sans ce mock,
    // les cas échouaient sur « Convention non trouvée », avant d'atteindre ce qu'ils éprouvent.
    prismaMock.convention.findUnique.mockResolvedValue({
      id: CONVENTION,
      name: 'EJC',
      authorId: null,
      email: 'contact@ejc.test',
      editions: [],
    })
    prismaMock.conventionClaimRequest.findUnique.mockResolvedValue(demandeEnBase())
    prismaMock.conventionClaimRequest.update.mockResolvedValue({ attempts: 1 })
    prismaMock.conventionClaimRequest.delete.mockResolvedValue({})
    prismaMock.convention.update.mockResolvedValue({ id: CONVENTION, name: 'EJC' })
    prismaMock.edition.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.$transaction.mockImplementation(async (travail: any) =>
      typeof travail === 'function' ? travail(prismaMock) : travail
    )
  })

  it('passe par le limiteur AVANT de lire quoi que ce soit', async () => {
    // L'ordre compte : un limiteur appelé après la lecture laisse chaque tentative coûter une
    // requête, et c'est précisément le forçage qu'on cherche à rendre coûteux.
    global.readBody = vi.fn().mockResolvedValue({ code: '000000' })

    await verifier(evenement as any).catch(() => undefined)

    expect(limiteurCode).toHaveBeenCalled()
    const rangLimiteur = limiteurCode.mock.invocationCallOrder[0]!
    // La PREMIÈRE lecture en base est celle de la convention : c'est à elle qu'on se compare, et
    // non à la demande de revendication, qui vient après.
    const rangLecture = prismaMock.convention.findUnique.mock.invocationCallOrder[0]!
    expect(rangLimiteur).toBeLessThan(rangLecture)
  })

  it('compte un code faux', async () => {
    global.readBody = vi.fn().mockResolvedValue({ code: '000000' })
    prismaMock.conventionClaimRequest.update.mockResolvedValue({ attempts: 1 })

    await expect(verifier(evenement as any)).rejects.toMatchObject({
      status: 400,
      message: 'Code de vérification incorrect',
    })

    expect(prismaMock.conventionClaimRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { attempts: { increment: 1 } } })
    )
    // La convention n'a évidemment pas changé de main.
    expect(prismaMock.convention.update).not.toHaveBeenCalled()
  })

  it('SUPPRIME la demande au cinquième échec', async () => {
    /*
     * Cinq, et pas six : `attempts` vaut 4 avant cet essai, l'incrément le porte à 5. Le décalage
     * d'un cran est ici l'erreur la plus facile — elle donnerait un essai gratuit de plus, ou en
     * retirerait un à qui n'a rien fait de mal.
     */
    global.readBody = vi.fn().mockResolvedValue({ code: '000000' })
    prismaMock.conventionClaimRequest.findUnique.mockResolvedValue(demandeEnBase(4))
    prismaMock.conventionClaimRequest.update.mockResolvedValue({ attempts: 5 })

    await expect(verifier(evenement as any)).rejects.toMatchObject({
      status: 400,
      message: 'Trop d’essais, redemandez un code',
    })

    expect(prismaMock.conventionClaimRequest.delete).toHaveBeenCalledWith({
      where: { id: 'demande-1' },
    })
  })

  it('tolère encore le quatrième échec', async () => {
    // La borne par l'autre côté : refuser au quatrième détruirait la demande d'un cran trop tôt.
    global.readBody = vi.fn().mockResolvedValue({ code: '000000' })
    prismaMock.conventionClaimRequest.findUnique.mockResolvedValue(demandeEnBase(3))
    prismaMock.conventionClaimRequest.update.mockResolvedValue({ attempts: 4 })

    await expect(verifier(evenement as any)).rejects.toMatchObject({
      message: 'Code de vérification incorrect',
    })

    expect(prismaMock.conventionClaimRequest.delete).not.toHaveBeenCalled()
  })

  it('relit le compteur DEPUIS LA BASE, sans se fier à ce qu’il avait lu', async () => {
    /*
     * Deux essais simultanés partiraient sinon de la même lecture et incrémenteraient tous deux à
     * 1 : le cinquième n'arriverait jamais. La valeur décisive est celle que rend l'`update`.
     */
    global.readBody = vi.fn().mockResolvedValue({ code: '000000' })
    prismaMock.conventionClaimRequest.findUnique.mockResolvedValue(demandeEnBase(0))
    // La base a bougé entre-temps : quelqu'un d'autre a déjà consommé les essais.
    prismaMock.conventionClaimRequest.update.mockResolvedValue({ attempts: 5 })

    await expect(verifier(evenement as any)).rejects.toMatchObject({
      message: 'Trop d’essais, redemandez un code',
    })
  })

  it('transfère la convention sur le bon code', async () => {
    const reponse: any = await verifier(evenement as any)

    expect(prismaMock.convention.update).toHaveBeenCalledWith({
      where: { id: CONVENTION },
      data: { authorId: 7 },
    })
    // Les éditions suivent : une convention revendiquée sans ses éditions laisserait leur créateur
    // d'origine seul à pouvoir les modifier.
    expect(prismaMock.edition.updateMany).toHaveBeenCalledWith({
      where: { conventionId: CONVENTION },
      data: { creatorId: 7 },
    })
    expect(reponse.success).toBe(true)
  })

  it('n’incrémente rien quand le code a expiré', async () => {
    // Un code périmé n'est pas un essai raté : le compter laisserait quelqu'un épuiser sa demande
    // en rechargeant une page ouverte depuis une heure.
    prismaMock.conventionClaimRequest.findUnique.mockResolvedValue({
      ...demandeEnBase(),
      expiresAt: new Date(Date.now() - 1000),
    })

    await expect(verifier(evenement as any)).rejects.toMatchObject({ status: 400 })
    expect(prismaMock.conventionClaimRequest.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/conventions/[id]/claim', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.getRouterParam = vi.fn(() => String(CONVENTION))
    prismaMock.convention.findUnique.mockResolvedValue({
      id: CONVENTION,
      name: 'EJC',
      authorId: null,
      email: 'contact@ejc.test',
    })
    prismaMock.conventionClaimRequest.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.conventionClaimRequest.upsert.mockResolvedValue({})
  })

  it('passe par le limiteur de courriel avant tout', async () => {
    /*
     * Chaque appel envoie un courriel à l'adresse de contact de la convention, qui n'appartient pas
     * à celui qui demande. Sans limite, on pouvait inonder une convention en rejouant ce point
     * d'API — et cette adresse est justement son moyen de se revendiquer.
     */
    await demander(evenement as any)

    expect(limiteurCourriel).toHaveBeenCalled()
    const rangLimiteur = limiteurCourriel.mock.invocationCallOrder[0]!
    const rangLecture = prismaMock.convention.findUnique.mock.invocationCallOrder[0]!
    expect(rangLimiteur).toBeLessThan(rangLecture)
  })

  it('remet le compteur d’essais à zéro avec le nouveau code', async () => {
    // Sans cela, redemander un code après cinq échecs ne servirait à rien — c'est pourtant ce que
    // le message d'erreur invite à faire.
    await demander(evenement as any)

    expect(prismaMock.conventionClaimRequest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ attempts: 0 }),
      })
    )
  })

  it('tire un code à six chiffres', async () => {
    await demander(evenement as any)

    const appel = prismaMock.conventionClaimRequest.upsert.mock.calls[0]![0]
    expect(appel.create.code).toMatch(/^\d{6}$/)
    expect(appel.update.code).toMatch(/^\d{6}$/)
  })
})
