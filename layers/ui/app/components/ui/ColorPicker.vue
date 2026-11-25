<template>
  <div class="space-y-3">
    <!-- Grille de pastilles prédéfinies -->
    <div :class="['grid gap-2', gridColsClass]">
      <button
        v-for="color in palette"
        :key="color"
        type="button"
        :title="color"
        :class="[
          sizeClass,
          'rounded-full border-2 shadow-sm hover:scale-110 transition-transform',
          modelValue === color
            ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 ring-gray-500'
            : 'border-gray-300',
          format === 'name' ? swatchClass(color) : '',
        ]"
        :style="format === 'hex' ? { backgroundColor: color } : undefined"
        @click="select(color)"
      />
    </div>

    <!-- Picker libre + champ hex (uniquement en format hex et si autorisé) -->
    <div v-if="format === 'hex' && allowCustom" class="flex items-center gap-3">
      <label class="block">
        <span class="sr-only">{{ customLabel || $t('common.color') }}</span>
        <input
          type="color"
          :value="modelValue"
          class="w-12 h-8 rounded border border-gray-300 cursor-pointer"
          @input="(e) => select((e.target as HTMLInputElement).value)"
        />
      </label>
      <UInput
        :model-value="modelValue"
        placeholder="#3b82f6"
        class="flex-1"
        pattern="^#[0-9A-Fa-f]{6}$"
        @update:model-value="(v) => select(String(v))"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** Couleur actuelle. Pour `format=hex` : `#RRGGBB`. Pour `format=name` : nom (ex: `red`). */
    modelValue: string
    /** Liste de couleurs prédéfinies. */
    palette: string[]
    /** Format des valeurs : `hex` (#RRGGBB) ou `name` (nom Tailwind). */
    format?: 'hex' | 'name'
    /** Nombre de colonnes dans la grille. */
    columns?: number
    /** Taille des pastilles. */
    size?: 'sm' | 'md'
    /** Affiche le color picker HTML5 + champ hex (format `hex` uniquement). */
    allowCustom?: boolean
    /** Label aria pour le picker libre. */
    customLabel?: string
    /**
     * Fonction qui retourne la classe Tailwind à appliquer pour une pastille
     * en mode `format=name`. Requis dans ce mode (sinon les pastilles n'ont
     * pas de couleur). Ex: `(c) => `bg-${c}-500`` (mais attention au purge —
     * préférer un mapping statique côté consommateur).
     */
    swatchClassFn?: (value: string) => string
  }>(),
  {
    format: 'hex',
    columns: 8,
    size: 'md',
    allowCustom: false,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const sizeClass = computed(() => (props.size === 'sm' ? 'w-6 h-6' : 'w-8 h-8'))

const gridColsClass = computed(() => {
  switch (props.columns) {
    case 4:
      return 'grid-cols-4'
    case 5:
      return 'grid-cols-5'
    case 6:
      return 'grid-cols-6'
    case 7:
      return 'grid-cols-7'
    case 8:
      return 'grid-cols-8'
    case 10:
      return 'grid-cols-10'
    case 12:
      return 'grid-cols-12'
    default:
      return 'grid-cols-8'
  }
})

function swatchClass(value: string): string {
  return props.swatchClassFn ? props.swatchClassFn(value) : ''
}

function select(value: string) {
  emit('update:modelValue', value)
}
</script>
