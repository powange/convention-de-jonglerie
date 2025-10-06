import { DateTime as dt } from 'luxon'

import type { DateTime } from 'luxon'

export interface VolunteerApplication {
  id: number
  user: {
    id: number
    pseudo: string
    nom?: string
    prenom?: string
  }
  availability: string // JSON string avec les préférences
  experience: string
  motivation: string
  phone?: string
  teamPreferences?: any[]
}

export interface TimeSlot {
  id: string
  title: string
  start: string
  end: string
  teamId?: string
  maxVolunteers: number
  assignedVolunteers: number
  description?: string
  requiredSkills?: string[]
  priority?: number // 1-5, 5 = très prioritaire
}

export interface Team {
  id: string
  name: string
  color: string
}

export interface Assignment {
  volunteerId: number
  slotId: string
  teamId?: string
  score: number
  confidence: number
}

export interface SchedulingConstraints {
  maxHoursPerVolunteer?: number
  minHoursPerVolunteer?: number
  maxHoursPerDay?: number
  minHoursPerDay?: number
  balanceTeams?: boolean
  prioritizeExperience?: boolean
  respectStrictAvailability?: boolean
  allowOvertime?: boolean
  maxOvertimeHours?: number
}

export interface SchedulingResult {
  assignments: Assignment[]
  unassigned: {
    volunteers: number[]
    slots: string[]
  }
  stats: {
    totalAssignments: number
    averageHoursPerVolunteer: number
    satisfactionRate: number
    balanceScore: number
  }
  warnings: string[]
  recommendations: string[]
}

export class VolunteerScheduler {
  private volunteers: VolunteerApplication[] = []
  private timeSlots: TimeSlot[] = []
  private teams: Team[] = []
  private constraints: SchedulingConstraints = {}
  private assignments: Assignment[] = []

  constructor(
    volunteers: VolunteerApplication[],
    timeSlots: TimeSlot[],
    teams: Team[],
    constraints: SchedulingConstraints = {}
  ) {
    this.volunteers = volunteers
    this.timeSlots = timeSlots
    this.teams = teams
    this.constraints = {
      maxHoursPerVolunteer: 12,
      minHoursPerVolunteer: 2,
      maxHoursPerDay: 8,
      minHoursPerDay: 1,
      balanceTeams: true,
      prioritizeExperience: true,
      respectStrictAvailability: true,
      allowOvertime: false,
      maxOvertimeHours: 2,
      ...constraints,
    }
  }

  /**
   * Lance l'algorithme d'assignation automatique
   */
  public assignVolunteers(): SchedulingResult {
    this.assignments = []

    // 1. Préparation des données
    const availableVolunteers = this.getAvailableVolunteers()
    const sortedSlots = this.getSortedSlots()

    // 2. Première passe : assignations évidentes (forte préférence + expérience)
    this.assignHighPriorityMatches(availableVolunteers, sortedSlots)

    // 3. Deuxième passe : remplissage optimal
    this.assignRemainingSlots(availableVolunteers, sortedSlots)

    // 4. Troisième passe : équilibrage si nécessaire
    if (this.constraints.balanceTeams) {
      this.balanceAssignments()
    }

    // 5. Génération des résultats
    return this.generateResults()
  }

