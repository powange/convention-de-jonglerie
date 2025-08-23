import { defineStore } from 'pinia'

import type { User } from '~/types'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    rememberMe: false,
    adminMode: false,
  }),
  getters: {
    isAuthenticated: (state) => {
      return !!state.user
    },
    isGlobalAdmin: (state) => {
      return state.user?.isGlobalAdmin || false
    },
    isAdminModeActive: (state) => {
      return state.user?.isGlobalAdmin && state.adminMode
    },
  },
  actions: {
    async register(email: string, password: string, pseudo: string, nom: string, prenom: string) {
      const response = await $fetch('/api/auth/register', {
        method: 'POST',
        body: { email, password, pseudo, nom, prenom },
      })
      return response
    },
    async login(identifier: string, password: string, rememberMe: boolean = false) {
      const response = await $fetch<{ user: User }>('/api/auth/login', {
        method: 'POST',
        body: { identifier, password },
      })

      this.user = response.user
      this.rememberMe = rememberMe

      // Mémoriser l’utilisateur si nécessaire (pure UX; l’auth reste en session serveur)
      if (import.meta.client) {
        const storage = rememberMe ? localStorage : sessionStorage
        storage.setItem('authUser', JSON.stringify(response.user))
        storage.setItem('rememberMe', String(rememberMe))
      }

      return response
    },
    async logout() {
      try {
        await $fetch('/api/auth/logout', { method: 'POST' })
      } catch {
        // ignore network/log out errors
      }
      this.user = null
      this.rememberMe = false
      this.adminMode = false

      if (import.meta.client) {
        // Nettoyer les deux storages
        localStorage.removeItem('authUser')
        localStorage.removeItem('rememberMe')
        localStorage.removeItem('adminMode')
        sessionStorage.removeItem('authUser')
        sessionStorage.removeItem('rememberMe')
        sessionStorage.removeItem('adminMode')
      }
    },
    initializeAuth() {
      if (import.meta.client) {
        // Hydrater depuis la session serveur
        $fetch<{ user: User }>('/api/session/me')
          .then((res) => {
            this.user = res.user
            const storage =
              localStorage.getItem('rememberMe') === 'true' ? localStorage : sessionStorage
            storage.setItem('authUser', JSON.stringify(res.user))
          })
          .catch(() => {
            this.user = null
          })
      }
    },

    updateUser(updatedUser: Partial<User>) {
      if (this.user) {
        this.user = { ...this.user, ...updatedUser }

        // Mettre à jour le localStorage/sessionStorage
        if (import.meta.client) {
          const storage = this.rememberMe ? localStorage : sessionStorage
          storage.setItem('authUser', JSON.stringify(this.user))
        }
      }
    },

    enableAdminMode() {
      if (this.user?.isGlobalAdmin) {
        this.adminMode = true
        // Sauvegarder l'état du mode admin
        if (import.meta.client) {
          const storage = this.rememberMe ? localStorage : sessionStorage
          storage.setItem('adminMode', 'true')
        }
      }
    },

    disableAdminMode() {
      this.adminMode = false
      // Supprimer l'état du mode admin
      if (import.meta.client) {
        localStorage.removeItem('adminMode')
        sessionStorage.removeItem('adminMode')
      }
    },
  },
})
