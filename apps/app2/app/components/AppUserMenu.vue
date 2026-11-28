<template>
  <UDropdownMenu :items="userMenuItems">
    <!-- Sur téléphone, l'avatar seul : un pseudo long poussait la barre hors de l'écran. -->
    <UButton
      :label="user?.pseudo || user?.email"
      :avatar="avatar"
      trailing-icon="i-heroicons-chevron-down"
      color="neutral"
      variant="soft"
      :aria-label="`Menu du compte ${user?.pseudo || user?.email || ''}`"
      :ui="{ label: 'max-sm:hidden', trailingIcon: 'max-sm:hidden' }"
    />
  </UDropdownMenu>
</template>

<script setup lang="ts">
/**
 * Le menu du compte connecté : sa photo (ou ses initiales), son pseudo, et l'accès au profil, au
 * tableau de bord, aux tarifs, à l'administration, et la déconnexion. Partagé par l'en-tête du site
 * (`AppHeader`) et par la barre de la gestion d'un événement (layout `edition-dashboard`) : on y
 * voit toujours avec quel compte on est connecté.
 */
import type { DropdownMenuItem } from '@nuxt/ui'

const { loggedIn, user, clear } = useUserSession()
// L'état d'invitation est partagé avec le bandeau (`useInvitePwa`, layer ui).
const { entreeDeMenuDisponible, installer: installerLApplication } = useInvitePwa()
const applicationEvenement = useApplicationEvenement()
const route = useRoute()
// Sur la page d'un événement, le navigateur propose d'installer l'application de CET événement ;
// ailleurs, rien ne s'installe.
const surUnEvenement = computed(() => !!evenementDuChemin(route.path))
const toast = useToast()

/*
 * L'avatar du menu : la photo de profil (déposée, ou reprise de Google / Facebook), sinon les
 * initiales du pseudo. La session ne porte pas la photo (cf. layers/auth/shared/utils/
 * utilisateur-de-session.ts) : on la lit dans le profil, partagé avec l'espace « Mon profil »
 * (même clé), si bien qu'une photo changée là-bas se voit ici sans rechargement.
 */
const { data: profil } = useProfil({ immediate: loggedIn.value, watch: [loggedIn] })
const { getUserAvatar } = useAvatar()
const avatar = computed(() => ({
  src: profil.value?.profilePicture
    ? getUserAvatar({ id: profil.value.id, profilePicture: profil.value.profilePicture }, 64)
    : undefined,
  alt: user.value?.pseudo || user.value?.email || '',
}))

async function logout() {
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
  } finally {
    await clear()
    toast.add({ title: 'Déconnexion réussie', icon: 'i-heroicons-check-circle', color: 'success' })
    // Dans l'application d'un événement, la reconnexion y ramène.
    await navigateTo(
      applicationEvenement.value
        ? `/login?returnTo=${encodeURIComponent(`/events/${applicationEvenement.value}/app`)}`
        : '/login'
    )
  }
}

const userMenuItems = computed<DropdownMenuItem[][]>(() => [
  [{ label: user.value?.email ?? '', type: 'label' }],
  [
    { label: 'Mon profil', icon: 'i-heroicons-user', to: '/profile' },
    // L'application d'un événement n'ouvre que lui : ni tableau de bord, ni tarifs, ni administration.
    ...(applicationEvenement.value
      ? []
      : [
          { label: 'Tableau de bord', icon: 'i-heroicons-squares-2x2', to: '/dashboard' },
          { label: 'Tarifs', icon: 'i-heroicons-credit-card', to: '/pricing' },
          // Réservé aux administrateurs ; les pages et l'API le revérifient (server/utils/administration.ts).
          ...((user.value as { isGlobalAdmin?: boolean } | null)?.isGlobalAdmin
            ? [{ label: 'Administration', icon: 'i-heroicons-shield-check', to: '/admin' }]
            : []),
        ]),
  ],
  // Installer l'application, quand le navigateur le propose : le bandeau ne se présente qu'une
  // fois puis se tait sept jours, et ce geste volontaire doit rester possible (comme dans app1).
  // Sur la page d'un événement seulement : Flowvent lui-même ne s'installe plus.
  ...(entreeDeMenuDisponible.value && surUnEvenement.value
    ? [
        [
          {
            label: "Installer l'application de l'événement",
            icon: 'i-heroicons-arrow-down-tray',
            onSelect: () => installerLApplication(),
          },
        ],
      ]
    : []),
  [{ label: 'Se déconnecter', icon: 'i-heroicons-arrow-right-on-rectangle', onSelect: logout }],
])
</script>
