import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)
  const targetDate = getRouterParam(event, 'date') || ''

  if (!targetDate) throw createError({ status: 400, message: 'Date invalide' })

  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed) {
    throw createError({
      status: 403,
      message: 'Droits insuffisants pour accéder à ces données',
    })
  }

  const ports = useVolunteerPorts()

  // Étape 1bis : repas + participants bénévoles délégués au module repas ; artistes et billetterie
  // via leurs ports respectifs. Le layer ne lit plus aucun modèle repas/artiste/billetterie.
  const meals = await ports.meals.getCateringMealsForDate(editionId, targetDate)
  const mealIds = meals.map((m) => m.id)
  const ticketParticipantsByMeal = await ports.ticketing.getMealTicketParticipants(mealIds)
  const artistParticipantsByMeal = await ports.artists.getMealArtistParticipants(mealIds)

  // Construire le résultat avec un résumé et les détails par repas
  const summary = {
    totalMeals: meals.length,
    mealCounts: {} as Record<string, { total: number; phases: string[] }>,
    totalParticipants: 0,
    dietaryCounts: {} as Record<string, number>,
    allergies: [] as Array<{
      participantName: string
      participantType: 'volunteer' | 'artist'
      allergies: string
      allergySeverity: string | null
      emergencyContactName?: string | null
      emergencyContactPhone?: string | null
    }>,
  }

  const mealDetails = meals.map((meal) => {
    const phases = Array.isArray(meal.phases) ? (meal.phases as string[]) : []

    const volunteers = meal.volunteers.map((v) => ({
      type: 'volunteer' as const,
      nom: v.nom,
      prenom: v.prenom,
      email: v.email,
      phone: v.phone,
      dietaryPreference: v.dietaryPreference,
      allergies: v.allergies,
      allergySeverity: v.allergySeverity,
      emergencyContactName: v.emergencyContactName,
      emergencyContactPhone: v.emergencyContactPhone,
    }))

    const artists = (artistParticipantsByMeal[meal.id] ?? []).map((a) => ({
      type: 'artist' as const,
      nom: a.nom,
      prenom: a.prenom,
      email: a.email,
      phone: a.phone,
      dietaryPreference: a.dietaryPreference,
      allergies: a.allergies,
      allergySeverity: a.allergySeverity,
      emergencyContactName: null,
      emergencyContactPhone: null,
      afterShow: a.afterShow,
    }))

    // Participants billetterie de ce repas (déjà dédupliqués par le port)
    const ticketParticipants = (ticketParticipantsByMeal[meal.id] ?? []).map((p) => ({
      type: 'ticket' as const,
      nom: p.nom,
      prenom: p.prenom,
      email: p.email,
      phone: '',
      dietaryPreference: null,
      allergies: null,
      allergySeverity: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
    }))

    const allParticipants = [...volunteers, ...artists, ...ticketParticipants].sort((a, b) => {
      const nameA = `${a.nom || ''} ${a.prenom || ''}`
      const nameB = `${b.nom || ''} ${b.prenom || ''}`
      return nameA.localeCompare(nameB)
    })

    // Mettre à jour le résumé
    const mealKey = `${meal.mealType}_${phases.join('_')}`
    if (!summary.mealCounts[mealKey]) {
      summary.mealCounts[mealKey] = { total: 0, phases }
    }
    summary.mealCounts[mealKey].total += allParticipants.length
    summary.totalParticipants += allParticipants.length

    // Compter les régimes
    allParticipants.forEach((p) => {
      const diet = p.dietaryPreference || 'NONE'
      summary.dietaryCounts[diet] = (summary.dietaryCounts[diet] || 0) + 1

      // Ajouter les allergies au résumé
      if (p.allergies && p.allergies.trim()) {
        summary.allergies.push({
          participantName: `${p.prenom || ''} ${p.nom || ''}`.trim(),
          participantType: p.type as 'volunteer' | 'artist',
          allergies: p.allergies,
          allergySeverity: p.allergySeverity,
          emergencyContactName: p.emergencyContactName,
          emergencyContactPhone: p.emergencyContactPhone,
        })
      }
    })

    return {
      mealId: meal.id,
      mealType: meal.mealType,
      phases,
      totalParticipants: allParticipants.length,
      volunteerCount: volunteers.length,
      artistCount: artists.length,
      ticketParticipantCount: ticketParticipants.length,
      participants: allParticipants,
    }
  })

  return {
    date: targetDate,
    summary,
    meals: mealDetails,
  }
}, 'GetVolunteerCateringByDate')