  /**
   * Calcule le score d'assignation pour un bénévole et un créneau
   */
  private calculateAssignmentScore(volunteer: VolunteerApplication, slot: TimeSlot): number {
    let score = 0

    // Disponibilité du bénévole
    const availability = this.parseAvailability(volunteer.availability)
    const isAvailable = this.isVolunteerAvailable(volunteer, slot, availability)

    if (!isAvailable) {
      if (this.constraints.respectStrictAvailability) {
        return -1000 // Impossible
      } else {
        score -= 50 // Pénalité forte
      }
    } else {
      score += 20 // Bonus disponibilité
    }

    // Préférence d'équipe
    if (slot.teamId && volunteer.teamPreferences?.some((pref) => pref.teamId === slot.teamId)) {
      score += 15
    }

    // Préférences horaires
    const timePreferenceBonus = this.calculateTimePreferenceBonus(volunteer, slot, availability)
    score += timePreferenceBonus

    // Expérience et compétences
    if (this.constraints.prioritizeExperience) {
      const experienceBonus = this.calculateExperienceBonus(volunteer, slot)
      score += experienceBonus
    }

    // Charge de travail actuelle
    const currentHours = this.getCurrentVolunteerHours(volunteer.user.id)
    const slotDuration = this.getSlotDuration(slot)
    const maxHours = this.constraints.maxHoursPerVolunteer || 12

    if (currentHours + slotDuration > maxHours) {
      if (!this.constraints.allowOvertime) {
        score -= 100 // Forte pénalité
      } else if (
        currentHours + slotDuration >
        maxHours + (this.constraints.maxOvertimeHours || 2)
      ) {
        score -= 200 // Impossible en overtime
      } else {
        score -= 20 // Pénalité overtime
      }
    }

    // Contraintes d'heures par jour
    if (!this.checkDailyHoursConstraints(volunteer.user.id, slot)) {
      if (!this.constraints.allowOvertime) {
        return -1000 // Impossible si pas d'heures sup autorisées
      } else {
        score -= 80 // Forte pénalité si heures sup autorisées
      }
    }

    // Vérification des heures minimum par jour
    const slotDate = dt.fromISO(slot.start).toISODate()
    const currentDailyHours = this.getVolunteerHoursForDate(volunteer.user.id, slotDate!)
    const minHoursPerDay = this.constraints.minHoursPerDay || 1

    if (currentDailyHours === 0 && slotDuration >= minHoursPerDay) {
      score += 5 // Petit bonus pour respecter le minimum quotidien
    }

    // Équilibrage des heures
    const avgHours = this.getAverageHours()
    if (currentHours > avgHours) {
      score -= Math.floor((currentHours - avgHours) * 2)
    } else if (currentHours < avgHours) {
      score += Math.floor((avgHours - currentHours) * 1.5)
    }

    // Priorité du créneau
    if (slot.priority) {
      score += slot.priority * 3
    }

    // Bonus si le créneau n'est pas encore complet
    const remainingSpots = slot.maxVolunteers - slot.assignedVolunteers
    if (remainingSpots <= 2) {
      score += 10 // Bonus urgence
    }

    return Math.max(score, -1000)
  }

  /**
   * Calcule la confiance basée sur le score (0-100)
   */
  private calculateConfidence(score: number): number {
    // Normalisation intelligente des scores en confiance (pourcentage direct)
    // Score 50+ = excellente confiance (80-100%)
    // Score 20-49 = bonne confiance (60-79%)
    // Score 0-19 = confiance moyenne (40-59%)
    // Score négatif = faible confiance (10-39%)

    if (score >= 50) {
      // Excellente confiance : 80-100%
      return Math.min(80 + (score - 50) * 0.4, 100)
    } else if (score >= 20) {
      // Bonne confiance : 60-79%
      return 60 + (score - 20) * 0.6
    } else if (score >= 0) {
      // Confiance moyenne : 40-59%
      return 40 + score * 1
    } else {
      // Faible confiance : 10-39%
      return Math.max(10, 40 + score * 0.3)
    }
  }

  /**
   * Parse la disponibilité JSON du bénévole
   */
  private parseAvailability(availability: string): any {
    try {
      return JSON.parse(availability)
    } catch {
      return {
        setup: true,
        event: true,
        teardown: true,
        unavailableSlots: [],
      }
    }
  }

  /**
   * Vérifie si un bénévole est disponible pour un créneau
   */
  private isVolunteerAvailable(
    volunteer: VolunteerApplication,
    slot: TimeSlot,
    availability: any
  ): boolean {
    // Vérifier les créneaux indisponibles spécifiques
    if (availability.unavailableSlots?.includes(slot.id)) {
      return false
    }

    // Vérifier les disponibilités générales (montage, événement, démontage)
    const slotDate = dt.fromISO(slot.start)
    const slotType = this.getSlotType(slot, slotDate)

    switch (slotType) {
      case 'setup':
        return availability.setup === true
      case 'teardown':
        return availability.teardown === true
      case 'event':
      default:
        return availability.event === true
    }
  }

