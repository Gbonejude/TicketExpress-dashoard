<script setup>
definePage({
  meta: {
    action: 'read',
    subject: 'bookings',
  },
})

import { $api } from '@/utils/api'

const router = useRouter()

const currentPage = ref(1)
const search = ref('')
const statusFilter = ref(null)

const statusOptions = [
  { title: 'En attente', value: 'pending' },
  { title: 'Payé', value: 'paid' },
  { title: 'Annulé', value: 'cancelled' },
  { title: 'Remboursé', value: 'refunded' },
]

// Debounced search so we don't hit the API on every keystroke.
const debouncedSearch = ref('')
let searchTimer = null

watch(search, value => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedSearch.value = value
  }, 400)
})

const isCancelDialogOpen = ref(false)
const cancellingOrder = ref(null)
const isSubmitting = ref(false)

const snackbar = ref(false)
const snackText = ref('')
const snackColor = ref('success')

const headers = [
  { title: 'N° commande', key: 'orderNumber' },
  { title: 'Client', key: 'client', sortable: false },
  { title: 'Montant', key: 'totalAmount' },
  { title: 'Statut', key: 'status' },
  { title: 'Livraison', key: 'delivery', sortable: false },
  { title: 'Articles', key: 'itemsCount' },
  { title: 'Date', key: 'createdAt', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false },
]

// ─── List fetch (server pagination) ─────────────────────────────────────────
const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })
  if (statusFilter.value) params.set('status', statusFilter.value)
  if (debouncedSearch.value) params.set('search', debouncedSearch.value)

  return `/orders?${params.toString()}`
})

// Reset to first page whenever a filter changes.
watch([statusFilter, debouncedSearch], () => { currentPage.value = 1 })

const { data: ordersData, isFetching, execute: fetchOrders } = useApi(apiUrl)

// Live (silent) refresh when an order is placed / paid / cancelled elsewhere.
useRealtimeRefresh('orders', () => fetchOrders())

const orders = computed(() => ordersData.value?.data ?? [])
const totalOrders = computed(() => ordersData.value?.meta?.total ?? 0)

const onTableOptions = ({ page }) => {
  if (page && page !== currentPage.value) currentPage.value = page
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))} FCFA`

const statusColor = status => ({
  pending: 'warning',
  paid: 'success',
  cancelled: 'error',
  refunded: 'secondary',
})[status] ?? 'secondary'

const canCancel = order => ['pending', 'paid'].includes(order?.status)

// ─── Actions ────────────────────────────────────────────────────────────────
const openCancelDialog = order => {
  cancellingOrder.value = order
  isCancelDialogOpen.value = true
}

const confirmCancel = async () => {
  isSubmitting.value = true
  try {
    await $api(`/orders/${cancellingOrder.value.id}/cancel`, { method: 'POST' })
    isCancelDialogOpen.value = false
    snackColor.value = 'success'
    snackText.value = 'Commande annulée avec succès.'
    snackbar.value = true
    fetchOrders()
  } catch (err) {
    snackColor.value = 'error'
    snackText.value = err?.data?.message ?? "Impossible d'annuler la commande."
    snackbar.value = true
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">Gestion des Commandes</span>
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
              placeholder="N° commande, email, nom du client…"
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
              v-model="statusFilter"
              :items="statusOptions"
              item-title="title"
              item-value="value"
              label="Statut"
              placeholder="Tous les statuts"
              density="compact"
              clearable
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="orders"
        :items-length="totalOrders"
        :items-per-page="15"
        :page="currentPage"
        :loading="isFetching"
        no-data-text="Aucune commande"
        class="text-no-wrap"
        @update:options="onTableOptions"
      >
        <!-- N° commande -->
        <template #item.orderNumber="{ item }">
          <span
            class="font-weight-medium"
            style="font-family: monospace"
          >
            {{ item.orderNumber ? `#${item.orderNumber}` : '-' }}
          </span>
        </template>

        <!-- Client -->
        <template #item.client="{ item }">
          <div>
            <div class="font-weight-medium">
              {{ item.fullName ?? '-' }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ item.email ?? '' }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ item.phone ?? '' }}
            </div>
          </div>
        </template>

        <!-- Montant -->
        <template #item.totalAmount="{ item }">
          <span class="font-weight-medium">{{ formatPrice(item.totalAmount) }}</span>
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

        <!-- Livraison -->
        <template #item.delivery="{ item }">
          {{ item.deliveryMethodLabel ?? '-' }}
        </template>

        <!-- Articles -->
        <template #item.itemsCount="{ item }">
          {{ item.itemsCount ?? 0 }}
        </template>

        <!-- Date -->
        <template #item.createdAt="{ item }">
          {{ item.createdAt?.human ?? '-' }}
        </template>

        <!-- Actions -->
        <template #item.actions="{ item }">
          <VTooltip
            text="Voir"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="default"
                @click="router.push(`/orders/${item.id}`)"
              >
                <VIcon icon="tabler-eye" />
              </VBtn>
            </template>
          </VTooltip>

          <VTooltip
            v-if="canCancel(item)"
            text="Annuler"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="error"
                @click="openCancelDialog(item)"
              >
                <VIcon icon="tabler-ban" />
              </VBtn>
            </template>
          </VTooltip>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- ─── Dialog Annulation ────────────────────────────────────────────────── -->
    <VDialog
      v-model="isCancelDialogOpen"
      max-width="400"
    >
      <VCard title="Annuler la commande">
        <VCardText class="pt-4">
          <p class="text-body-2">
            Êtes-vous sûr de vouloir annuler la commande
            <strong>{{ cancellingOrder?.orderNumber }}</strong> ?
            Le stock sera libéré et la commande passera au statut « Annulé ».
          </p>
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isCancelDialogOpen = false"
          >
            Retour
          </VBtn>
          <VBtn
            color="error"
            :loading="isSubmitting"
            @click="confirmCancel"
          >
            Annuler la commande
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
