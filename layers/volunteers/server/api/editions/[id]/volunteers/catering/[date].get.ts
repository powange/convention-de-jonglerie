import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageMealsById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const targetDate = getRouterParam(event, 'date') || ''

    if (!targetDate) throw createError({ status: 400, message: 'Date invalide' })

    const allowed = await canManageMealsById(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })
    }

    const ports = useVolunteerPorts()

    // Étape 1bis : repas + participants bénévoles et organisateurs délégués au module repas ;
    // artistes et billetterie via leurs ports respectifs. Le layer ne lit plus aucun modèle
    // repas/artiste/billetterie.
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
        // ⚠️ `'ticket'` MANQUAIT — constat B5. Le type excluait les participants venus par
        // billetterie, donc leurs allergies ne pouvaient même pas entrer dans ce résumé.
        participantType: 'volunteer' | 'artist' | 'organizer' | 'ticket'
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
        // Comme pour les artistes : la cuisine garde l'assiette au chaud, et la feuille de
        // restauration liste à part qui elle attend.
        afterShow: v.afterShow,
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
        /*
         * ⚠️ CES TROIS CHAMPS ÉTAIENT FORCÉS À `null` — constat B5.
         *
         * La fiche imprimée pour la cuisine comptait donc TOUS les billets comme « sans régime »,
         * et sa section Allergies — celle qui, dixit l'en-tête de `restauration-pdf.ts`, évite
         * d'envoyer quelqu'un à l'hôpital — omettait les allergies déclarées à la commande.
         *
         * 📍 Le port du layer `meals` les lisait DÉJÀ : la liste à l'écran les affichait et les
         * comptait. Deux ports répondaient à la même question, et le plus silencieux était celui
         * qu'on emporte en cuisine.
         */
        dietaryPreference: p.dietaryPreference,
        allergies: p.allergies,
        allergySeverity: p.allergySeverity,
        // Un billet ne porte pas de contact d'urgence : il n'y a pas de formulaire pour le saisir.
        emergencyContactName: null,
        emergencyContactPhone: null,
        // Un participant venu par billetterie ne passe pas sur scène.
        afterShow: false,
      }))

      const organizers = meal.organizers.map((o) => ({
        type: 'organizer' as const,
        nom: o.nom,
        prenom: o.prenom,
        email: o.email,
        phone: o.phone,
        dietaryPreference: o.dietaryPreference,
        allergies: o.allergies,
        allergySeverity: o.allergySeverity,
        emergencyContactName: null,
        emergencyContactPhone: null,
        afterShow: o.afterShow,
      }))

      const allParticipants = [
        ...volunteers,
        ...artists,
        ...ticketParticipants,
        ...organizers,
      ].sort((a, b) => {
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
            /*
             * ⚠️ CETTE ASSERTION DE TYPE EXCLUAIT `'ticket'` — constat B5, et c'était le second
             * verrou. Même les trois champs remontés, un `as` qui ne nomme pas le quatrième cas
             * aurait tenu à la compilation tout en mentant sur ce que la liste contient : le PDF
             * ne saurait pas quoi afficher dans sa colonne de provenance.
             */
            participantType: p.type,
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
        organizerCount: organizers.length,
        participants: allParticipants,
      }
    })

    return {
      date: targetDate,
      summary,
      meals: mealDetails,
    }
  },
  { operationName: 'GetVolunteerCateringByDate' }
)