  /**
   * Détermine le type de créneau (montage, événement, démontage)
   */
  private getSlotType(slot: TimeSlot, _slotDate: DateTime): 'setup' | 'event' | 'teardown' {
    // Logique simple : on pourrait améliorer avec des métadonnées
    if (
      slot.title.toLowerCase().includes('montage') ||
      slot.title.toLowerCase().includes('setup')
    ) {
      return 'setup'
    }
    if (
      slot.title.toLowerCase().includes('démontage') ||
      slot.title.toLowerCase().includes('teardown')
    ) {
      return 'teardown'
    }
    return 'event'
  }

  /**
   * Calcule le bonus de préférence horaire pour un bénévole et un créneau
   */
  private calculateTimePreferenceBonus(
    volunteer: VolunteerApplication,
    slot: TimeSlot,
    availability: any
  ): number {
    if (!availability.timePreferences || !Array.isArray(availability.timePreferences)) {
      return 0 // Pas de préférences définies
    }

    const slotStart = dt.fromISO(slot.start)
    const slotHour = slotStart.hour

    // Mappage des créneaux horaires vers les heures
    const timeSlotMapping: Record<string, { start: number; end: number }> = {
      early_morning: { start: 6, end: 9 },
      morning: { start: 9, end: 12 },
      lunch: { start: 12, end: 14 },
      early_afternoon: { start: 14, end: 17 },
      late_afternoon: { start: 17, end: 20 },
      evening: { start: 20, end: 23 },
      late_evening: { start: 23, end: 2 }, // Attention: chevauche minuit
      night: { start: 2, end: 6 },
    }

    let bonus = 0

    // Vérifier si l'heure du créneau correspond aux préférences
    for (const preference of availability.timePreferences) {
      const timeSlot = timeSlotMapping[preference]
      if (!timeSlot) continue

      // Gestion spéciale pour late_evening qui chevauche minuit
      if (preference === 'late_evening') {
        if (slotHour >= 23 || slotHour < 2) {
          bonus += 12 // Bon bonus pour préférence horaire respectée
        }
      } else {
        if (slotHour >= timeSlot.start && slotHour < timeSlot.end) {
          bonus += 12 // Bon bonus pour préférence horaire respectée
        }
      }
    }

    return bonus
  }

  /**
   * Calcule le bonus d'expérience pour un bénévole et un créneau
   */
  private calculateExperienceBonus(volunteer: VolunteerApplication, slot: TimeSlot): number {
    const experience = volunteer.experience.toLowerCase()
    let bonus = 0

    // Bonus expérience générale
    if (experience.includes('bénévole') || experience.includes('volunteer')) {
      bonus += 5
    }
    if (experience.includes('jonglerie') || experience.includes('juggling')) {
      bonus += 5
    }
    if (experience.includes('convention') || experience.includes('festival')) {
      bonus += 3
    }

    // Bonus compétences spécifiques selon le créneau
    if (slot.requiredSkills?.length) {
      slot.requiredSkills.forEach((skill) => {
        if (experience.includes(skill.toLowerCase())) {
          bonus += 8
        }
      })
    }

    return bonus
  }

  /**
   * Obtient les heures actuelles assignées à un bénévole
   */
  private getCurrentVolunteerHours(volunteerId: number): number {
    return this.assignments
      .filter((assignment) => assignment.volunteerId === volunteerId)
      .reduce((total, assignment) => {
        const slot = this.timeSlots.find((s) => s.id === assignment.slotId)
        return total + (slot ? this.getSlotDuration(slot) : 0)
      }, 0)
  }

  /**
   * Calcule la durée d'un créneau en heures
   */
  private getSlotDuration(slot: TimeSlot): number {
    const start = dt.fromISO(slot.start)
    const end = dt.fromISO(slot.end)
    return end.diff(start, 'hours').hours
  }

