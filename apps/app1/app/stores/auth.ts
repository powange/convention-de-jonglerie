import { defineStore } from 'pinia'

import type { User } from '~/types'

import { useImpersonationStore } from './impersonation'

/**
 * Le serveur a-t-il refusé la session, ou n'a-t-il simplement rien dit ?
 *
 * `$fetch` lève dans les deux cas, et les confondre est précisément le défaut qu'on corrige :
 * un 401 est une réponse — la session n'existe plus —, alors qu'une coupure réseau, un 502
 * pendant un déploiement ou un 500 ne disent rien de l'état de la session.
 *
 * Seul le 401 vaut donc déconnexion. Tout le reste laisse l'état en suspens, et sera rejoué.
 */
function sessionRefusee(erreur: unknown): boolean {
  const e = erreur as
    | { statusCode?: number; status?: number; response?: { status?: number } }
    | undefined
  return (e?.statusCode ?? e?.status ?? e?.response?.status) === 401
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    rememberMe: false,
    adminMode: false,
    /**
     * La requête d'hydratation en cours, partagée par tous ceux qui la réclament.
     *
     * Le greffon `auth.client` lance `initializeAuth()` sans l'attendre, et le middleware
     * `auth-protected` s'exécute dans la foulée, alors que le store est encore vide : il
     * ouvrait donc un SECOND appel à `/api/session/me`. Mesuré au chargement de `/profile`
     * sur le serveur de développement — deux appels quand le stockage du navigateur ne
     * contient pas d'`authUser`, un seul quand il en contient un.
     *
     * Chaque appel coûte deux requêtes en base côté serveur : la vérification d'existence du
     * middleware d'authentification, puis le `findUnique` du gestionnaire.
     *
     * Remise à `null` une fois la requête retombée, pour qu'une ré-hydratation ultérieure —
     * après une invitation acceptée, par exemple — reparte bien du serveur.
     */
    hydratation: null as Promise<void> | null,
    /**
     * Le serveur a-t-il tranché sur l'état de la session ?
     *
     * Vrai dès qu'il a répondu — qu'il ait rendu un utilisateur ou un 401. Faux tant qu'on n'a
     * que des suppositions : premier chargement, ou requête qui n'a jamais abouti.
     *
     * C'est cette distinction qui porte le reste. Auparavant, un `catch` sans condition vidait
     * l'utilisateur et le middleware renvoyait vers la connexion : une coupure réseau
     * déconnectait donc visuellement quelqu'un dont le cookie était parfaitement intact. Une
     * webapp installée démarre à froid, souvent avant que le système ait rétabli le réseau, et
     * le service worker lui sert la page depuis son cache — l'écran paraît normal pendant que
     * l'appel de session part dans le vide. C'est le défaut signalé sous Windows 11.
     */
    sessionVerifiee: false,
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
    isVolunteer: (state) => {
      return state.user?.isVolunteer || false
    },
    isArtist: (state) => {
      return state.user?.isArtist || false
    },
    isOrganizer: (state) => {
      return state.user?.isOrganizer || false
    },
    hasCategory: (state) => (category: 'volunteer' | 'artist' | 'organizer') => {
      if (category === 'volunteer') return state.user?.isVolunteer || false
      if (category === 'artist') return state.user?.isArtist || false
      if (category === 'organizer') return state.user?.isOrganizer || false
      return false
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
      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { identifier, password, rememberMe },
      })

      this.user = (response as any).data.user
      this.rememberMe = rememberMe
      // Le serveur vient de la créer : il n'y a plus rien à confirmer.
      this.sessionVerifiee = true

      // Mémoriser l'utilisateur si nécessaire (pure UX; l'auth reste en session serveur)
      if (import.meta.client) {
        const storage = rememberMe ? localStorage : sessionStorage
        storage.setItem('authUser', JSON.stringify((response as any).data.user))
        storage.setItem('rememberMe', String(rememberMe))
      }

      return response
    },
    async logout() {
      // IMPORTANT: D'abord effacer la session serveur, PUIS nettoyer le store
      try {
        await $fetch('/api/auth/logout', { method: 'POST' })
      } catch {
        // ignore network/log out errors
      }

      // Ensuite nettoyer le state local
      this.user = null
      this.rememberMe = false
      this.adminMode = false
      // On sait qu'il n'y a plus de session : inutile d'aller le redemander.
      this.sessionVerifiee = true

      if (import.meta.client) {
        // Nettoyer les deux storages
        localStorage.removeItem('authUser')
        localStorage.removeItem('rememberMe')
        localStorage.removeItem('adminMode')
        sessionStorage.removeItem('authUser')
        sessionStorage.removeItem('rememberMe')
        sessionStorage.removeItem('adminMode')
        // Effacer le cookie admin-mode
        document.cookie = 'admin-mode=; path=/; SameSite=Lax; Secure; max-age=0'
      }
    },
    initializeAuth(): Promise<void> {
      if (!import.meta.client) return Promise.resolve()

      // Une requête déjà partie répond à la même question : l'attendre plutôt que d'en ouvrir
      // une seconde.
      if (this.hydratation) return this.hydratation

      // Hydrater depuis la session serveur
      const hydratation = $fetch('/api/session/me', {
        // `ofetch` rejoue de lui-même certaines réponses — dont 500, 502, 503 — une fois. Sur
        // une requête qui part à chaque chargement de page, cela double en silence le coût de
        // chaque panne, et rend la reprise impossible à observer. La politique est désormais
        // portée ici et là seulement : une seconde chance dans `auth-protected`, puis une
        // reprise au retour du réseau dans le greffon `auth.client`.
        retry: 0,
      })
        .then((res) => {
          this.user = res.user
          this.sessionVerifiee = true
          const storage =
            localStorage.getItem('rememberMe') === 'true' ? localStorage : sessionStorage
          storage.setItem('authUser', JSON.stringify(res.user))

          // Restaurer le mode admin s'il était activé
          const adminModeStored = storage.getItem('adminMode')
          if (adminModeStored === 'true' && res.user.isGlobalAdmin) {
            this.adminMode = true
            // Re-set le cookie pour synchroniser le serveur (au cas où il
            // aurait été effacé entre-temps).
            document.cookie = `admin-mode=true; path=/; SameSite=Lax; Secure; max-age=${60 * 60 * 24 * 30}`
          } else {
            // S'assurer que le cookie est bien effacé si le mode n'est pas actif.
            document.cookie = 'admin-mode=; path=/; SameSite=Lax; Secure; max-age=0'
          }

          // Toujours synchroniser le store d'impersonation avec la session
          const impersonationStore = useImpersonationStore()
          impersonationStore.initFromSession(res)
        })
        .catch((erreur: unknown) => {
          if (!sessionRefusee(erreur)) {
            // Le serveur n'a rien dit de la session. Garder ce qu'on a — la copie relue par le
            // middleware, ou l'utilisateur d'une hydratation précédente — et laisser
            // `sessionVerifiee` à faux : le greffon rejouera la requête au retour du réseau.
            return
          }

          this.user = null
          this.sessionVerifiee = true

          // Purger la copie locale. Sans cela, le middleware la relit au passage suivant et
          // rouvre une page protégée sur une session morte : la personne voit alors un écran
          // dont tous les blocs échouent, au lieu de la page de connexion.
          localStorage.removeItem('authUser')
          sessionStorage.removeItem('authUser')
        })
        .finally(() => {
          this.hydratation = null
        })

      this.hydratation = hydratation
      return hydratation
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
          // Cookie auto-envoyé par le navigateur pour que le serveur sache que
          // le mode admin est actif (le plugin d'interception $fetch n'est pas
          // fiable en Nuxt 4 selon le contexte d'auto-import).
          document.cookie = `admin-mode=true; path=/; SameSite=Lax; Secure; max-age=${60 * 60 * 24 * 30}`
        }
      }
    },

    disableAdminMode() {
      this.adminMode = false
      // Supprimer l'état du mode admin
      if (import.meta.client) {
        localStorage.removeItem('adminMode')
        sessionStorage.removeItem('adminMode')
        // Effacer le cookie en le faisant expirer.
        document.cookie = 'admin-mode=; path=/; SameSite=Lax; Secure; max-age=0'
      }
    },
  },
})
