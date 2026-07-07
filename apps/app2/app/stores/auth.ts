import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import type { AuthUser } from '~/types'

/**
 * Store d'authentification d'app2.
 *
 * L'authentification réelle est portée par la session scellée `nuxt-auth-utils`
 * (`useUserSession()`). Ce store en expose une vue réactive et mutable pour les
 * pages/middleware du layer d'auth partagé (`layers/auth`), qui consomment
 * `user`, `isAuthenticated`, `login`, `updateUser`, etc.
 */
export const useAuthStore = defineStore('auth', () => {
  // Session nuxt-auth-utils : source de vérité de l'authentification.
  const { user: sessionUser, loggedIn, fetch: fetchSession } = useUserSession()

  // Copie locale et mutable de l'utilisateur, initialisée depuis la session.
  // Le layer affecte directement `authStore.user = ...` (ex. verify-email).
  const user = ref<AuthUser | null>((sessionUser.value as AuthUser | null) ?? null)

  // Garder l'utilisateur local synchronisé avec la session serveur.
  watch(
    sessionUser,
    (value) => {
      user.value = (value as AuthUser | null) ?? null
    },
    { immediate: true }
  )

  const isAuthenticated = computed(() => !!user.value || loggedIn.value)

  /**
   * Connexion par email/mot de passe.
   * Appelle l'API de login, rafraîchit la session nuxt-auth-utils, puis met à
   * jour l'utilisateur local.
   */
  async function login(email: string, password: string, rememberMe = false) {
    const response = await $fetch<{ user?: AuthUser; data?: { user?: AuthUser } }>(
      '/api/auth/login',
      {
        method: 'POST',
        // `email` et `identifier` couvrent les deux formes d'API possibles
        // (app2 attend `email`, le layer partagé peut attendre `identifier`).
        body: { email, identifier: email, password, rememberMe },
      }
    )

    // Rafraîchir la session scellée depuis le serveur.
    await fetchSession()

    // Mettre à jour l'utilisateur local depuis la réponse ou la session.
    const loggedUser =
      response?.data?.user ?? response?.user ?? (sessionUser.value as AuthUser | null)
    if (loggedUser) {
      user.value = loggedUser
    }

    return response
  }

  /**
   * Déconnexion : efface la session serveur puis le state local.
   */
  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Ignorer les erreurs réseau lors de la déconnexion.
    }
    await fetchSession()
    user.value = null
  }

  /**
   * Fusionne des champs dans l'utilisateur courant (ex. mise à jour du profil).
   */
  function updateUser(data: Partial<AuthUser>) {
    user.value = user.value ? { ...user.value, ...data } : ({ ...data } as AuthUser)
  }

  return {
    user,
    isAuthenticated,
    login,
    logout,
    updateUser,
  }
})
