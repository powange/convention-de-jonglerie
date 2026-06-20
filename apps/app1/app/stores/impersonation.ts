import { defineStore } from 'pinia'

interface ImpersonationState {
  active: boolean
  originalUser: {
    id: number
    email: string
    pseudo: string
    nom: string
    prenom: string
  } | null
  targetUser: {
    id: number
    email: string
    pseudo: string
    nom: string
    prenom: string
  } | null
  startedAt: string | null
}

export const useImpersonationStore = defineStore('impersonation', {
  state: (): ImpersonationState => ({
    active: false,
    originalUser: null,
    targetUser: null,
    startedAt: null,
  }),

  getters: {
    isActive: (state) => state.active,

    originalUserInfo: (state) => state.originalUser,

    targetUserInfo: (state) => state.targetUser,

    displayInfo: (state) => {
      if (!state.active || !state.originalUser || !state.targetUser) {
        return null
      }

      return {
        impersonatingUser: state.targetUser,
        originalUser: state.originalUser,
        startedAt: state.startedAt,
      }
    },
  },

  actions: {
    startImpersonation(originalUser: any, targetUser: any) {
      this.active = true
      this.originalUser = {
        id: originalUser.id,
        email: originalUser.email,
        pseudo: originalUser.pseudo,
        nom: originalUser.nom,
        prenom: originalUser.prenom,
      }
      this.targetUser = {
        id: targetUser.id,
        email: targetUser.email,
        pseudo: targetUser.pseudo,
        nom: targetUser.nom,
        prenom: targetUser.prenom,
      }
      this.startedAt = new Date().toISOString()
    },

    stopImpersonation() {
      this.active = false
      this.originalUser = null
      this.targetUser = null
      this.startedAt = null
    },

    // Méthode pour initialiser depuis les données de session (si nécessaire)
    initFromSession(sessionData: any) {
      if (sessionData?.impersonation?.active) {
        this.active = true
        this.originalUser = {
          id: sessionData.impersonation.originalUserId,
          email: sessionData.impersonation.originalUserEmail,
          pseudo: sessionData.impersonation.originalUserPseudo,
          nom: sessionData.impersonation.originalUserNom,
          prenom: sessionData.impersonation.originalUserPrenom,
        }
        this.targetUser = {
          id: sessionData.user.id,
          email: sessionData.user.email,
          pseudo: sessionData.user.pseudo,
          nom: sessionData.user.nom,
          prenom: sessionData.user.prenom,
        }
        this.startedAt = sessionData.impersonation.startedAt
      } else {
        this.stopImpersonation()
      }
    },
  },
})