  /**
   * Calcule les heures d'un bénévole pour une date donnée
   */
  private getVolunteerHoursForDate(volunteerId: number, date: string): number {
    const targetDate = dt.fromISO(date).startOf('day')

    return this.assignments
      .filter((assignment) => assignment.volunteerId === volunteerId)
      .reduce((total, assignment) => {
        const slot = this.timeSlots.find((s) => s.id === assignment.slotId)
        if (!slot) return total

        const slotDate = dt.fromISO(slot.start).startOf('day')
        if (slotDate.equals(targetDate)) {
          return total + this.getSlotDuration(slot)
        }

        return total
      }, 0)
  }

  /**
   * Vérifie si l'ajout d'un créneau respecte les contraintes d'heures par jour
   */
  private checkDailyHoursConstraints(volunteerId: number, slot: TimeSlot): boolean {
    const slotDate = dt.fromISO(slot.start).toISODate()
    const currentDailyHours = this.getVolunteerHoursForDate(volunteerId, slotDate!)
    const slotDuration = this.getSlotDuration(slot)

    const maxHoursPerDay = this.constraints.maxHoursPerDay || 8

    // Vérifie si l'ajout de ce créneau dépasserait la limite quotidienne
    return currentDailyHours + slotDuration <= maxHoursPerDay
  }

  /**
   * Calcule la moyenne d'heures par bénévole
   */
  private getAverageHours(): number {
    if (this.volunteers.length === 0) return 0

    const totalHours = this.volunteers.reduce((total, volunteer) => {
      return total + this.getCurrentVolunteerHours(volunteer.user.id)
    }, 0)

    return totalHours / this.volunteers.length
  }

  /**
   * Obtient les bénévoles disponibles
   */
  private getAvailableVolunteers(): VolunteerApplication[] {
    return this.volunteers.filter((volunteer) => volunteer.user.id)
  }

  /**
   * Trie les créneaux par priorité
   */
  private getSortedSlots(): TimeSlot[] {
    return [...this.timeSlots].sort((a, b) => {
      // Priorité d'abord
      const priorityDiff = (b.priority || 0) - (a.priority || 0)
      if (priorityDiff !== 0) return priorityDiff

      // Puis par nombre de places restantes (urgence)
      const remainingA = a.maxVolunteers - a.assignedVolunteers
      const remainingB = b.maxVolunteers - b.assignedVolunteers
      if (remainingA !== remainingB) return remainingA - remainingB

      // Enfin par date
      return dt.fromISO(a.start).toMillis() - dt.fromISO(b.start).toMillis()
    })
  }

  /**
   * Première passe : assignations évidentes
   */
  private assignHighPriorityMatches(volunteers: VolunteerApplication[], slots: TimeSlot[]): void {
    for (const slot of slots) {
      if (slot.assignedVolunteers >= slot.maxVolunteers) continue

      // Trouve les meilleurs candidats pour ce créneau
      const candidates = volunteers
        .map((volunteer) => ({
          volunteer,
          score: this.calculateAssignmentScore(volunteer, slot),
        }))
        .filter((candidate) => candidate.score > 50) // Seuil élevé pour première passe
        .sort((a, b) => b.score - a.score)

      // Assigne les meilleurs candidats
      const spotsToFill = slot.maxVolunteers - slot.assignedVolunteers
      let filled = 0

      for (let i = 0; i < candidates.length && filled < spotsToFill; i++) {
        const candidate = candidates[i]

        // Vérifier les conflits temporels
        if (this.hasTimeConflict(candidate.volunteer.user.id, slot.id)) {
          continue // Passer au candidat suivant en cas de conflit
        }

        this.assignments.push({
          volunteerId: candidate.volunteer.user.id,
          slotId: slot.id,
          teamId: slot.teamId,
          score: candidate.score,
          confidence: this.calculateConfidence(candidate.score),
        })

        slot.assignedVolunteers++
        filled++
      }
    }
  }

