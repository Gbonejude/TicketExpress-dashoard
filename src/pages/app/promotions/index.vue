<script setup>
definePage({
  meta: {
    action: 'read',
    subject: 'promotions',
  },
})

import { $api } from '@/utils/api'

const currentPage = ref(1)
const search = ref('')
const stateFilter = ref(null)

const stateOptions = [
  { title: 'Active', value: 'active' },
  { title: 'Programmée', value: 'scheduled' },
  { title: 'Expirée', value: 'expired' },
]

const debouncedSearch = ref('')
let searchTimer = null

watch(search, value => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedSearch.value = value }, 400)
})

const headers = [
  { title: 'Événement', key: 'eventTitle', sortable: false },
  { title: 'Type de ticket', key: 'ticketTypeName' },
  { title: 'Prix normal', key: 'price' },
  { title: 'Prix promo', key: 'promotionalPrice' },
  { title: 'Réduction', key: 'discountPercentage' },
  { title: 'Période', key: 'period', sortable: false },
  { title: 'État', key: 'state' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })
  if (stateFilter.value) params.set('state', stateFilter.value)
  if (debouncedSearch.value) params.set('search', debouncedSearch.value)

  return `/promotions?${params.toString()}`
})

watch([stateFilter, debouncedSearch], () => { currentPage.value = 1 })

const { data: promotionsData, isFetching, execute: fetchPromotions } = useApi(apiUrl)

const promotions = computed(() => promotionsData.value?.data ?? [])
const totalPromotions = computed(() => promotionsData.value?.meta?.total ?? 0)

const onTableOptions = ({ page }) => {
  if (page && page !== currentPage.value) currentPage.value = page
}

