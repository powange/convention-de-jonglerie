/**
 * Utilitaires pour le calcul des statistiques des b�n�voles
 */

export interface VolunteerStats {
  totalVolunteers: number
  totalHours: number
  averageHours: number
  totalSlots: number
}

export interface VolunteerStat {
  user: {
    id: number
    pseudo: string
    prenom?: string
    nom?: string
    [key: string]: any
  }
  hours: number
  slots: number
}

export interface DayStats {
  date: string
  volunteers: VolunteerStat[]
  totalVolunteers: number
  totalHours: number
}

export interface VolunteerStatsIndividual {
  user: {
    id: number
    pseudo: string
    prenom?: string
    nom?: string
    [key: string]: any
  }
  totalHours: number
  totalSlots: number
  dayDetails?: Array<{
    date: string
    hours: number
    slots: number
  }>
}

export interface TimeSlotWithAssignments {
  id: string | number
  start: string
  end: string
  assignedVolunteersList?: Array<{
    user: {
      id: number
      pseudo: string
      prenom?: string
      nom?: string
      [key: string]: any
    }
    [key: string]: any
  }>
  [key: string]: any
}

export interface AcceptedVolunteer {
  user: {
    id: number
    pseudo: string
    prenom?: string
    nom?: string
    [key: string]: any
  }
  status: string
  [key: string]: any
}

/**
 * Calcule les statistiques globales des b�n�voles
 */
export function calculateVolunteersStats(
  timeSlots: TimeSlotWithAssignments[],
  acceptedVolunteers: AcceptedVolunteer[]
): VolunteerStats {
  const totalVolunteers = acceptedVolunteers.length || 0

  if (totalVolunteers === 0) {
    return {
      totalVolunteers: 0,
      totalHours: 0,
      averageHours: 0,
      totalSlots: 0,
    }
  }

  const volunteerHours = new Map<number, number>()
  const volunteerSlots = new Map<number, number>()
  let totalHours = 0
  let totalSlots = 0

  const slotsWithAssignments = timeSlots.filter(
    (slot) => slot.assignedVolunteersList && slot.assignedVolunteersList.length > 0
  )

  slotsWithAssignments.forEach((slot) => {
    const startTime = new Date(slot.start)
    const endTime = new Date(slot.end)
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)

    slot.assignedVolunteersList?.forEach((assignment) => {
      const userId = assignment.user.id
      volunteerHours.set(userId, (volunteerHours.get(userId) || 0) + hours)
      volunteerSlots.set(userId, (volunteerSlots.get(userId) || 0) + 1)
      totalHours += hours
      totalSlots += 1
    })
  })

  const averageHours = totalVolunteers > 0 ? totalHours / totalVolunteers : 0

  return {
    totalVolunteers,
    totalHours,
    averageHours,
    totalSlots,
  }
}

/**
 * Calcule les statistiques par jour
 */
export function calculateVolunteersStatsByDay(timeSlots: TimeSlotWithAssignments[]): DayStats[] {
  const dayStats = new Map<string, any>()

  timeSlots.forEach((slot) => {
    if (!slot.assignedVolunteersList || slot.assignedVolunteersList.length === 0) return

    const startTime = new Date(slot.start)
    const endTime = new Date(slot.end)
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    const dayKey = startTime.toISOString().split('T')[0] // YYYY-MM-DD

    if (!dayStats.has(dayKey)) {
      dayStats.set(dayKey, {
        date: dayKey,
        volunteers: new Map<number, any>(),
        totalHours: 0,
        totalVolunteers: 0,
      })
    }

    const day = dayStats.get(dayKey)!

    slot.assignedVolunteersList.forEach((assignment) => {
      const userId = assignment.user.id

      if (!day.volunteers.has(userId)) {
        day.volunteers.set(userId, {
          user: assignment.user,
          hours: 0,
          slots: 0,
        })
      }

      const volunteerStat = day.volunteers.get(userId)
      volunteerStat.hours += hours
      volunteerStat.slots += 1
      day.totalHours += hours
    })

    day.totalVolunteers = day.volunteers.size
  })

  // Convertir en array et trier par date
  return Array.from(dayStats.values())
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
    .map((day) => ({
      ...day,
      volunteers: Array.from(day.volunteers.values()).sort((a: any, b: any) => b.hours - a.hours), // Trier par heures d�croissantes
    }))
}

/**
 * Calcule les statistiques par b�n�vole individuel (incluant ceux sans cr�neaux)
 */
export function calculateVolunteersStatsIndividual(
  timeSlots: TimeSlotWithAssignments[],
  acceptedVolunteers: AcceptedVolunteer[]
): VolunteerStatsIndividual[] {
  const volunteerStats = new Map<number, any>()

  // D'abord, ajouter tous les b�n�voles accept�s avec 0 heures
  acceptedVolunteers.forEach((application) => {
    if (application.user && !volunteerStats.has(application.user.id)) {
      volunteerStats.set(application.user.id, {
        user: application.user,
        totalHours: 0,
        totalSlots: 0,
        dayDetails: new Map<string, any>(),
      })
    }
  })

  // Ensuite, calculer les heures pour ceux qui ont des cr�neaux
  timeSlots.forEach((slot) => {
    if (!slot.assignedVolunteersList || slot.assignedVolunteersList.length === 0) return

    const startTime = new Date(slot.start)
    const endTime = new Date(slot.end)
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    const dayKey = startTime.toISOString().split('T')[0] // YYYY-MM-DD

    slot.assignedVolunteersList.forEach((assignment) => {
      const userId = assignment.user.id

      if (!volunteerStats.has(userId)) {
        volunteerStats.set(userId, {
          user: assignment.user,
          totalHours: 0,
          totalSlots: 0,
          dayDetails: new Map<string, any>(),
        })
      }

      const volunteerStat = volunteerStats.get(userId)
      volunteerStat.totalHours += hours
      volunteerStat.totalSlots += 1

      // Ajouter les d�tails par jour
      if (!volunteerStat.dayDetails.has(dayKey)) {
        volunteerStat.dayDetails.set(dayKey, {
          date: dayKey,
          hours: 0,
          slots: 0,
        })
      }

      const dayDetail = volunteerStat.dayDetails.get(dayKey)
      dayDetail.hours += hours
      dayDetail.slots += 1
    })
  })

  // Convertir en array et trier par nombre d'heures total d�croissant
  return Array.from(volunteerStats.values())
    .map((volunteer) => ({
      ...volunteer,
      dayDetails: Array.from(volunteer.dayDetails.values()).sort((a: any, b: any) =>
        a.date.localeCompare(b.date)
      ), // Trier par date
    }))
    .sort((a, b) => {
      // Trier par heures d�croissantes, puis par nom
      if (b.totalHours !== a.totalHours) {
        return b.totalHours - a.totalHours
      }
      return (a.user.pseudo || '').localeCompare(b.user.pseudo || '')
    })
}
