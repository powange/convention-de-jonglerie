<template>
  <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/40">
    <UiUserDisplay :user="personne" size="xs" />

    <!-- Deux lignes étiquetées plutôt qu'une flèche : « cède » et « reçoit » se lisent sans
         convention à deviner, et disent d'où part la personne autant que là où elle va. -->
    <dl class="mt-2 space-y-1 text-sm">
      <div class="flex gap-2">
        <dt class="shrink-0 font-medium text-gray-500">{{ t('volunteers.swap_gives') }}</dt>
        <dd class="min-w-0 text-gray-700 dark:text-gray-300">{{ horaire(cede) }}</dd>
      </div>
      <div class="flex gap-2">
        <dt class="shrink-0 font-medium text-emerald-700 dark:text-emerald-400">
          {{ t('volunteers.swap_receives') }}
        </dt>
        <dd class="min-w-0 text-gray-700 dark:text-gray-300">{{ horaire(recoit) }}</dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
interface Creneau {
  title?: string | null
  startDateTime: string
  endDateTime: string
}

defineProps<{
  personne: { id: number; pseudo: string; profilePicture?: string | null }
  cede: Creneau
  recoit: Creneau
}>()

const { t } = useI18n()

const horaire = (c: Creneau) => {
  const d = new Date(c.startDateTime)
  const f = new Date(c.endDateTime)
  const jour = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' })
  const heure = (x: Date) => x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${jour} · ${heure(d)} – ${heure(f)}${c.title ? ` · ${c.title}` : ''}`
}
</script>
