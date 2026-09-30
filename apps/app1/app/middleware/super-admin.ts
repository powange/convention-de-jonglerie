import { useAuthStore } from '~/stores/auth'

/**
 * Réserve une page aux super-administrateurs.
 *
 * ⚠️ IL ATTEND LA SESSION LUI-MÊME, et ne l'a pas toujours fait. Il lisait `isAuthenticated` de
 * façon SYNCHRONE : au rechargement d'une page en `ssr: false`, le greffon `auth.client` a bien
 * lancé la requête de session mais sans l'attendre, si bien que le store est encore vide. Le
 * middleware renvoyait alors vers `/login?returnTo=…` — où `guest-only` trouvait la session
 * valide et renvoyait vers l'accueil. Un administrateur connecté qui rechargeait la page, ou
 * l'ouvrait depuis un favori, atterrissait sur l'accueil sans le moindre message.
 *
 * Quatorze pages d'administration s'en sortaient parce qu'elles déclarent `auth-protected` AVANT
 * celui-ci, et que c'est lui qui attend. `/admin/feedback` ne le déclarait pas. Les deux causes
 * sont corrigées : la page est alignée, ET ce middleware n'en dépend plus.
 *
 * Attendre ici ne coûte rien quand `auth-protected` est passé avant : `sessionVerifiee` est déjà
 * vrai, et `initializeAuth` n'est pas rappelé.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.client) {
    const authStore = useAuthStore()

    if (!authStore.sessionVerifiee) {
      await authStore.initializeAuth()
    }

    if (!authStore.isAuthenticated) {
      // Avec la destination : sans elle, un administrateur dont la session a expiré se
      // reconnecte et retombe sur l'accueil, à charge pour lui de refaire son chemin.
      const { buildLoginUrl } = useReturnTo()
      return navigateTo(buildLoginUrl(to.fullPath))
    }

    if (!authStore.user?.isGlobalAdmin) {
      throw createError({
        status: 403,
        message: 'Accès refusé - Droits super administrateur requis',
      })
    }
  }
})