  /**
   * Deuxième passe : remplissage des créneaux restants
   */
  private assignRemainingSlots(volunteers: VolunteerApplication[], slots: TimeSlot[]): void {
    for (const slot of slots) {
      if (slot.assignedVolunteers >= slot.maxVolunteers) continue

      // Trouve tous les candidats possibles
      const candidates = volunteers
        .filter((volunteer) => !this.isVolunteerAssignedToSlot(volunteer.user.id, slot.id))
        .map((volunteer) => ({
          volunteer,
          score: this.calculateAssignmentScore(volunteer, slot),
        }))
        .filter((candidate) => candidate.score > -50) // Seuil plus bas
        .sort((a, b) => b.score - a.score)

      // Assigne jusqu'à remplir le créneau
      const spotsToFill = slot.maxVolunteers - slot.assignedVolunteers
      let filled = 0

      for (let i = 0; i < candidates.length && filled < spotsToFill; i++) {
        const candidate = candidates[i]

        // Vérifier les conflits temporels d'abord
        if (this.hasTimeConflict(candidate.volunteer.user.id, slot.id)) {
          continue // Passer au candidat suivant en cas de conflit
        }

        // Vérification finale des heures max
        const currentHours = this.getCurrentVolunteerHours(candidate.volunteer.user.id)
        const slotDuration = this.getSlotDuration(slot)
        const maxHours = this.constraints.maxHoursPerVolunteer || 12

        if (
          currentHours + slotDuration <=
          maxHours + (this.constraints.allowOvertime ? this.constraints.maxOvertimeHours || 2 : 0)
        ) {
          this.assignments.push({
            volunteerId: candidate.volunteer.user.id,
            slotId: slot.id,
            teamId: slot.teamId,
            score: candidate.score,
            confidence: this.calculateConfidence(candidate.score),
          })

          slot.assignedVolunteers++
          filled++
        }
      }
    }
  }

  /**
   * Vérifie si un bénévole est déjà assigné à un créneau
   */
  private isVolunteerAssignedToSlot(volunteerId: number, slotId: string): boolean {
    return this.assignments.some(
      (assignment) => assignment.volunteerId === volunteerId && assignment.slotId === slotId
    )
  }

  /**
   * Vérifie si un bénévole a un conflit temporel avec un créneau
   */
  private hasTimeConflict(volunteerId: number, slotId: string): boolean {
    const targetSlot = this.timeSlots.find((s) => s.id === slotId)
    if (!targetSlot) return false

    const targetStart = new Date(targetSlot.start)
    const targetEnd = new Date(targetSlot.end)

    // Vérifie tous les créneaux déjà assignés à ce bénévole
    return this.assignments
      .filter((assignment) => assignment.volunteerId === volunteerId)
      .some((assignment) => {
        const assignedSlot = this.timeSlots.find((s) => s.id === assignment.slotId)
        if (!assignedSlot) return false

        const assignedStart = new Date(assignedSlot.start)
        const assignedEnd = new Date(assignedSlot.end)

        // Vérifie le chevauchement temporel
        return (
          (targetStart < assignedEnd && targetEnd > assignedStart) ||
          (assignedStart < targetEnd && assignedEnd > targetStart)
        )
      })
  }

  /**
   * Troisième passe : équilibrage des assignations
   */
  private balanceAssignments(): void {
    // Trouve les bénévoles sous-utilisés et sur-utilisés
    const volunteerHours = this.volunteers.map((volunteer) => ({
      id: volunteer.user.id,
      hours: this.getCurrentVolunteerHours(volunteer.user.id),
      volunteer,
    }))

    const avgHours = volunteerHours.reduce((sum, v) => sum + v.hours, 0) / volunteerHours.length
    const underUtilized = volunteerHours.filter((v) => v.hours < avgHours - 2)
    const overUtilized = volunteerHours.filter((v) => v.hours > avgHours + 2)

    // Tente de rééquilibrer
    for (const overUser of overUtilized) {
      for (const underUser of underUtilized) {
        if (Math.abs(overUser.hours - underUser.hours) < 3) continue

        // Trouve un créneau à transférer
        const transferableAssignment = this.assignments.find(
          (assignment) =>
            assignment.volunteerId === overUser.id &&
            this.canTransferAssignment(assignment, underUser.volunteer)
        )

        if (transferableAssignment) {
          // Effectue le transfert
          transferableAssignment.volunteerId = underUser.id

          // Met à jour les heures
          overUser.hours -= this.getSlotDuration(
            this.timeSlots.find((s) => s.id === transferableAssignment.slotId)!
          )
          underUser.hours += this.getSlotDuration(
            this.timeSlots.find((s) => s.id === transferableAssignment.slotId)!
          )

          break
        }
      }
    }
  }

