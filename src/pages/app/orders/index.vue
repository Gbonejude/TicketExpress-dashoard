<script setup>
import { notify, notifyApiError } from '@/utils/toast'
import { formatDateFr } from '@/utils/dateFormat'

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
const eventFilter = ref(null)

// 100 par page : le select doit contenir tous les événements.
const { data: eventsData } = useApi('/events?page=1&per_page=100')

const eventOptions = computed(() => eventsData.value?.data ?? [])

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

const headers = [
  { title: 'N° commande', key: 'orderNumber' },
  { title: 'Participant', key: 'participant', sortable: false },
  { title: 'Événement', key: 'event', sortable: false },
  { title: 'Billets', key: 'ticketsCount', sortable: false },
  { title: 'Montant', key: 'totalAmount' },
  { title: 'Statut', key: 'status' },
  { title: 'Livraison', key: 'delivery', sortable: false },
  { title: 'Date', key: 'createdAt', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false },
]

/**
 * L'événement de la commande, lu sur ses lignes.
 *
 * Une commande passe par la page d'un événement, elle n'en concerne donc qu'un —
 * mais rien ne l'interdit au niveau des données, d'où le décompte : si plusieurs
 * événements apparaissent, on le dit plutôt que d'en montrer un au hasard.
 */
const orderEvent = order => {
  const titles = [...new Set(
    (order.items ?? [])
      .map(item => item.ticketType?.event?.title)
      .filter(Boolean),
  )]

  if (!titles.length) return { title: null, extra: 0 }

  return { title: titles[0], extra: titles.length - 1 }
}

/**
 * Nombre de billets de la commande.
 *
 * `ticketsCount` compte les billets réellement émis — donc 0 tant que la
 * commande n'est pas payée. La somme des quantités commandées est alors la seule
 * information disponible, et c'est ce que l'on veut voir sur une commande en
 * attente.
 */
const orderTickets = order => {
  const issued = Number(order.ticketsCount ?? 0)

  if (issued > 0) return { count: issued, issued: true }

  const ordered = (order.items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)

  return { count: ordered, issued: false }
}

// ─── List fetch (server pagination) ─────────────────────────────────────────
const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })
  if (statusFilter.value) params.set('status', statusFilter.value)
  if (eventFilter.value) params.set('event_id', eventFilter.value)
  if (debouncedSearch.value) params.set('search', debouncedSearch.value)

  return `/orders?${params.toString()}`
})

// Reset to first page whenever a filter changes.
watch([statusFilter, eventFilter, debouncedSearch], () => { currentPage.value = 1 })

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
    notify('Commande annulée avec succès.')
    fetchOrders()
  } catch (err) {
    notifyApiError(err, "Impossible d'annuler la commande.")
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
            md="5"
          >
            <VTextField
              v-model="search"
              label="Rechercher"
              placeholder="N° commande, email ou nom du participant…"
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
              v-model="eventFilter"
              :items="eventOptions"
              item-title="title"
              item-value="id"
              label="Événement"
              placeholder="Tous les événements"
              density="compact"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
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
        <!--
          N° commande : puce, comme le statut. C'est le repère qu'on cherche
          en premier dans la liste, il doit se distinguer du corps de texte. 
        -->
        <template #item.orderNumber="{ item }">
          <VChip
            v-if="item.orderNumber"
            color="primary"
            size="small"
            variant="tonal"
            class="font-weight-medium"
          >
            #{{ item.orderNumber }}
          </VChip>
          <span
            v-else
            class="text-medium-emphasis"
          >-</span>
        </template>

        <!-- Participant -->
        <template #item.participant="{ item }">
          <ParticipantCell
            :name="item.fullName"
            :phone="item.phone"
            :user="item.user"
          />
        </template>

        <!-- Événement -->
        <template #item.event="{ item }">
          <template v-if="orderEvent(item).title">
            <div
              class="text-body-2 text-truncate"
              style="max-width: 220px"
            >
              {{ orderEvent(item).title }}
            </div>
            <div
              v-if="orderEvent(item).extra > 0"
              class="text-caption text-medium-emphasis"
            >
              +{{ orderEvent(item).extra }} autre(s)
            </div>
          </template>
          <span
            v-else
            class="text-medium-emphasis"
          >-</span>
        </template>

        <!-- Billets -->
        <template #item.ticketsCount="{ item }">
          <div class="text-body-2">
            {{ orderTickets(item).count }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ orderTickets(item).issued ? 'émis' : 'commandés' }}
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

        <!-- Date -->
        <template #item.createdAt="{ item }">
          {{ formatDateFr(item.createdAt) }}
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
  </div>
</template>
