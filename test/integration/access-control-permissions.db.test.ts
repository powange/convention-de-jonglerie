import { describe, it, expect, beforeEach } from 'vitest'

import {
  isActiveAccessControlVolunteer,
  getActiveAccessControlSlot,
} from '../../server/utils/permissions/access-control-permissions'
import { getEmailHash } from '../../server/utils/email-hash'
import { prismaTest } from '../setup-db'

// Ce fichier ne s'exécute que si TEST_WITH_DB=true
describe.skipIf(!process.env.TEST_WITH_DB)('Access Control Permissions', () => {
  let testEdition: any
  let testUser: any
  let testTeam: any
  let testAccessControlTeam: any

  beforeEach(async () => {
    // Créer un utilisateur de test
    const email = `access-control-test-${Date.now()}@test.com`
    testUser = await prismaTest.user.create({
      data: {
        email,
        emailHash: getEmailHash(email),
        pseudo: `AccessControlUser${Date.now()}`,
        password: 'hashedpassword',
        isEmailVerified: true,
      },
    })

    // Créer une convention et une édition
    const convention = await prismaTest.convention.create({
      data: {
        name: 'Convention Test Access Control',
        authorId: testUser.id,
      },
    })

    testEdition = await prismaTest.edition.create({
      data: {
        conventionId: convention.id,
        creatorId: testUser.id,
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-03'),
        addressLine1: '123 Test St',
        city: 'Test City',
        country: 'FR',
        postalCode: '75001',
      },
    })

    // Créer une équipe normale
    testTeam = await prismaTest.volunteerTeam.create({
      data: {
        editionId: testEdition.id,
        name: 'Équipe normale',
        color: '#FF0000',
        isAccessControlTeam: false,
      },
    })

    // Créer une équipe de contrôle d'accès
    testAccessControlTeam = await prismaTest.volunteerTeam.create({
      data: {
        editionId: testEdition.id,
        name: 'Équipe contrôle accès',
        color: '#00FF00',
        isAccessControlTeam: true,
      },
    })

    // Créer une candidature acceptée
    await prismaTest.editionVolunteerApplication.create({
      data: {
        editionId: testEdition.id,
        userId: testUser.id,
        status: 'ACCEPTED',
      },
    })
  })

  describe('isActiveAccessControlVolunteer', () => {
    it('devrait retourner false si aucun créneau actif', async () => {
      const result = await isActiveAccessControlVolunteer(testUser.id, testEdition.id)
      expect(result).toBe(false)
    })

    it("devrait retourner true si bénévole en créneau actif de contrôle d'accès", async () => {
      // Créer un créneau actif (maintenant ± 1 heure)
      const now = new Date()
      const startTime = new Date(now.getTime() - 30 * 60 * 1000) // il y a 30 min
      const endTime = new Date(now.getTime() + 30 * 60 * 1000) // dans 30 min

      const timeSlot = await prismaTest.volunteerTimeSlot.create({
        data: {
          editionId: testEdition.id,
          teamId: testAccessControlTeam.id,
          title: 'Créneau contrôle actif',
          startDateTime: startTime,
          endDateTime: endTime,
          maxVolunteers: 5,
        },
      })

      await prismaTest.volunteerAssignment.create({
        data: {
          timeSlotId: timeSlot.id,
          userId: testUser.id,
          assignedById: testUser.id,
        },
      })

      const result = await isActiveAccessControlVolunteer(testUser.id, testEdition.id)
      expect(result).toBe(true)
    })

    it('devrait retourner true si bénévole dans la marge de 15 minutes avant le début', async () => {
      // Créer un créneau qui commence dans 10 minutes
      const now = new Date()
      const startTime = new Date(now.getTime() + 10 * 60 * 1000) // dans 10 min
      const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000) // dans 2h

      const timeSlot = await prismaTest.volunteerTimeSlot.create({
        data: {
          editionId: testEdition.id,
          teamId: testAccessControlTeam.id,
          title: 'Créneau bientôt',
          startDateTime: startTime,
          endDateTime: endTime,
          maxVolunteers: 5,
        },
      })

      await prismaTest.volunteerAssignment.create({
        data: {
          timeSlotId: timeSlot.id,
          userId: testUser.id,
          assignedById: testUser.id,
        },
      })

      const result = await isActiveAccessControlVolunteer(testUser.id, testEdition.id)
      expect(result).toBe(true)
    })

    it('devrait retourner true si bénévole dans la marge de 15 minutes après la fin', async () => {
      // Créer un créneau qui s'est terminé il y a 10 minutes
      const now = new Date()
      const startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000) // il y a 2h
      const endTime = new Date(now.getTime() - 10 * 60 * 1000) // il y a 10 min

      const timeSlot = await prismaTest.volunteerTimeSlot.create({
        data: {
          editionId: testEdition.id,
          teamId: testAccessControlTeam.id,
          title: 'Créneau récemment terminé',
          startDateTime: startTime,
          endDateTime: endTime,
          maxVolunteers: 5,
        },
      })

      await prismaTest.volunteerAssignment.create({
        data: {
          timeSlotId: timeSlot.id,
          userId: testUser.id,
          assignedById: testUser.id,
        },
      })

      const result = await isActiveAccessControlVolunteer(testUser.id, testEdition.id)
      expect(result).toBe(true)
    })

    it('devrait retourner false si créneau trop ancien (> 15 min)', async () => {
      // Créer un créneau qui s'est terminé il y a 20 minutes
      const now = new Date()
      const startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000) // il y a 2h
      const endTime = new Date(now.getTime() - 20 * 60 * 1000) // il y a 20 min

      const timeSlot = await prismaTest.volunteerTimeSlot.create({
        data: {
          editionId: testEdition.id,
          teamId: testAccessControlTeam.id,
          title: 'Créneau ancien',
          startDateTime: startTime,
          endDateTime: endTime,
          maxVolunteers: 5,
        },
      })

      await prismaTest.volunteerAssignment.create({
        data: {
          timeSlotId: timeSlot.id,
          userId: testUser.id,
          assignedById: testUser.id,
        },
      })

      const result = await isActiveAccessControlVolunteer(testUser.id, testEdition.id)
      expect(result).toBe(false)
    })

    it('devrait retourner false si créneau trop futur (> 15 min)', async () => {
      // Créer un créneau qui commence dans 20 minutes
      const now = new Date()
      const startTime = new Date(now.getTime() + 20 * 60 * 1000) // dans 20 min
      const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000) // dans 2h

      const timeSlot = await prismaTest.volunteerTimeSlot.create({
        data: {
          editionId: testEdition.id,
          teamId: testAccessControlTeam.id,
          title: 'Créneau futur',
          startDateTime: startTime,
          endDateTime: endTime,
          maxVolunteers: 5,
        },
      })

      await prismaTest.volunteerAssignment.create({
        data: {
          timeSlotId: timeSlot.id,
          userId: testUser.id,
          assignedById: testUser.id,
        },
      })

      const result = await isActiveAccessControlVolunteer(testUser.id, testEdition.id)
      expect(result).toBe(false)
    })

    it("devrait retourner false si créneau dans une équipe normale (non contrôle d'accès)", async () => {
      // Créer un créneau actif mais dans une équipe normale
      const now = new Date()
      const startTime = new Date(now.getTime() - 30 * 60 * 1000)
      const endTime = new Date(now.getTime() + 30 * 60 * 1000)

      const timeSlot = await prismaTest.volunteerTimeSlot.create({
        data: {
          editionId: testEdition.id,
          teamId: testTeam.id, // Équipe normale, pas de contrôle d'accès
          title: 'Créneau équipe normale',
          startDateTime: startTime,
          endDateTime: endTime,
          maxVolunteers: 5,
        },
      })

      await prismaTest.volunteerAssignment.create({
        data: {
          timeSlotId: timeSlot.id,
          userId: testUser.id,
          assignedById: testUser.id,
        },
      })

      const result = await isActiveAccessControlVolunteer(testUser.id, testEdition.id)
      expect(result).toBe(false)
    })
  })

  describe('getActiveAccessControlSlot', () => {
    it('devrait retourner null si aucun créneau actif', async () => {
      const result = await getActiveAccessControlSlot(testUser.id, testEdition.id)
      expect(result).toBeNull()
    })

    it('devrait retourner les détails du créneau actif', async () => {
      // Créer un créneau actif
      const now = new Date()
      const startTime = new Date(now.getTime() - 30 * 60 * 1000)
      const endTime = new Date(now.getTime() + 30 * 60 * 1000)

      const timeSlot = await prismaTest.volunteerTimeSlot.create({
        data: {
          editionId: testEdition.id,
          teamId: testAccessControlTeam.id,
          title: "Contrôle d'accès principal",
          startDateTime: startTime,
          endDateTime: endTime,
          maxVolunteers: 5,
        },
      })

      await prismaTest.volunteerAssignment.create({
        data: {
          timeSlotId: timeSlot.id,
          userId: testUser.id,
          assignedById: testUser.id,
        },
      })

      const result = await getActiveAccessControlSlot(testUser.id, testEdition.id)

      expect(result).not.toBeNull()
      expect(result?.slotId).toBe(timeSlot.id)
      expect(result?.teamId).toBe(testAccessControlTeam.id)
      expect(result?.teamName).toBe('Équipe contrôle accès')
      expect(result?.title).toBe("Contrôle d'accès principal")
      expect(result?.startDateTime).toEqual(startTime)
      expect(result?.endDateTime).toEqual(endTime)
    })

    it('devrait retourner le premier créneau si plusieurs créneaux actifs', async () => {
      // Créer deux créneaux actifs
      const now = new Date()
      const startTime1 = new Date(now.getTime() - 30 * 60 * 1000)
      const endTime1 = new Date(now.getTime() + 30 * 60 * 1000)
      const startTime2 = new Date(now.getTime() - 10 * 60 * 1000)
      const endTime2 = new Date(now.getTime() + 60 * 60 * 1000)

      const timeSlot1 = await prismaTest.volunteerTimeSlot.create({
        data: {
          editionId: testEdition.id,
          teamId: testAccessControlTeam.id,
          title: 'Premier créneau',
          startDateTime: startTime1,
          endDateTime: endTime1,
          maxVolunteers: 5,
        },
      })

      const timeSlot2 = await prismaTest.volunteerTimeSlot.create({
        data: {
          editionId: testEdition.id,
          teamId: testAccessControlTeam.id,
          title: 'Deuxième créneau',
          startDateTime: startTime2,
          endDateTime: endTime2,
          maxVolunteers: 5,
        },
      })

      await prismaTest.volunteerAssignment.create({
        data: {
          timeSlotId: timeSlot1.id,
          userId: testUser.id,
          assignedById: testUser.id,
        },
      })

      await prismaTest.volunteerAssignment.create({
        data: {
          timeSlotId: timeSlot2.id,
          userId: testUser.id,
          assignedById: testUser.id,
        },
      })

      const result = await getActiveAccessControlSlot(testUser.id, testEdition.id)

      expect(result).not.toBeNull()
      // Devrait retourner le premier créneau (qui commence le plus tôt)
      expect(result?.slotId).toBe(timeSlot1.id)
      expect(result?.title).toBe('Premier créneau')
    })
  })
})