const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))} FCFA`

const stateColor = state => ({
  active: 'success',
  scheduled: 'info',
  expired: 'secondary',
})[state] ?? 'secondary'

const stateLabel = state => ({
  active: 'Active',
  scheduled: 'Programmée',
  expired: 'Expirée',
})[state] ?? state

// ─── Create / edit dialog ────────────────────────────────────────────────────
const isFormDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const editingPromo = ref(null)
const deletingPromo = ref(null)
const isSubmitting = ref(false)
const formErrors = ref({})
const refForm = ref()

const snackbar = ref(false)
const snackText = ref('')
const snackColor = ref('success')

const notify = (text, color = 'success') => {
  snackText.value = text
  snackColor.value = color
  snackbar.value = true
}

const form = reactive({
  eventId: null,
  ticketTypeId: null,
  reductionType: 'percentage',
  reductionValue: null,
  startDate: '',
  endDate: '',
})

// Events + ticket types for the pickers
const { data: eventsData } = useApi('/events?page=1')
const eventOptions = computed(() => eventsData.value?.data ?? [])

const ticketTypes = ref([])

const loadTicketTypes = async eventId => {
  ticketTypes.value = []
  if (!eventId) return
  try {
    const res = await $api(`/events/${eventId}/ticket-types`)
    ticketTypes.value = res?.data ?? []
  } catch {
    ticketTypes.value = []
  }
}

watch(() => form.eventId, id => {
  if (!editingPromo.value) {
    form.ticketTypeId = null
    loadTicketTypes(id)
  }
})

const selectedTicketType = computed(() =>
  ticketTypes.value.find(t => t.id === form.ticketTypeId))

const basePrice = computed(() =>
  Number(editingPromo.value?.price ?? selectedTicketType.value?.price ?? 0))

const computedPromoPrice = computed(() => {
  const base = basePrice.value
  const val = Number(form.reductionValue)
  if (!base || !val || val <= 0) return null
  const price = form.reductionType === 'percentage'
    ? base * (1 - val / 100)
    : base - val

  return Math.max(0, Math.round(price))
})

const resetForm = () => {
  form.eventId = null
  form.ticketTypeId = null
  form.reductionType = 'percentage'
  form.reductionValue = null
  form.startDate = ''
  form.endDate = ''
  formErrors.value = {}
  editingPromo.value = null
  ticketTypes.value = []
  refForm.value?.resetValidation()
}

const toDateInput = value => {
  // value can be an ISO string or a { datetime } resource
  const raw = value?.datetime ?? value
  if (!raw) return ''

  return String(raw).slice(0, 10)
}

const openCreateDialog = () => {
  resetForm()
  isFormDialogOpen.value = true
}

const openEditDialog = promo => {
  resetForm()
  editingPromo.value = promo
  form.eventId = promo.eventId
  form.ticketTypeId = promo.ticketTypeId
  form.reductionType = 'amount'
  form.reductionValue = Number(promo.price) - Number(promo.promotionalPrice)
  form.startDate = toDateInput(promo.promotionStartDate)
  form.endDate = toDateInput(promo.promotionEndDate)
  isFormDialogOpen.value = true
}

const savePromotion = async () => {
  const { valid } = await refForm.value?.validate() ?? { valid: true }
  if (!valid) return

  const promoPrice = computedPromoPrice.value
  if (promoPrice === null || promoPrice >= basePrice.value) {
    notify('La réduction doit donner un prix inférieur au prix normal.', 'error')

    return
  }

  isSubmitting.value = true
  formErrors.value = {}
  try {
    await $api(`/promotions/${form.ticketTypeId}`, {
      method: 'PUT',
      body: {
        promotional_price: promoPrice,
        promotion_start_date: form.startDate,
        promotion_end_date: form.endDate,
      },
    })
    notify(editingPromo.value ? 'Promotion mise à jour.' : 'Promotion créée.')
    isFormDialogOpen.value = false
    fetchPromotions()
  } catch (error) {
    const data = error?.data ?? error?._data
    if (data?.errors) formErrors.value = data.errors
    else notify(data?.message ?? "Impossible d'enregistrer la promotion.", 'error')
  } finally {
    isSubmitting.value = false
  }
}

const openDeleteDialog = promo => {
  deletingPromo.value = promo
  isDeleteDialogOpen.value = true
}

const confirmDelete = async () => {
  isSubmitting.value = true
  try {
    await $api(`/promotions/${deletingPromo.value.ticketTypeId}`, { method: 'DELETE' })
    isDeleteDialogOpen.value = false
    notify('Promotion supprimée.')
    fetchPromotions()
  } catch (error) {
    notify(error?.data?.message ?? 'Impossible de supprimer la promotion.', 'error')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">Promotions</span>
        <VBtn
          color="primary"
          v-if="$can('create', 'promotions')"
          prepend-icon="tabler-plus"
          @click="openCreateDialog"
        >
          Créer une promotion
        </VBtn>
      </VCardTitle>

      <VDivider />

      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="8"
          >
            <VTextField
              v-model="search"
              label="Rechercher"
              placeholder="Type de ticket ou événement…"
              prepend-inner-icon="tabler-search"
              density="compact"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            md="4"
          >
            <VSelect
              v-model="stateFilter"
              :items="stateOptions"
              item-title="title"
              item-value="value"
              label="État"
              placeholder="Tous"
              density="compact"
              clearable
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="promotions"
        :items-length="totalPromotions"
        :items-per-page="15"
        :page="currentPage"
        :loading="isFetching"
        no-data-text="Aucune promotion"
        class="text-no-wrap"
        @update:options="onTableOptions"
      >
        <template #item.price="{ item }">
          <span class="text-decoration-line-through text-medium-emphasis">{{ formatPrice(item.price) }}</span>
        </template>

        <template #item.promotionalPrice="{ item }">
          <span class="font-weight-medium text-success">{{ formatPrice(item.promotionalPrice) }}</span>
        </template>

        <template #item.discountPercentage="{ item }">
          <VChip
            color="error"
            size="small"
            variant="tonal"
          >
            -{{ item.discountPercentage ?? 0 }}%
          </VChip>
        </template>

        <template #item.period="{ item }">
          <div class="text-caption">
            {{ item.promotionStartDate?.human ?? '-' }}
            <VIcon
              icon="tabler-arrow-right"
              size="14"
            />
            {{ item.promotionEndDate?.human ?? '-' }}
          </div>
        </template>

        <template #item.state="{ item }">
          <VChip
            :color="stateColor(item.state)"
            size="small"
            variant="tonal"
          >
            {{ stateLabel(item.state) }}
          </VChip>
        </template>

        <template #item.actions="{ item }">
          <VTooltip
            text="Modifier"
            location="top"
          >
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
          <VTooltip
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

    <!-- ─── Dialog Créer / Modifier ─────────────────────────────────────────── -->
    <VDialog
      v-model="isFormDialogOpen"
      max-width="640"
      scrollable
    >
      <VCard :title="editingPromo ? 'Modifier la promotion' : 'Créer une promotion'">
        <VCardText class="pt-4">
          <VForm ref="refForm">
            <VRow>
              <VCol cols="12">
                <VSelect
                  v-model="form.eventId"
                  :items="eventOptions"
                  item-title="title"
                  item-value="id"
                  label="Événement"
                  :disabled="!!editingPromo"
                  :rules="[requiredValidator]"
                />
              </VCol>

              <VCol cols="12">
                <VSelect
                  v-model="form.ticketTypeId"
                  :items="ticketTypes"
                  item-title="name"
                  item-value="id"
                  label="Type de ticket"
                  :disabled="!!editingPromo || !form.eventId"
                  :rules="[requiredValidator]"
                  :hint="editingPromo ? `Type : ${editingPromo.ticketTypeName}` : ''"
                  persistent-hint
                />
              </VCol>

              <VCol cols="12">
                <VAlert
                  v-if="basePrice"
                  type="info"
                  variant="tonal"
                  density="compact"
                >
                  Prix normal : <strong>{{ formatPrice(basePrice) }}</strong>
                  <span v-if="computedPromoPrice !== null">
                    → prix promo : <strong>{{ formatPrice(computedPromoPrice) }}</strong>
                  </span>
                </VAlert>
              </VCol>

              <VCol
                cols="12"
                md="5"
              >
                <VSelect
                  v-model="form.reductionType"
                  :items="[
                    { title: 'Pourcentage (%)', value: 'percentage' },
                    { title: 'Montant fixe (FCFA)', value: 'amount' },
                  ]"
                  item-title="title"
                  item-value="value"
                  label="Type de réduction"
                />
              </VCol>
              <VCol
                cols="12"
                md="7"
              >
                <VTextField
                  v-model.number="form.reductionValue"
                  type="number"
                  min="0"
                  :label="form.reductionType === 'percentage' ? 'Réduction (%)' : 'Réduction (FCFA)'"
                  :rules="[requiredValidator]"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.startDate"
                  type="date"
                  label="Date de début"
                  :rules="[requiredValidator]"
                  :error-messages="formErrors.promotion_start_date"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.endDate"
                  type="date"
                  label="Date de fin"
                  :rules="[requiredValidator]"
                  :error-messages="formErrors.promotion_end_date"
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
            @click="savePromotion"
          >
            {{ editingPromo ? 'Enregistrer' : 'Créer' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Suppression ───────────────────────────────────────────────── -->
    <VDialog
      v-model="isDeleteDialogOpen"
      max-width="420"
    >
      <VCard title="Supprimer la promotion">
        <VCardText class="pt-4">
          <p class="text-body-2">
            Retirer la promotion sur
            <strong>{{ deletingPromo?.ticketTypeName }}</strong> ?
            Le prix normal sera rétabli.
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

    <VSnackbar
      v-model="snackbar"
      :color="snackColor"
      location="top end"
    >
      {{ snackText }}
    </VSnackbar>
  </div>
</template>
