<script setup>
definePage({
  meta: {
    action: 'read',
    subject: 'coupons',
  },
})

import { $api } from '@/utils/api'

const search = ref('')
const currentPage = ref(1)
const isFormDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const editingCoupon = ref(null)
const deletingCoupon = ref(null)
const isSubmitting = ref(false)
const isLoadingAssociations = ref(false)
const formRef = ref(null)

const fieldErrors = reactive({
  code: undefined,
  type: undefined,
  value: undefined,
  max_usage: undefined,
  start_date: undefined,
  end_date: undefined,
  event_ids: undefined,
})

const form = reactive({
  code: '',
  type: 'percent',
  value: '',
  max_usage: '',
  start_date: '',
  end_date: '',
  event_ids: [],
})

const headers = [
  { title: 'Code', key: 'code' },
  { title: 'Type', key: 'type' },
  { title: 'Valeur', key: 'value' },
  { title: 'Utilisation', key: 'usage', sortable: false },
  { title: 'Validité', key: 'validity', sortable: false },
  { title: 'Statut', key: 'isActive' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const typeOptions = [
  { title: 'Pourcentage', value: 'percent' },
  { title: 'Montant fixe', value: 'fixed' },
]

// ─── List fetch (server pagination + search) ────────────────────────────────
const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })
  if (search.value) params.set('search', search.value)

  return `/coupons?${params.toString()}`
})

watch(search, () => { currentPage.value = 1 })

const { data: couponsData, isFetching, execute: fetchCoupons } = useApi(apiUrl)

const coupons = computed(() => couponsData.value?.data ?? [])
const totalCoupons = computed(() => couponsData.value?.meta?.total ?? 0)

const onTableOptions = ({ page }) => {
  if (page && page !== currentPage.value) currentPage.value = page
}

