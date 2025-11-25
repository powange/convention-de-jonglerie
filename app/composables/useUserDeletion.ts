export const DELETION_REASONS = {
  NOT_PHYSICAL_PERSON: {
    code: 'NOT_PHYSICAL_PERSON',
    title: 'Compte non-personnel',
    description: 'Le compte ne correspond pas à une personne physique',
    message:
      'Votre compte a été supprimé car il ne correspond pas à une personne physique. Notre plateforme est réservée aux utilisateurs individuels.',
  },
  SPAM_ACTIVITY: {
    code: 'SPAM_ACTIVITY',
    title: 'Activité de spam détectée',
    description: 'Activité de spam ou comportement abusif',
    message:
      "Votre compte a été supprimé en raison d'activités de spam ou de comportement abusif sur notre plateforme.",
  },
  INACTIVE_ACCOUNT: {
    code: 'INACTIVE_ACCOUNT',
    title: 'Compte inactif',
    description: 'Inactivité prolongée du compte',
    message:
      "Votre compte a été supprimé en raison d'une inactivité prolongée conformément à notre politique de rétention des données.",
  },
  POLICY_VIOLATION: {
    code: 'POLICY_VIOLATION',
    title: "Violation des conditions d'utilisation",
    description: "Non-respect des conditions d'utilisation",
    message:
      "Votre compte a été supprimé pour violation de nos conditions d'utilisation ou de notre politique communautaire.",
  },
} as const

export type DeletionReasonCode = keyof typeof DELETION_REASONS

export interface AdminUser {
  id: number
  email: string
  emailHash: string
  pseudo: string
  nom: string
  prenom: string
  profilePicture: string | null
  isEmailVerified: boolean
  isGlobalAdmin: boolean
  createdAt: string
  _count: {
    createdConventions: number
    createdEditions: number
    favoriteEditions: number
    fcmTokens: number
  }
}

export const useUserDeletion = () => {
  const deleteUser = async (userId: number, reason: DeletionReasonCode) => {
    try {
      const response = await $fetch<{
        success: boolean
        message: string
        reason: string
        deletedUser: {
          id: number
          pseudo: string
        }
      }>(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        body: { reason },
      })

      return response
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error)
      throw error
    }
  }

  const getDeletionReasons = () => {
    return Object.values(DELETION_REASONS).map((reason) => ({
      label: reason.title,
      value: reason.code,
      description: reason.description,
    }))
  }

  const getDeletionReason = (code: DeletionReasonCode) => {
    return DELETION_REASONS[code] || null
  }

  return {
    deleteUser,
    getDeletionReasons,
    getDeletionReason,
    DELETION_REASONS,
  }
}
