<template>
  <span>{{ formattedName }}</span>
</template>

<script setup lang="ts">
import { formatUserFullName } from '~/utils/pronouns'

interface User {
  prenom?: string | null
  nom?: string | null
  pronouns?: string | null
}

interface Props {
  user?: User | null
}

const props = defineProps<Props>()

const { t } = useI18n()

/**
 * Affiche « Prénom Nom (pronom) ». Le pronom n'apparaît que s'il est renseigné,
 * sinon seul « Prénom Nom » est rendu. Voir `formatUserFullName`.
 */
const formattedName = computed(() => formatUserFullName(props.user, t))
</script>