  /**
   * Vérifie si une assignation peut être transférée
   */
  private canTransferAssignment(
    assignment: Assignment,
    newVolunteer: VolunteerApplication
  ): boolean {
    const slot = this.timeSlots.find((s) => s.id === assignment.slotId)
    if (!slot) return false

    // Vérifier les conflits temporels pour le nouveau bénévole
    if (this.hasTimeConflict(newVolunteer.user.id, assignment.slotId)) {
      return false
    }

    const score = this.calculateAssignmentScore(newVolunteer, slot)
    return score > 0 // Score positif minimum
  }

  /**
   * Génère les résultats finaux
   */
  private generateResults(): SchedulingResult {
    const unassignedVolunteers = this.volunteers
      .filter((volunteer) => !this.assignments.some((a) => a.volunteerId === volunteer.user.id))
      .map((v) => v.user.id)

    const unassignedSlots = this.timeSlots
      .filter((slot) => slot.assignedVolunteers < slot.maxVolunteers)
      .map((s) => s.id)

    const totalHours = this.assignments.reduce((total, assignment) => {
      const slot = this.timeSlots.find((s) => s.id === assignment.slotId)
      return total + (slot ? this.getSlotDuration(slot) : 0)
    }, 0)

    const averageHours = this.volunteers.length > 0 ? totalHours / this.volunteers.length : 0

    const satisfactionRate =
      this.assignments.reduce(
        (total, assignment) => total + Math.max(assignment.confidence, 0),
        0
      ) /
      Math.max(this.assignments.length, 1) /
      100 // Convertir en ratio (0-1)

    const warnings: string[] = []
    const recommendations: string[] = []

    // Génère les avertissements et recommandations
    if (unassignedVolunteers.length > 0) {
      warnings.push(`${unassignedVolunteers.length} bénévole(s) non assigné(s)`)
    }
    if (unassignedSlots.length > 0) {
      warnings.push(`${unassignedSlots.length} créneau(x) non complété(s)`)
    }
    if (satisfactionRate < 0.7) {
      recommendations.push("Considérez d'ajuster les contraintes pour améliorer la satisfaction")
    }
    if (averageHours < (this.constraints.minHoursPerVolunteer || 2)) {
      recommendations.push('Augmentez le nombre de créneaux ou réduisez le nombre de bénévoles')
    }

    return {
      assignments: this.assignments,
      unassigned: {
        volunteers: unassignedVolunteers,
        slots: unassignedSlots,
      },
      stats: {
        totalAssignments: this.assignments.length,
        averageHoursPerVolunteer: averageHours,
        satisfactionRate,
        balanceScore: this.calculateBalanceScore(),
      },
      warnings,
      recommendations,
    }
  }

  /**
   * Calcule un score d'équilibrage (0-1)
   */
  private calculateBalanceScore(): number {
    const volunteerHours = this.volunteers.map((volunteer) =>
      this.getCurrentVolunteerHours(volunteer.user.id)
    )

    if (volunteerHours.length === 0) return 1

    const avgHours = volunteerHours.reduce((sum, hours) => sum + hours, 0) / volunteerHours.length
    const variance =
      volunteerHours.reduce((sum, hours) => sum + Math.pow(hours - avgHours, 2), 0) /
      volunteerHours.length
    const stdDev = Math.sqrt(variance)

    // Score inversement proportionnel à l'écart-type
    return Math.max(0, 1 - stdDev / (avgHours + 1))
  }
}
