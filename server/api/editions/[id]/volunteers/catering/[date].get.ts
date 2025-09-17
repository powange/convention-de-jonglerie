import { canManageEditionVolunteers } from '../../../../../utils/collaborator-management'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const targetDate = getRouterParam(event, 'date') || ''

  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })
  if (!targetDate) throw createError({ statusCode: 400, message: 'Date invalide' })

  const allowed = await canManageEditionVolunteers(editionId, event.context.user.id, event)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour gérer les bénévoles',
    })
  }

  // Récupérer les informations de l'édition
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      volunteersSetupStartDate: true,
      volunteersTeardownEndDate: true,
    },
  })

  if (!edition) throw createError({ statusCode: 404, message: 'Edition introuvable' })

  // Récupérer toutes les candidatures acceptées avec les infos utilisateur
  const applications = await prisma.editionVolunteerApplication.findMany({
    where: {
      editionId,
      status: 'ACCEPTED',
    },
    select: {
      id: true,
      userId: true,
      arrivalDateTime: true,
      departureDateTime: true,
      setupAvailability: true,
      teardownAvailability: true,
      dietaryPreference: true,
      allergies: true,
      user: {
        select: {
          prenom: true,
          nom: true,
          pseudo: true,
        },
      },
    },
  })

  // Déterminer le type de la date cible
  const targetDateObj = new Date(targetDate)
  const editionStart = new Date(edition.startDate)
  const editionEnd = new Date(edition.endDate)
  const setupStart = edition.volunteersSetupStartDate
    ? new Date(edition.volunteersSetupStartDate)
    : null
  const teardownEnd = edition.volunteersTeardownEndDate
    ? new Date(edition.volunteersTeardownEndDate)
    : null

  let dateType: 'setup' | 'event' | 'teardown'

  if (setupStart && targetDateObj < editionStart) {
    dateType = 'setup'
  } else if (teardownEnd && targetDateObj > editionEnd) {
    dateType = 'teardown'
  } else {
    dateType = 'event'
  }

  // Filtrer les bénévoles selon leur disponibilité pour ce type de date
  const relevantApplications = applications.filter((app) => {
    switch (dateType) {
      case 'setup':
        return app.setupAvailability
      case 'teardown':
        return app.teardownAvailability
      case 'event': {
        // Disponible pour l'événement = soit pas de disponibilité spécifique (donc événement par défaut)
        // soit explicitement montage ET/OU démontage mais pas SEULEMENT montage ou SEULEMENT démontage
        const neitherSetupNorTeardown = !app.setupAvailability && !app.teardownAvailability

        // Disponible pour l'événement si :
        // - Ni montage ni démontage (donc événement principal)
        // - Les deux (montage + événement + démontage)
        return neitherSetupNorTeardown || (app.setupAvailability && app.teardownAvailability)
      }
      default:
        return false
    }
  })

  // Analyser la présence par créneaux (matin, midi, soir)
  const analyzeTimeSlotPresence = (app: any) => {
    const presence = { morning: false, noon: false, evening: false }

    // Vérifier si le bénévole est présent ce jour-là
    if (!app.arrivalDateTime || !app.departureDateTime) return presence

    const [arrivalDate, arrivalTime] = app.arrivalDateTime.split('_')
    const [departureDate, departureTime] = app.departureDateTime.split('_')

    const arrivalDateObj = new Date(arrivalDate)
    const departureDateObj = new Date(departureDate)

    // Le bénévole n'est pas présent ce jour-là
    if (targetDateObj < arrivalDateObj || targetDateObj > departureDateObj) {
      return presence
    }

    // Jour d'arrivée : selon l'heure d'arrivée
    if (targetDateObj.getTime() === arrivalDateObj.getTime()) {
      switch (arrivalTime) {
        case 'morning':
          presence.morning = presence.noon = presence.evening = true
          break
        case 'noon':
          presence.noon = presence.evening = true
          break
        case 'afternoon':
        case 'evening':
          presence.evening = true
          break
      }
    }
    // Jour de départ : selon l'heure de départ
    else if (targetDateObj.getTime() === departureDateObj.getTime()) {
      switch (departureTime) {
        case 'morning':
          // Part le matin, donc pas présent pour les repas
          break
        case 'noon':
          presence.morning = true
          break
        case 'afternoon':
        case 'evening':
          presence.morning = presence.noon = true
          break
      }
    }
    // Jour intermédiaire : présent toute la journée
    else {
      presence.morning = presence.noon = presence.evening = true
    }

    return presence
  }

  // Analyser les données pour chaque créneau
  const timeSlots = ['morning', 'noon', 'evening'] as const
  const result = {
    date: targetDate,
    dateType,
    slots: {} as Record<string, any>,
  }

  for (const slot of timeSlots) {
    const presentVolunteers = relevantApplications.filter((app) => {
      const presence = analyzeTimeSlotPresence(app)
      return presence[slot]
    })

    // Compter les régimes alimentaires
    const dietaryCounts = presentVolunteers.reduce(
      (counts, app) => {
        const diet = app.dietaryPreference || 'NONE'
        counts[diet] = (counts[diet] || 0) + 1
        return counts
      },
      {} as Record<string, number>
    )

    // Lister les allergies avec détails
    const allergies = presentVolunteers
      .filter((app) => app.allergies && app.allergies.trim())
      .map((app) => ({
        volunteer: {
          prenom: app.user.prenom,
          nom: app.user.nom,
          pseudo: app.user.pseudo,
        },
        allergies: app.allergies,
      }))

    result.slots[slot] = {
      totalVolunteers: presentVolunteers.length,
      dietaryCounts,
      allergies,
    }
  }

  return result
})
