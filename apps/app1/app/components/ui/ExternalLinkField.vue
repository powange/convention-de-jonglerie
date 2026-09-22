<!--
  Un champ d'adresse, avec de quoi aller voir où il mène.

  Les cinq liens de la page des liens externes — site officiel, billetterie, programme, Facebook,
  Instagram — posaient la même question à qui les remplit : « est-ce que j'ai collé la bonne
  adresse ? » Il fallait sélectionner le texte, le copier, ouvrir un onglet, coller. Le bouton
  fait les quatre.

  Il est DANS le champ, par son emplacement de fin, plutôt qu'à côté : les bordures restent celles
  d'un seul élément, l'alignement ne bouge pas d'un champ à l'autre, et la largeur du formulaire
  n'a pas à se partager entre deux blocs.
-->
<template>
  <UInput
    v-model="texte"
    type="url"
    :placeholder="placeholder"
    class="w-full"
    @blur="texte = texte.trim()"
  >
    <template v-if="icone" #leading>
      <UIcon :name="icone" :class="classeIcone" />
    </template>

    <template #trailing>
      <!-- L'infobulle porte `text` et non `content` : avec la mauvaise propriété, elle reste
           muette, et un bouton réduit à son icône n'annonce plus rien. -->
      <UTooltip :text="t('common.open_in_new_tab')">
        <UButton
          :aria-label="t('common.open_in_new_tab')"
          icon="i-heroicons-arrow-top-right-on-square"
          color="neutral"
          variant="ghost"
          size="xs"
          :disabled="!ouvrable"
          @click="ouvrir"
        />
      </UTooltip>
    </template>
  </UInput>
</template>

<script setup lang="ts">
import { estUnLienHttp } from '~/utils/lien-externe'

defineProps<{
  /** L'icône de tête, celle qui dit de quel lien il s'agit. */
  icone?: string
  /** Sa couleur, quand la marque en impose une — le bleu de Facebook, le rose d'Instagram. */
  classeIcone?: string
  placeholder?: string
}>()

const valeur = defineModel<string | null | undefined>({ default: '' })

/**
 * Le champ reçoit toujours une CHAÎNE.
 *
 * `UInput` n'accepte pas `null`, alors que les liens d'une édition sont nullables en base et que
 * les appelants les lient tels quels. La conversion se fait donc ici, une fois, plutôt que chez
 * chacun des cinq champs.
 */
const texte = computed({
  get: () => valeur.value ?? '',
  set: (v: string) => {
    valeur.value = v
  },
})

const { t } = useI18n()

/**
 * Le bouton reste éteint tant qu'il n'y a rien à ouvrir.
 *
 * Un champ vide, une adresse sans protocole — « www.exemple.org », ce qu'on colle le plus
 * souvent — ou autre chose qu'un lien http : ouvrir un onglet vide ou introuvable ferait douter
 * du bouton plutôt que du lien.
 */
const ouvrable = computed(() => estUnLienHttp(valeur.value))

/**
 * `noopener` n'est pas une formalité : sans lui, la page ouverte garde une prise sur celle qui
 * l'a ouverte, par la référence que le navigateur lui laisse — et cette page-ci est une page de
 * gestion authentifiée. Le lien, lui, vient d'un tiers qui remplit un formulaire.
 *
 * (Le nom de cette référence n'est pas écrit entre accents graves à dessein : check-i18n prend
 * tout chemin pointé ainsi encadré pour une clé de traduction manquante, commentaires compris.)
 */
function ouvrir() {
  if (!ouvrable.value) return
  window.open((valeur.value ?? '').trim(), '_blank', 'noopener,noreferrer')
}
</script>
