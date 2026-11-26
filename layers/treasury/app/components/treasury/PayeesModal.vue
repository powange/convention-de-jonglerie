<template>
  <UModal v-model:open="isOpen" :title="$t('gestion.treasury.manage_payees')">
    <template #body>
      <div class="space-y-4">
        <UAlert
          icon="i-lucide-info"
          color="info"
          variant="subtle"
          :description="$t('gestion.treasury.payees_help')"
        />

        <!-- Saisie d'un nouveau bénéficiaire. Le libellé seul suffit : on peut vouloir suivre ce
             qu'on doit à quelqu'un avant d'avoir son RIB, et l'exiger ferait renoncer à
             enregistrer la dette. -->
        <div class="space-y-2">
          <UInput
            v-model="nouveauLibelle"
            data-payee-label="true"
            :placeholder="$t('gestion.treasury.payee_label_placeholder')"
            maxlength="150"
            class="w-full"
          />
          <div class="flex flex-col gap-2 sm:flex-row">
            <UInput
              v-model="nouvelIban"
              :placeholder="$t('gestion.treasury.payee_iban_placeholder')"
              maxlength="42"
              class="flex-1 font-mono"
            />
            <UInput
              v-model="nouveauBic"
              :placeholder="$t('gestion.treasury.payee_bic_placeholder')"
              maxlength="11"
              class="sm:w-32 font-mono"
            />
            <UButton
              icon="i-heroicons-plus"
              :loading="creation"
              :disabled="!peutCreer"
              :label="$t('common.add')"
              @click="ajouter"
            />
          </div>

          <!-- Signalé, pas bloqué : une clé qui ne tombe pas juste est presque toujours une faute
               de frappe, mais le format des comptes varie d'un pays à l'autre et refuser
               empêcherait d'enregistrer un compte valide que l'on ne sait pas vérifier. -->
          <p
            v-if="nouvelIban.trim() && !ibanPlausible"
            class="text-xs text-amber-600 dark:text-amber-400"
          >
            {{ $t('gestion.treasury.payee_iban_suspect') }}
          </p>
        </div>

        <div v-if="payees.length" class="divide-y divide-gray-200 dark:divide-gray-800">
          <div
            v-for="payee in payees"
            :key="payee.id"
            class="flex items-start gap-3 py-2"
            data-payee="true"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">{{ payee.label }}</p>
              <!-- L'IBAN est affiché PAR GROUPES de quatre, comme sur un relevé : c'est ainsi
                   qu'on le relit pour le comparer. Il reste stocké sans espaces. -->
              <p v-if="payee.iban" class="truncate font-mono text-xs text-gray-500">
                {{ formaterIbanParGroupes(payee.iban) }}
                <span v-if="payee.bic"> · {{ payee.bic }}</span>
              </p>
              <p v-else class="text-xs text-gray-400 italic">
                {{ $t('gestion.treasury.payee_no_iban') }}
              </p>
            </div>
            <UButton
              :aria-label="$t('common.delete')"
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              :loading="suppression.isLoading(payee.id)"
              @click="demanderSuppression(payee)"
            />
          </div>
        </div>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('gestion.treasury.no_payees_yet') }}
        </p>
      </div>
    </template>
  </UModal>

  <UiConfirmModal
    v-model="suppressionOuverte"
    :title="$t('gestion.treasury.payee_delete_title')"
    :description="
      payeeASupprimer
        ? `${payeeASupprimer.label}\n\n${$t('gestion.treasury.payee_delete_confirm')}`
        : ''
    "
    :confirm-label="$t('common.delete')"
    confirm-color="error"
    confirm-icon="i-lucide-trash-2"
    icon-name="i-lucide-triangle-alert"
    icon-color="text-red-500"
    :loading="payeeASupprimer ? suppression.isLoading(payeeASupprimer.id) : false"
    @confirm="confirmerSuppression"
  />
</template>

<script setup lang="ts">
import { formaterIbanParGroupes, ibanEstPlausible } from '#core/shared/utils/coordonnees-bancaires'

interface Payee {
  id: number
  label: string
  iban: string | null
  bic: string | null
  notes: string | null
}

const props = defineProps<{
  open: boolean
  payees: Payee[]
  editionId: number
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'changed'): void
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const nouveauLibelle = ref('')
const nouvelIban = ref('')
const nouveauBic = ref('')

/** Le libellé suffit : les coordonnées bancaires peuvent venir plus tard. */
const peutCreer = computed(() => nouveauLibelle.value.trim().length > 0)

const ibanPlausible = computed(() => ibanEstPlausible(nouvelIban.value))

const { execute: executerCreation, loading: creation } = useApiAction(
  () => `/api/editions/${props.editionId}/treasury/payees`,
  {
    method: 'POST',
    body: () => ({
      label: nouveauLibelle.value.trim(),
      // Envoyés bruts : c'est le SERVEUR qui normalise, en un seul endroit. Normaliser ici aussi
      // ferait deux règles à tenir, et c'est la divergence entre les deux qu'on ne verrait pas.
      iban: nouvelIban.value.trim() || null,
      bic: nouveauBic.value.trim() || null,
    }),
    successMessage: { title: t('gestion.treasury.payee_created') },
    errorMessages: { default: t('gestion.treasury.payee_create_error') },
    onSuccess: () => {
      nouveauLibelle.value = ''
      nouvelIban.value = ''
      nouveauBic.value = ''
      emit('changed')
    },
  }
)

async function ajouter() {
  if (peutCreer.value) await executerCreation()
}

const suppression = useApiActionById(
  (id) => `/api/editions/${props.editionId}/treasury/payees/${id}`,
  {
    method: 'DELETE',
    successMessage: { title: t('gestion.treasury.payee_deleted') },
    errorMessages: { default: t('gestion.treasury.payee_delete_error') },
    onSuccess: () => emit('changed'),
  }
)

const suppressionOuverte = ref(false)
const payeeASupprimer = ref<Payee | null>(null)

function demanderSuppression(payee: Payee) {
  payeeASupprimer.value = payee
  suppressionOuverte.value = true
}

async function confirmerSuppression() {
  const payee = payeeASupprimer.value
  if (!payee) return
  await suppression.execute(payee.id)
  suppressionOuverte.value = false
  payeeASupprimer.value = null
}
</script>
