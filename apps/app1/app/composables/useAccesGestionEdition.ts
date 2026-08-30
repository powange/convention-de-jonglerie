import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import type { Edition } from '~/types'

import type { MaybeRefOrGetter } from 'vue'

/**
 * L'utilisateur peut-il ouvrir la gestion de cette édition ?
 *
 * Deux endroits posent la question : le bouton « Gestion » de l'en-tête, et l'entrée du même
 * nom dans le panneau de navigation mobile. Une seconde implémentation finirait par diverger —
 * et un menu qui propose une porte fermée vaut moins que pas de menu du tout.
 *
 * La réponse se construit en deux temps :
 *
 * 1. **des critères synchrones**, lisibles dans l'édition déjà chargée : créateur, mode
 *    administrateur, droits d'édition ou de gestion des bénévoles, appartenance aux
 *    organisateurs de la convention ;
 * 2. **un repli côté serveur**, seulement si les premiers n'ont rien donné : responsable
 *    d'équipe, validation des repas, ou créneau actif de contrôle d'accès. Ces trois-là ne se
 *    déduisent pas de l'édition, et le second dépend même de l'heure qu'il est.
 *
 * L'appel réseau n'a lieu que dans le second cas, pour ne pas le payer quand la réponse est
 * déjà connue.
 */
export function useAccesGestionEdition(edition: MaybeRefOrGetter<Edition | null | undefined>) {
  const authStore = useAuthStore()
  const editionStore = useEditionStore()

  const accesBenevole = ref(false)

  const accesSynchrone = computed(() => {
    const ed = toValue(edition)
    if (!ed || !authStore.user?.id) return false

    // Les administrateurs globaux en mode admin passent partout
    if (authStore.isAdminModeActive) return true

    // Et gardent la main sur les conventions orphelines, qui n'ont plus d'auteur pour le faire
    if (authStore.user.isGlobalAdmin && !ed.convention?.authorId) return true

    if (authStore.user.id === ed.creatorId) return true

    if (
      editionStore.canEditEdition(ed, authStore.user.id) ||
      editionStore.canManageVolunteers(ed, authStore.user.id)
    ) {
      return true
    }

    // Tout organisateur de la convention, même sans droit particulier
    return Boolean(
      ed.convention?.organizers?.some((collab) => collab.user.id === authStore.user?.id)
    )
  })

  watch(
    [() => authStore.isAuthenticated, () => toValue(edition)?.id, accesSynchrone],
    async ([authentifie, editionId, dejaAutorise]) => {
      if (!authentifie || !authStore.user?.id || !editionId || dejaAutorise) {
        accesBenevole.value = false
        return
      }

      const acces = await editionStore.getManagementAccess(editionId)
      accesBenevole.value =
        acces.isTeamLeader || acces.canAccessMealValidation || acces.isAccessControlActive
    },
    { immediate: true }
  )

  return {
    peutAcceder: computed(() => accesSynchrone.value || accesBenevole.value),
  }
}
