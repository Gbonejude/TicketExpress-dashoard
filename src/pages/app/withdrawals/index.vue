<script setup>
definePage({
  meta: {
    action: 'read',
    subject: 'withdrawals',
  },
})

import { $api } from '@/utils/api'

const currentPage = ref(1)
const isFormDialogOpen = ref(false)
const isProcessDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const processingWithdrawal = ref(null)
const deletingWithdrawal = ref(null)
const isSubmitting = ref(false)
const formErrors = ref({})
const processError = ref('')
const deleteError = ref('')
const refForm = ref()
const refProcessForm = ref()

const form = reactive({
  organizer_id: '',
  amount: null,
  payment_method: '',
})

const processForm = reactive({
  status: '',
})

const headers = [
  { title: 'Organisateur', key: 'organizer' },
  { title: 'Montant', key: 'amount' },
  { title: 'Méthode', key: 'paymentMethod' },
  { title: 'Statut', key: 'status' },
  { title: 'Demandé le', key: 'createdAt' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const processStatusOptions = [
  { title: 'Approuvé', value: 'approved' },
  { title: 'Rejeté', value: 'rejected' },
  { title: 'Payé', value: 'paid' },
]

const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })

  return `/withdrawals?${params.toString()}`
})

const { data: withdrawalsData, isFetching, execute: fetchWithdrawals } = useApi(apiUrl)

const withdrawals = computed(() => withdrawalsData.value?.data ?? [])
const totalWithdrawals = computed(() => withdrawalsData.value?.meta?.total ?? 0)

const onTableOptions = ({ page }) => {
  if (page && page !== currentPage.value) currentPage.value = page
}

// Organizers for the "Organisateur" select
const { data: organizersData, execute: fetchOrganizers } = useApi('/organizers?page=1')

const organizers = computed(() => organizersData.value?.data ?? [])

