<template>
  <!--
    Un justificatif, réduit à un bouton.

    ⚠️ CE N'EST PAS UN CHAMP DE FORMULAIRE, et c'est tout l'intérêt. Posé en pleine page, un
    téléverseur occupe une colonne entière pour un geste qu'on fait une fois — et il poussait le
    montant qu'il accompagne hors de vue. Ici, il tient à côté de son montant : un bouton quand il
    n'y a rien, une pastille quand il y a quelque chose.

    📍 L'allure DIT L'ÉTAT. « Ajouter » en estompé invite ; « Justificatif » en pastille verte
    atteste. Deux boutons identiques auraient obligé à ouvrir la modale pour savoir si le document
    était déjà là.
  -->
  <div class="inline-flex">
    <UButton
      v-if="url"
      icon="i-heroicons-paper-clip"
      color="success"
      variant="soft"
      size="xs"
      @click="apercuOuvert = true"
    >
      {{ $t('artists.receipt_short') }}
    </UButton>
    <UButton
      v-else
      icon="i-heroicons-arrow-up-tray"
      color="neutral"
      variant="soft"
      size="xs"
      @click="ouvrirLEnvoi()"
    >
      {{ $t('artists.receipt_add') }}
    </UButton>

    <!-- Aperçu -->
    <UModal v-model:open="apercuOuvert" :title="$t('artists.receipt_view_title')">
      <template #body>
        <div class="space-y-4">
          <!--
            UN PDF S'OUVRE DANS UN ONGLET, où la visionneuse du navigateur fait tout ce qu'une
            `iframe` ne faisait qu'imiter : zoom, pages, impression, enregistrement. C'est elle qui
            était là, et son commentaire reconnaissait déjà le défaut — sur téléphone, beaucoup de
            navigateurs refusent d'incorporer un PDF et n'affichaient qu'un cadre vide.

            Pourquoi la modale subsiste quand même, au prix d'un clic de plus : c'est elle qui porte
            « Retirer » et « Remplacer ». Ouvrir l'onglet depuis la pastille les rendrait
            inatteignables — et une facture, elle, est presque toujours un PDF.
          -->
          <UButton
            v-if="estUnPdf"
            :to="url ?? undefined"
            target="_blank"
            rel="noopener"
            icon="i-heroicons-document-text"
            trailing-icon="i-heroicons-arrow-top-right-on-square"
            color="primary"
            variant="soft"
            block
            size="lg"
          >
            {{ $t('artists.receipt_open_new_tab') }}
          </UButton>
          <img
            v-else
            :src="url ?? undefined"
            :alt="$t('artists.receipt_view_title')"
            class="w-full max-h-[60vh] object-contain rounded-lg border border-gray-200 dark:border-gray-700"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-between gap-2">
          <UButton color="error" variant="soft" :loading="enCours" @click="retirer()">
            {{ $t('artists.receipt_remove') }}
          </UButton>
          <UButton color="primary" variant="soft" @click="ouvrirLEnvoi()">
            {{ $t('artists.receipt_replace') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Envoi -->
    <UModal v-model:open="envoiOuvert" :title="$t('artists.receipt_upload_title')">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ aide }}</p>

          <!--
            ⚠️ `brouillon` et non `url` : tant que la modale n'est pas validée, le fichier reste
            dans le dossier temporaire du serveur et la fiche n'est pas touchée. Lier directement
            l'URL enregistrée ferait qu'abandonner la modale laisserait quand même la fiche
            modifiée en mémoire, et le prochain enregistrement d'un autre champ l'écrirait.
          -->
          <UiImageUpload
            v-model="brouillon"
            allow-camera
            :endpoint="{ type: 'artist', id: editionId }"
            :options="{ validation: JUSTIFICATIF_ACCEPTE }"
            :alt="$t('artists.receipt_view_title')"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="envoiOuvert = false">
            {{ $t('common.cancel') }}
          </UButton>
          <UButton
            color="primary"
            :disabled="!brouillon"
            :loading="enCours"
            @click="enregistrer(brouillon)"
          >
            {{ $t('common.save') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { estUnJustificatifPdf } from '~~/shared/utils/justificatif-pdf'

/**
 * Les types acceptés.
 *
 * ⚠️ CE N'EST QUE LE SÉLECTEUR DE FICHIERS. La même liste est appliquée côté serveur par
 * `ALLOWED_RECEIPT_*` ; celle-ci ne fait qu'éviter de téléverser pour rien.
 *
 * 📍 PDF compris : beaucoup de billets de train n'existent que sous cette forme, et il faudrait
 * sinon en faire une capture d'écran.
 */
const JUSTIFICATIF_ACCEPTE = {
  maxSize: 10 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'],
}

const props = defineProps<{
  editionId: number
  /** L'URL enregistrée, ou `null` s'il n'y a pas encore de justificatif. */
  url: string | null
  /** Ce que ce justificatif doit contenir — un billet de train, un ticket de caisse. */
  aide: string
  /** Vrai pendant l'enregistrement mené par la page appelante. */
  enCours?: boolean
}>()

/**
 * `change` porte l'URL à enregistrer, ou `null` pour retirer.
 *
 * C'est la PAGE qui écrit : elle tient déjà la fiche de l'artiste et sait la rafraîchir. Un
 * composant qui enregistrerait lui-même aurait fabriqué un second chemin d'écriture, à garder en
 * accord avec le premier.
 */
const emit = defineEmits<{ change: [string | null] }>()

const apercuOuvert = ref(false)
const envoiOuvert = ref(false)
const brouillon = ref<string | null>(null)

// Le paramètre d'antémémoire est retiré avant de regarder l'extension : `…/billet.pdf?v=12` se
// termine par des chiffres, pas par « .pdf ».
const estUnPdf = computed(() => estUnJustificatifPdf(props.url))

function ouvrirLEnvoi() {
  // Repartir d'un brouillon vide, et non du justificatif en place : on vient remplacer.
  brouillon.value = null
  apercuOuvert.value = false
  envoiOuvert.value = true
}

function enregistrer(valeur: string | null) {
  emit('change', valeur)
  envoiOuvert.value = false
}

function retirer() {
  emit('change', null)
  apercuOuvert.value = false
}
</script>
