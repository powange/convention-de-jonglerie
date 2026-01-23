import type { HasDates, BadgeColor } from '~/types'

export type EditionStatusValue = 'PLANNED' | 'PUBLISHED' | 'OFFLINE' | 'CANCELLED'

/**
 * Composable pour gérer le statut des éditions
 */
export const useEditionStatus = () => {
  const { t } = useI18n()

  /**
   * Options de statut pour les sélecteurs (USelect)
   */
  const statusOptions = computed(() => [
    {
      label: t('edition.status.offline'),
      value: 'OFFLINE' as EditionStatusValue,
    },
    {
      label: t('edition.status.planned'),
      value: 'PLANNED' as EditionStatusValue,
    },
    {
      label: t('edition.status.published'),
      value: 'PUBLISHED' as EditionStatusValue,
    },
    {
      label: t('edition.status.cancelled'),
      value: 'CANCELLED' as EditionStatusValue,
    },
  ])

  /**
   * Détermine la couleur du badge selon l'état de l'édition
   */
  const getStatusColor = (edition: HasDates): BadgeColor => {
    // Si édition annulée, badge rouge
    if (edition.status === 'CANCELLED') {
      return 'error'
    }

    const now = new Date()
    const startDate = new Date(edition.startDate)
    const endDate = new Date(edition.endDate)

    if (now < startDate) return 'info' // À venir - bleu
    if (now > endDate) return 'neutral' // Terminée - gris
    return 'success' // En cours - vert
  }

  /**
   * Détermine le texte du statut selon l'état de l'édition
   */
  const getStatusText = (edition: HasDates): string => {
    // Si édition annulée, afficher "Annulé"
    if (edition.status === 'CANCELLED') {
      return t('edition.status.cancelled')
    }

    const now = new Date()
    const startDate = new Date(edition.startDate)
    const endDate = new Date(edition.endDate)

    // Si édition planifiée et future, afficher "Informations à venir"
    if (edition.status === 'PLANNED' && now < startDate) {
      return t('edition.status_badge.info_coming_soon')
    }

    // Pour les autres cas (PUBLISHED ou PLANNED en cours/passé), utiliser le badge temporel
    if (now < startDate) return `🔄 ${t('edition.status_badge.upcoming')}`
    if (now > endDate) return `✅ ${t('edition.status_badge.finished')}`
    return `🔥 ${t('edition.status_badge.ongoing')}`
  }

  /**
   * Détermine si une édition est en cours
   */
  const isEditionActive = (edition: HasDates): boolean => {
    const now = new Date()
    const startDate = new Date(edition.startDate)
    const endDate = new Date(edition.endDate)

    return now >= startDate && now <= endDate
  }

  /**
   * Détermine si une édition est à venir
   */
  const isEditionUpcoming = (edition: HasDates): boolean => {
    const now = new Date()
    const startDate = new Date(edition.startDate)

    return now < startDate
  }

  /**
   * Détermine si une édition est terminée
   */
  const isEditionFinished = (edition: HasDates): boolean => {
    const now = new Date()
    const endDate = new Date(edition.endDate)

    return now > endDate
  }

  return {
    statusOptions,
    getStatusColor,
    getStatusText,
    isEditionActive,
    isEditionUpcoming,
    isEditionFinished,
  }
}
