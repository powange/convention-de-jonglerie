<template>
  <div class="space-y-3">
    <UAlert
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="titre ?? t('pages.access_denied.title')"
      :description="description ?? t('pages.access_denied.description')"
    />

    <!--
      Le raccourci de l'administrateur, SOUS le message — et lui seul le voit. Pour tout autre
      visiteur, le refus reste un refus : rien n'est ajouté, rien ne laisse deviner qu'une porte
      existe ailleurs.

      ⚠️ POURQUOI CE BOUTON EST ÉCRIT ICI, ET NON PASSÉ EN PROP `actions` À L'ENCART.
      `UAlert` accepte bien une prop `actions`, documentée pour afficher des boutons « sous le
      titre et la description » — c'était la forme la plus naturelle. Mesuré : sous
      `mountSuspended`, un `UAlert` nourri de cette prop ne rend AUCUN bouton, et un `v-if` posé
      sur un slot `#actions` empêche carrément le slot d'être enregistré.
      Ce qui a tranché n'est pas l'esthétique : une règle portant sur des DROITS doit être
      éprouvable. Un bouton frère de l'encart se monte, se cherche et se clique dans un test ; une
      prop dont le rendu dépend d'un détail interne de la bibliothèque, non. À l'écran, le résultat
      est le même — un bouton sous le message.
    -->
    <UButton
      v-if="peutBasculerEnAdmin"
      color="error"
      variant="solid"
      icon="i-heroicons-shield-check"
      :label="t('pages.access_denied.enable_admin_mode')"
      :loading="bascule"
      :disabled="bascule"
      @click="basculerEnModeAdmin"
    />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

/**
 * « Vous n'avez pas accès à cette page » — dit d'une seule façon, partout.
 *
 * ⚠️ POURQUOI CE COMPOSANT EXISTE. Ce bloc était recopié dans 47 écrans, et pas à l'identique :
 * 44 passaient par un `UAlert` aux mêmes clés, trois par un simple paragraphe rouge, deux par un
 * titre `<h2>` dans une carte, et plusieurs portaient une autre icône. Y ajouter un bouton à la
 * main revenait à garantir qu'il manquerait dans quelques-uns — sans que personne ne s'en
 * aperçoive, puisque l'écran continuerait d'afficher un refus parfaitement normal.
 *
 * 📍 LE BOUTON N'EST PAS UNE DÉROGATION À CETTE PAGE. Le mode administrateur est un état GLOBAL,
 * qui vaut pour toute la navigation jusqu'à ce qu'on le coupe depuis le menu du compte. Le libellé
 * dit donc ce qu'il fait — « Activer le mode administrateur » — et non « Accéder », qui laisserait
 * croire à un passe-droit ponctuel.
 */
const { t } = useI18n()
const authStore = useAuthStore()

withDefaults(
  defineProps<{
    /** Remplace le titre par défaut. */
    titre?: string
    /** Remplace la description par défaut — deux écrans de bénévolat ont leur formulation. */
    description?: string
  }>(),
  { titre: undefined, description: undefined }
)

/**
 * Administrateur global qui n'a PAS encore activé son mode : le seul cas où le raccourci a un sens.
 *
 * Déjà en mode admin et toujours refusé ? Alors le refus ne vient pas des droits, et proposer la
 * bascule ferait recharger la page pour rien, encore et encore.
 */
const peutBasculerEnAdmin = computed(() => authStore.isGlobalAdmin && !authStore.adminMode)

/**
 * L'état de la bascule, et ce qu'il sert vraiment.
 *
 * ⚠️ IL NE S'AGIT PAS D'ORNEMENT. Le rechargement qui suit prend une seconde pendant laquelle
 * l'écran ne bouge pas : sans ce témoin, le clic paraît sans effet et on clique à nouveau.
 * Signalé à l'usage — « le bouton me recharge complètement la page » — et c'est bien le fait que
 * rien ne l'annonce qui surprend, pas le rechargement lui-même.
 *
 * 📍 Il garde aussi du double clic : `enableAdminMode` est idempotent, mais déclencher deux
 * rechargements l'est moins.
 */
const bascule = ref(false)

/**
 * ⚠️ UN RECHARGEMENT DUR, ET C'EST VOULU. `enableAdminMode()` pose un cookie que le SERVEUR lit :
 * tant que les données n'ont pas été redemandées avec lui, l'écran afficherait le même refus et le
 * bouton paraîtrait sans effet. Chacun des 47 écrans charge ses données à sa façon ; recharger est
 * la seule réponse qui vaille pour tous sans les toucher un par un.
 *
 * `window.location.reload()` plutôt que `reloadNuxtApp()` : ce dernier porte une garde anti-boucle
 * de dix secondes par chemin, qui refuserait un second clic. Un geste de l'utilisateur doit
 * toujours agir.
 *
 * 📍 POURQUOI PAS UNE SIMPLE BASCULE, SANS RECHARGER. Les permissions du store tiennent déjà
 * compte du mode admin : l'affichage basculerait instantanément. Mesuré pourtant, 16 des 47 écrans
 * chargent leurs données au montage SANS vérifier l'accès — leur requête a donc déjà essuyé un
 * 403, et la page s'ouvrirait avec des listes vides. Un écran qui a l'air de marcher et qui ment
 * est pire qu'une seconde d'attente. Rendre ces 16 écrans capables de recharger à l'ouverture de
 * l'accès est un lot à part, pas une ligne ici.
 */
function basculerEnModeAdmin() {
  if (bascule.value) return
  bascule.value = true
  authStore.enableAdminMode()
  window.location.reload()
}
</script>