// ─── Events dropdown (optional association) ─────────────────────────────────
const { data: eventsData } = useApi('/events')
const eventOptions = computed(() => eventsData.value?.data ?? [])

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))} FCFA`

const toDatetimeLocal = dateObj =>
  dateObj?.datetime ? dateObj.datetime.slice(0, 16) : ''

const typeColor = type => (type === 'percent' ? 'primary' : 'info')

const maxLengthValidator = (value, length) => {
  if (!value) return true

  return String(value).length <= length || `Ce champ ne doit pas dépasser ${length} caractères.`
}

const positiveValidator = value =>
  (value !== '' && value !== null && value !== undefined && Number(value) >= 0) || 'La valeur doit être positive.'

const minUsageValidator = value =>
  (value !== '' && value !== null && value !== undefined && Number(value) >= 1) || 'Le nombre maximum d\'utilisations doit être au moins 1.'

const endAfterStartValidator = value => {
  if (!value || !form.start_date) return true

  return new Date(value) > new Date(form.start_date) || 'La date de fin doit être après la date de début.'
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────
const resetForm = () => {
  form.code = ''
  form.type = 'percent'
  form.value = ''
  form.max_usage = ''
  form.start_date = ''
  form.end_date = ''
  form.event_ids = []
  Object.keys(fieldErrors).forEach(key => { fieldErrors[key] = undefined })
  editingCoupon.value = null
  formRef.value?.resetValidation()
}

const openCreateDialog = () => {
  resetForm()
  isFormDialogOpen.value = true
}

const openEditDialog = async coupon => {
  resetForm()
  editingCoupon.value = coupon
  form.code = coupon.code ?? ''
  form.type = coupon.type ?? 'percent'
  form.value = coupon.value ?? ''
  form.max_usage = coupon.maxUsage ?? ''
  form.start_date = toDatetimeLocal(coupon.startDate)
  form.end_date = toDatetimeLocal(coupon.endDate)
  isFormDialogOpen.value = true

  // List items don't carry the `events` relation — fetch the coupon detail
  // to prefill the event_ids multi-select.
  isLoadingAssociations.value = true
  try {
    const detail = await $api(`/coupons/${coupon.id}`)
    form.event_ids = (detail?.data?.events ?? []).map(ev => ev.id)
  } catch {
    form.event_ids = []
  } finally {
    isLoadingAssociations.value = false
  }
}

const openDeleteDialog = coupon => {
  deletingCoupon.value = coupon
  isDeleteDialogOpen.value = true
}

const saveCoupon = async () => {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  Object.keys(fieldErrors).forEach(key => { fieldErrors[key] = undefined })
  isSubmitting.value = true

  const payload = {
    code: form.code,
    type: form.type,
    value: Number(form.value),
    max_usage: Number(form.max_usage),
    start_date: form.start_date,
    end_date: form.end_date,
    event_ids: form.event_ids,
  }

  try {
    if (editingCoupon.value) {
      await $api(`/coupons/${editingCoupon.value.id}`, { method: 'PUT', body: payload })
    } else {
      await $api('/coupons', { method: 'POST', body: payload })
    }
    isFormDialogOpen.value = false
    fetchCoupons()
  } catch (error) {
    const errors = error?.data?.errors ?? error?._data?.errors
    if (errors) {
      fieldErrors.code = errors.code?.[0]
      fieldErrors.type = errors.type?.[0]
      fieldErrors.value = errors.value?.[0]
      fieldErrors.max_usage = errors.max_usage?.[0]
      fieldErrors.start_date = errors.start_date?.[0]
      fieldErrors.end_date = errors.end_date?.[0]
      fieldErrors.event_ids = errors.event_ids?.[0]
    }
  } finally {
    isSubmitting.value = false
  }
}

const confirmDelete = async () => {
  isSubmitting.value = true
  try {
    await $api(`/coupons/${deletingCoupon.value.id}`, { method: 'DELETE' })
    isDeleteDialogOpen.value = false
    fetchCoupons()
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">Gestion des Coupons</span>
        <VBtn
          color="primary"
          v-if="$can('create', 'coupons')"
          prepend-icon="tabler-plus"
          @click="openCreateDialog"
        >
          Ajouter un coupon
        </VBtn>
      </VCardTitle>

      <VDivider />

      <VCardText>
        <VTextField
          v-model="search"
          placeholder="Rechercher par code..."
          prepend-inner-icon="tabler-search"
          density="compact"
          class="mb-4"
          style="max-width: 360px"
        />
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="coupons"
        :items-length="totalCoupons"
        :items-per-page="15"
        :page="currentPage"
        :loading="isFetching"
        :no-data-text="'Aucun coupon'"
        class="text-no-wrap"
        @update:options="onTableOptions"
      >
        <!-- Code -->
        <template #item.code="{ item }">
          <VChip
            size="small"
            color="secondary"
            variant="tonal"
            class="font-mono"
          >
            {{ item.code }}
          </VChip>
        </template>

        <!-- Type -->
        <template #item.type="{ item }">
          <VChip
            size="small"
            :color="typeColor(item.type)"
            variant="tonal"
          >
            {{ item.typeLabel }}
          </VChip>
        </template>

        <!-- Valeur -->
        <template #item.value="{ item }">
          <span class="font-weight-medium">
            {{ item.type === 'percent' ? `${item.value}%` : formatPrice(item.value) }}
          </span>
        </template>

        <!-- Utilisation -->
        <template #item.usage="{ item }">
          <div>{{ item.usedCount }} / {{ item.maxUsage }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ item.remainingUsage }} restante(s)
          </div>
        </template>

        <!-- Validité -->
        <template #item.validity="{ item }">
          <span>{{ item.startDate?.human ?? '-' }} → {{ item.endDate?.human ?? '-' }}</span>
        </template>

        <!-- Statut -->
        <template #item.isActive="{ item }">
          <VChip
            size="small"
            :color="item.isActive ? 'success' : 'secondary'"
            variant="tonal"
          >
            {{ item.isActive ? 'Actif' : 'Inactif' }}
          </VChip>
        </template>

        <!-- Actions -->
        <template #item.actions="{ item }">
          <VTooltip text="Modifier" location="top">
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="primary"
                @click="openEditDialog(item)"
              >
                <VIcon icon="tabler-edit" />
              </VBtn>
            </template>
          </VTooltip>

          <VTooltip text="Supprimer" location="top">
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

    <!-- ─── Dialog Créer / Modifier ─────────────────────────────────────────── -->
    <VDialog
      v-model="isFormDialogOpen"
      max-width="640"
      scrollable
    >
      <VCard :title="editingCoupon ? 'Modifier le coupon' : 'Ajouter un coupon'">
        <VCardText class="pt-4">
          <VForm ref="formRef">
            <VRow>
              <VCol cols="12">
                <VTextField
                  v-model="form.code"
                  label="Code"
                  :rules="[requiredValidator, v => maxLengthValidator(v, 255)]"
                  :error-messages="fieldErrors.code"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="form.type"
                  label="Type"
                  :items="typeOptions"
                  :rules="[requiredValidator]"
                  :error-messages="fieldErrors.type"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.value"
                  type="number"
                  min="0"
                  :label="form.type === 'percent' ? 'Valeur (%)' : 'Valeur (FCFA)'"
                  :rules="[requiredValidator, positiveValidator]"
                  :error-messages="fieldErrors.value"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.max_usage"
                  type="number"
                  min="1"
                  label="Utilisation maximale"
                  :rules="[requiredValidator, minUsageValidator]"
                  :error-messages="fieldErrors.max_usage"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.start_date"
                  type="datetime-local"
                  label="Date de début"
                  :rules="[requiredValidator]"
                  :error-messages="fieldErrors.start_date"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.end_date"
                  type="datetime-local"
                  label="Date de fin"
                  :rules="[requiredValidator, endAfterStartValidator]"
                  :error-messages="fieldErrors.end_date"
                  required
                />
              </VCol>
              <VCol cols="12">
                <VSelect
                  v-model="form.event_ids"
                  label="Événements associés (optionnel)"
                  :items="eventOptions"
                  item-title="title"
                  item-value="id"
                  multiple
                  chips
                  closable-chips
                  :loading="isLoadingAssociations"
                  :error-messages="fieldErrors.event_ids"
                  hint="Laissez vide pour appliquer le coupon à tous les événements"
                  persistent-hint
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
            :disabled="isLoadingAssociations"
            @click="saveCoupon"
          >
            {{ editingCoupon ? 'Enregistrer les modifications' : 'Créer le coupon' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Suppression ───────────────────────────────────────────────── -->
    <VDialog
      v-model="isDeleteDialogOpen"
      max-width="400"
    >
      <VCard title="Supprimer le coupon">
        <VCardText class="pt-4">
          <p class="text-body-2">
            Êtes-vous sûr de vouloir supprimer le coupon
            <strong>{{ deletingCoupon?.code }}</strong> ?
            Cette action est irréversible.
          </p>
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
