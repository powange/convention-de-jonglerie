import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createDefaultVolunteerPorts } from '../../../../../server/volunteers/ports/default-binding'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

// Construit un orderItem mock minimal
const orderItem = (
  id: number,
  over: Partial<{
    lastName: string | null
    firstName: string | null
    email: string | null
    customFields: unknown
    order: {
      payerLastName: string | null
      payerFirstName: string | null
      payerEmail: string | null
    }
  }> = {}
) => ({
  id,
  lastName: over.lastName ?? `Nom${id}`,
  firstName: over.firstName ?? `Prenom${id}`,
  email: over.email ?? `u${id}@x.fr`,
  // ⚠️ Le fabricant ne RENDAIT pas ce champ, seulement son type : mon premier essai passait
  // `customFields` et le participant ressortait sans — le port lisait `undefined`, et j'ai
  // d'abord accusé le port. Un fabricant de jeu d'essai qui ignore un champ en silence fait
  // échouer le test loin de sa cause.
  customFields: over.customFields ?? null,
  order: over.order ?? {
    payerLastName: `Payeur${id}`,
    payerFirstName: `P${id}`,
    payerEmail: `payeur${id}@x.fr`,
  },
})

describe('port ticketing (câblage jonglerie par défaut)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getMealTicketParticipants', () => {
    it('agrège tarifs + options et déduplique par orderItem', async () => {
      prismaMock.volunteerMeal.findMany.mockResolvedValue([
        {
          id: 1,
          tiers: [{ tier: { orderItems: [orderItem(100), orderItem(101)] } }],
          options: [
            {
              option: {
                orderItemSelections: [
                  { orderItem: orderItem(100) }, // doublon du tarif → ignoré
                  { orderItem: orderItem(102) },
                  { orderItem: null }, // null → ignoré
                ],
              },
            },
          ],
        },
      ])

      const result = await createDefaultVolunteerPorts().ticketing.getMealTicketParticipants([1])

      expect(result[1]).toHaveLength(3)
      expect(result[1].map((p) => p.email)).toEqual(['u100@x.fr', 'u101@x.fr', 'u102@x.fr'])
      expect(prismaMock.volunteerMeal.findMany).toHaveBeenCalledTimes(1)
    })

    /**
     * Le régime et les allergies déclarés à la commande — constat B5.
     *
     * ## ⚠️ POURQUOI CELA COMPTE PLUS QU'UN CHAMP MANQUANT
     *
     * Ce port alimente la **fiche de restauration PDF**, celle qu'on imprime et qu'on emporte en
     * cuisine. Sans ces champs, elle comptait **tous** les billets comme « sans régime », et sa
     * section Allergies — qui existe, dixit l'en-tête de `restauration-pdf.ts`, pour éviter
     * d'envoyer quelqu'un à l'hôpital — **omettait les allergies déclarées à la commande**.
     *
     * 📍 Le port du layer `meals` les lisait DÉJÀ : la liste à l'écran les affichait et les
     * comptait. Deux ports répondaient à la même question, et **le plus silencieux était celui
     * qu'on emporte en cuisine**.
     */
    it('⚠️ REMONTE LE RÉGIME ET LES ALLERGIES des champs personnalisés', async () => {
      prismaMock.volunteerMeal.findMany.mockResolvedValue([
        {
          id: 5,
          tiers: [
            {
              tier: {
                orderItems: [
                  orderItem(300, {
                    customFields: {
                      dietaryPreference: 'VEGAN',
                      allergies: 'arachide',
                      allergySeverity: 'CRITICAL',
                    },
                  }),
                ],
              },
            },
          ],
          options: [],
        },
      ])

      const result = await createDefaultVolunteerPorts().ticketing.getMealTicketParticipants([5])

      expect(result[5]![0]).toMatchObject({
        dietaryPreference: 'VEGAN',
        allergies: 'arachide',
        allergySeverity: 'CRITICAL',
      })
    })

    it('⚠️ DEMANDE BIEN `customFields` À LA BASE', async () => {
      /*
       * 🔬 L'ASSERTION NON CREUSE. Le bouchon central IGNORE le `select` : le cas ci-dessus
       * resterait VERT si la requête cessait de demander `customFields`, puisque le mock rend ce
       * qu'on lui dit quoi qu'on demande. En production, le champ vaudrait `undefined` et la
       * cuisine retrouverait sa fiche muette — sans qu'aucune erreur ne le dise.
       */
      prismaMock.volunteerMeal.findMany.mockResolvedValue([])

      await createDefaultVolunteerPorts().ticketing.getMealTicketParticipants([5])

      const demande = prismaMock.volunteerMeal.findMany.mock.calls[0]![0]
      const selectDesLignes = demande.select.tiers.select.tier.select.orderItems.select
      expect(selectDesLignes.customFields).toBe(true)
    })

    it('tolère un `customFields` qui n’est pas un objet', async () => {
      /*
       * C'est une colonne **JSON** : rien ne garantit sa forme. Un tableau y est possible, et
       * `(valeur as Record)?.allergies` rendrait alors `undefined` **en silence** là où l'on croit
       * lire un objet. Une chaîne vide ne doit pas non plus passer pour une allergie déclarée —
       * la section du PDF listerait un nom sans rien à côté.
       */
      prismaMock.volunteerMeal.findMany.mockResolvedValue([
        {
          id: 6,
          tiers: [
            {
              tier: {
                orderItems: [
                  orderItem(400, { customFields: ['pas', 'un', 'objet'] }),
                  orderItem(401, { customFields: null }),
                  orderItem(402, { customFields: { allergies: '' } }),
                ],
              },
            },
          ],
          options: [],
        },
      ])

      const result = await createDefaultVolunteerPorts().ticketing.getMealTicketParticipants([6])

      for (const participant of result[6]!) {
        expect(participant.dietaryPreference).toBeNull()
        expect(participant.allergies).toBeNull()
        expect(participant.allergySeverity).toBeNull()
      }
    })

    it('retombe sur le payeur de la commande si les champs orderItem sont nuls', async () => {
      prismaMock.volunteerMeal.findMany.mockResolvedValue([
        {
          id: 2,
          tiers: [
            {
              tier: {
                orderItems: [
                  {
                    id: 200,
                    lastName: null,
                    firstName: null,
                    email: null,
                    order: {
                      payerLastName: 'Dupont',
                      payerFirstName: 'Marie',
                      payerEmail: 'marie@x.fr',
                    },
                  },
                ],
              },
            },
          ],
          options: [],
        },
      ])

      const result = await createDefaultVolunteerPorts().ticketing.getMealTicketParticipants([2])

      /*
       * `toEqual` et non `toMatchObject` : le repli sur le payeur est le sujet du cas, et une
       * égalité STRICTE dit aussi qu'aucun champ ne se glisse en plus. Les trois champs de régime
       * y figurent donc explicitement — à `null`, ce qui est juste : un billet dont la ligne n'a
       * pas de `customFields` ne déclare ni régime ni allergie.
       */
      expect(result[2]).toEqual([
        {
          nom: 'Dupont',
          prenom: 'Marie',
          email: 'marie@x.fr',
          dietaryPreference: null,
          allergies: null,
          allergySeverity: null,
        },
      ])
    })

    it('court-circuite sans requête pour une liste vide', async () => {
      const result = await createDefaultVolunteerPorts().ticketing.getMealTicketParticipants([])

      expect(result).toEqual({})
      expect(prismaMock.volunteerMeal.findMany).not.toHaveBeenCalled()
    })
  })

  describe('getHandoutItems', () => {
    it('mappe le catalogue par id (id + name)', async () => {
      prismaMock.ticketingHandoutItem.findMany.mockResolvedValue([
        { id: 5, name: 'T-shirt' },
        { id: 6, name: 'Badge' },
      ])

      const result = await createDefaultVolunteerPorts().ticketing.getHandoutItems([5, 6])

      expect(result).toEqual({
        5: { id: 5, name: 'T-shirt' },
        6: { id: 6, name: 'Badge' },
      })
      expect(prismaMock.ticketingHandoutItem.findMany).toHaveBeenCalledWith({
        where: { id: { in: [5, 6] } },
        select: { id: true, name: true },
      })
    })

    it('court-circuite sans requête pour une liste vide', async () => {
      const result = await createDefaultVolunteerPorts().ticketing.getHandoutItems([])

      expect(result).toEqual({})
      expect(prismaMock.ticketingHandoutItem.findMany).not.toHaveBeenCalled()
    })
  })
})
