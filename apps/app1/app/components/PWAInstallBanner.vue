<template>
  <!--
    ⚠️ UN BANDEAU, PLUS UNE MODALE. L'invitation s'affichait dans une `UModal` cinq secondes après
    l'événement du navigateur, par-dessus n'importe quelle page — donc au milieu d'une candidature
    de bénévole, d'un profil en cours d'édition, ou d'un scan de billets au guichet. Les cinq
    secondes sont exactement le temps qu'il faut pour commencer à taper.

    Le bandeau est `fixed` et ne capte ni le focus ni les clics ailleurs que sur ses deux boutons.
    En bas de l'écran sur mobile, il ne recouvre rien de ce qu'on est en train de lire ; sur
    ordinateur, il se range dans le coin.

    `UBanner` n'a pas été retenu malgré son nom : il s'affiche en HAUT du site, par conception, et
    pousse le contenu vers le bas — ce qui déplacerait la page sous les doigts de quelqu'un en
    train de la lire. `UAlert` dans un conteneur positionné donne exactement ce qu'on veut.
  -->
  <ClientOnly>
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div
        v-if="afficherLeBandeau"
        class="fixed inset-x-0 bottom-0 z-40 p-4 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm"
      >
        <UAlert
          :title="$t('pwa.install.title')"
          :description="$t('pwa.install.description')"
          icon="i-heroicons-arrow-down-tray"
          color="primary"
          variant="subtle"
          class="shadow-lg"
          :close="{ 'aria-label': $t('pwa.install.later') }"
          :actions="[
            {
              label: $t('pwa.install.button'),
              color: 'primary',
              onClick: () => installer(),
            },
            {
              label: $t('pwa.install.later'),
              color: 'neutral',
              variant: 'ghost',
              onClick: () => reporter(),
            },
          ]"
          @update:open="reporter()"
        />
      </div>
    </Transition>
  </ClientOnly>
</template>

<script setup lang="ts">
/**
 * L'invitation à installer l'application.
 *
 * Toute la décision — événement du navigateur, report de sept jours, écrans exclus — vit dans
 * `useInvitePwa`, partagé avec l'entrée du menu utilisateur. Le navigateur n'émet
 * `beforeinstallprompt` QU'UNE FOIS : deux composants qui l'écouteraient séparément se
 * disputeraient le même événement, et le second n'aurait jamais rien.
 */
const { afficherLeBandeau, installer, reporter, ecouterLeNavigateur } = useInvitePwa()

// Ce composant est monté par le composant racine de l'application, donc sur toutes les pages :
// c'est le seul endroit d'où l'on peut garantir que l'événement du navigateur ne sera pas manqué.
// (Le chemin du fichier n'est pas écrit entre accents graves : `check-i18n` lit un mot pointé
// ainsi comme une clé de traduction manquante — quatrième fois que ce faux positif se présente.)
onMounted(ecouterLeNavigateur)
</script>
