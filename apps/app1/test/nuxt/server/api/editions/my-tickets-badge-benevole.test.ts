import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 3, email: 'alex@example.com' })),
}))

import handler from '../../../../../server/api/editions/[id]/my-tickets.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

/**
 * Le badge de bénévole n'est émis que pour qui est PRÉSENT pendant l'événement.
 *
 * ⚠️ CE QUI N'ALLAIT PAS, et pourquoi c'était visible par la personne concernée. Ce point d'API ne
 * filtrait que sur `status: 'ACCEPTED'`. Un bénévole qui a explicitement répondu qu'il n'était pas
 * là pendant l'événement — montage seul, démontage seul — recevait donc un badge dans « mes
 * billets », avec son QR code.
 *
 * Et le guichet le REFUSAIT au scan : `ticketing/verify.post.ts` appliquait bien la condition. Les
 * deux surfaces répondaient à la même question et se contredisaient. La personne se présente avec
 * un billet que l'application lui a donné, et s'entend dire qu'il n'est pas valable — devant la
 * file.
 *
 * 🔬 LE TEST QUI COMPTE EST CELUI SUR LA FORME DE LA REQUÊTE. Le mock de Prisma IGNORE le `where` :
 * un test qui rend `null` au `findFirst` et constate l'absence de badge resterait VERT même si la
 * condition disparaissait du code. Seule une assertion sur le `where` voit le défaut.
 */

const EDITION = 42

const evenement = { context: { params: { id: String(EDITION) }, user: { id: 3 } } } as any

const candidature = {
  id: 11,
  qrCodeToken: 'jeton-secret',
  user: { prenom: 'Alex', nom: 'Martin', email: 'alex@example.com' },
}

describe('GET /api/editions/[id]/my-tickets — badge de bénévole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.validateEditionId = vi.fn(() => EDITION) as any
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(candidature)
    prismaMock.editionArtist.findFirst.mockResolvedValue(null)
    prismaMock.editionOrganizer.findFirst.mockResolvedValue(null)
  })

  it('exige la PRÉSENCE SUR PLACE dans la requête', async () => {
    /*
     * L'assertion centrale. Le `where` doit porter le `OR` de `benevolePresentSurPlace` :
     * `eventAvailability` à `true` (a dit oui) ou `null` (la colonne a été ajoutée après coup,
     * personne ne lui a posé la question), ou une présence au montage ou au démontage.
     *
     * ⚠️ LE MONTAGE ET LE DÉMONTAGE ONT ÉTÉ AJOUTÉS, et c'est le même élargissement que pour le
     * contrôle d'accès : un bénévole qui n'est là qu'au montage est sur place, il lui faut donc un
     * badge. Le laisser hors de cette requête recréerait la contradiction que ce fichier existe
     * pour interdire — un badge refusé au guichet, ou un guichet qui accepte quelqu'un sans badge.
     *
     * `false` partout reste le seul cas exclu.
     */
    await handler(evenement)

    const où = prismaMock.editionVolunteerApplication.findFirst.mock.calls[0][0].where

    expect(où.eventId).toBe(EDITION)
    expect(où.status).toBe('ACCEPTED')
    expect(où.OR).toEqual([
      { eventAvailability: true },
      { eventAvailability: null },
      { setupAvailability: true },
      { teardownAvailability: true },
    ])
  })

  it('n’émet AUCUN badge quand la candidature ne correspond pas', async () => {
    /*
     * Le pendant du précédent : la requête ne trouve rien, donc rien n'est émis. Ce test-ci ne
     * prouve PAS que la condition existe — le mock ignore le `where` — mais il prouve que
     * l'absence de candidature est traitée sans produire de badge fantôme.
     */
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(null)

    const { tickets: billets } = (await handler(evenement)) as any

    expect(billets.some((b: any) => b.type === 'volunteer')).toBe(false)
  })

  it('émet le badge d’un bénévole présent', async () => {
    // La non-régression : le cas normal doit continuer de produire un badge avec son QR code.
    const { tickets: billets } = (await handler(evenement)) as any

    const badge = billets.find((b: any) => b.type === 'volunteer')
    expect(badge).toBeTruthy()
    expect(badge.qrCode).toBe('volunteer-11-jeton-secret')
  })

  it('n’émet pas de QR code sans jeton', async () => {
    /*
     * Comportement existant, conservé et désormais verrouillé : un code sans jeton n'est plus
     * accepté au guichet, et l'émettre n'enverrait la personne au comptoir que pour s'y voir
     * refuser — exactement le défaut que ce lot corrige, sous une autre forme.
     */
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({
      ...candidature,
      qrCodeToken: null,
    })

    const { tickets: billets } = (await handler(evenement)) as any

    expect(billets.find((b: any) => b.type === 'volunteer')?.qrCode).toBeNull()
  })
})