const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))} FCFA`

const statusColor = status => ({
  pending: 'warning',
  approved: 'info',
  paid: 'success',
  rejected: 'error',
})[status] ?? 'secondary'

// Only pending/approved withdrawals can still be processed (paid/rejected are final states).
const canProcess = item => item.status === 'pending' || item.status === 'approved'

// Backend only allows deleting withdrawals still in "pending" state.
const canDelete = item => item.status === 'pending'

const resetForm = () => {
  form.organizer_id = ''
  form.amount = null
  form.payment_method = ''
  formErrors.value = {}
  refForm.value?.resetValidation()
}

const openCreateDialog = () => {
  resetForm()
  fetchOrganizers()
  isFormDialogOpen.value = true
}

const saveWithdrawal = async () => {
  const { valid } = await refForm.value?.validate() ?? { valid: true }
  if (!valid) return

  isSubmitting.value = true
  formErrors.value = {}
  try {
    await $api('/withdrawals', { method: 'POST', body: { ...form } })
    isFormDialogOpen.value = false
    fetchWithdrawals()
  } catch (error) {
    if (error?.data?.errors) formErrors.value = error.data.errors
    else if (error?._data?.errors) formErrors.value = error._data.errors
  } finally {
    isSubmitting.value = false
  }
}

const openProcessDialog = item => {
  processingWithdrawal.value = item
  processForm.status = item.status === 'pending' ? 'approved' : 'paid'
  processError.value = ''
  refProcessForm.value?.resetValidation()
  isProcessDialogOpen.value = true
}

const confirmProcess = async () => {
  const { valid } = await refProcessForm.value?.validate() ?? { valid: true }
  if (!valid) return

  isSubmitting.value = true
  processError.value = ''
  try {
    await $api(`/withdrawals/${processingWithdrawal.value.id}/process`, {
      method: 'POST',
      body: { status: processForm.status },
    })
    isProcessDialogOpen.value = false
    fetchWithdrawals()
  } catch (error) {
    processError.value = error?.data?.message ?? error?._data?.message ?? 'Une erreur est survenue.'
  } finally {
    isSubmitting.value = false
  }
}

const openDeleteDialog = item => {
  deletingWithdrawal.value = item
  deleteError.value = ''
  isDeleteDialogOpen.value = true
}

const confirmDelete = async () => {
  isSubmitting.value = true
  deleteError.value = ''
  try {
    await $api(`/withdrawals/${deletingWithdrawal.value.id}`, { method: 'DELETE' })
    isDeleteDialogOpen.value = false
    fetchWithdrawals()
  } catch (error) {
    deleteError.value = error?.data?.message ?? error?._data?.message ?? 'Une erreur est survenue.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">Gestion des Retraits</span>
        <VBtn
          color="primary"
          prepend-icon="tabler-plus"
          @click="openCreateDialog"
        >
          Ajouter une demande
        </VBtn>
      </VCardTitle>

      <VDivider />

      <VDataTableServer
        :headers="headers"
        :items="withdrawals"
        :items-length="totalWithdrawals"
        :items-per-page="15"
        :page="currentPage"
        :loading="isFetching"
        no-data-text="Aucune demande de retrait"
        class="text-no-wrap"
        @update:options="onTableOptions"
      >
        <!-- Organisateur -->
        <template #item.organizer="{ item }">
          <span class="font-weight-medium">{{ item.organizer?.companyName ?? '-' }}</span>
        </template>

        <!-- Montant -->
        <template #item.amount="{ item }">
          {{ formatPrice(item.amount) }}
        </template>

        <!-- Méthode -->
        <template #item.paymentMethod="{ item }">
          {{ item.paymentMethod ?? '-' }}
        </template>

        <!-- Statut -->
        <template #item.status="{ item }">
          <VChip
            :color="statusColor(item.status)"
            size="small"
            variant="tonal"
          >
            {{ item.statusLabel ?? item.status }}
          </VChip>
        </template>

        <!-- Demandé le -->
        <template #item.createdAt="{ item }">
          {{ item.createdAt?.human ?? '-' }}
        </template>

        <!-- Actions -->
        <template #item.actions="{ item }">
          <VTooltip
            v-if="canProcess(item)"
            text="Traiter"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="info"
                @click="openProcessDialog(item)"
              >
                <VIcon icon="tabler-checkbox" />
              </VBtn>
            </template>
          </VTooltip>

          <VTooltip
            v-if="canDelete(item)"
            text="Supprimer"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="error"
                @click="openDeleteDialog(item)"
              >
                <VIcon icon="tabler-trash" />
              </VBtn>
            </template>
          </VTooltip>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- ─── Dialog Créer ─────────────────────────────────────────────────────── -->
    <VDialog
      v-model="isFormDialogOpen"
      max-width="640"
      scrollable
    >
      <VCard title="Ajouter une demande de retrait">
        <VCardText class="pt-4">
          <VForm ref="refForm">
            <VRow>
              <VCol cols="12">
                <VSelect
                  v-model="form.organizer_id"
                  :items="organizers"
                  item-title="companyName"
                  item-value="id"
                  label="Organisateur"
                  :rules="[requiredValidator]"
                  :error-messages="formErrors.organizer_id"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model.number="form.amount"
                  type="number"
                  min="1"
                  label="Montant (FCFA)"
                  :rules="[requiredValidator, v => (v > 0) || 'Le montant doit être au moins 1.']"
                  :error-messages="formErrors.amount"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.payment_method"
                  label="Méthode de paiement"
                  placeholder="Ex : bank_transfer, mobile_money"
                  :rules="[requiredValidator, v => (v ?? '').length <= 255 || 'Ne doit pas dépasser 255 caractères']"
                  :error-messages="formErrors.payment_method"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isFormDialogOpen = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="primary"
            :loading="isSubmitting"
            @click="saveWithdrawal"
          >
            Créer la demande
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Traiter (process) ────────────────────────────────────────── -->
    <VDialog
      v-model="isProcessDialogOpen"
      max-width="400"
    >
      <VCard title="Traiter la demande de retrait">
        <VCardText class="pt-4">
          <p class="text-body-2 mb-4">
            Organisateur :
            <strong>{{ processingWithdrawal?.organizer?.companyName }}</strong>
            — Montant : <strong>{{ formatPrice(processingWithdrawal?.amount) }}</strong>
          </p>

          <VForm ref="refProcessForm">
            <VSelect
              v-model="processForm.status"
              :items="processStatusOptions"
              item-title="title"
              item-value="value"
              label="Nouveau statut"
              :rules="[requiredValidator]"
            />
          </VForm>

          <VAlert
            v-if="processError"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            {{ processError }}
          </VAlert>
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isProcessDialogOpen = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="primary"
            :loading="isSubmitting"
            @click="confirmProcess"
          >
            Valider
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Suppression ───────────────────────────────────────────────── -->
    <VDialog
      v-model="isDeleteDialogOpen"
      max-width="400"
    >
      <VCard title="Supprimer la demande de retrait">
        <VCardText class="pt-4">
          <p class="text-body-2">
            Êtes-vous sûr de vouloir supprimer la demande de retrait de
            <strong>{{ deletingWithdrawal?.organizer?.companyName }}</strong> ?
            Cette action est irréversible.
          </p>

          <VAlert
            v-if="deleteError"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            {{ deleteError }}
          </VAlert>
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isDeleteDialogOpen = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="error"
            :loading="isSubmitting"
            @click="confirmDelete"
          >
            Supprimer
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
