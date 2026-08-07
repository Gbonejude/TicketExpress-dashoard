<script setup>
import { notify } from '@/utils/toast'

definePage({
  meta: {
    action: 'read',
    subject: 'bookings',
  },
})

import { $api } from '@/utils/api'

const route = useRoute()
const router = useRouter()
const orderId = route.params.id

const activeTab = ref('items')
const isSubmitting = ref(false)

/* ─────────────────────────────────────────────────────────────────────────
 * Order detail (eager-loads items.ticketType + tickets — confirmed backend)
 * ────────────────────────────────────────────────────────────────────── */
const orderUrl = computed(() => `/orders/${orderId}`)
const { data: orderResp, isFetching: orderLoading, execute: fetchOrder } = useApi(orderUrl)

const order = computed(() => orderResp.value?.data ?? null)
const items = computed(() => order.value?.items ?? [])
const tickets = computed(() => order.value?.tickets ?? [])

/* ─────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────── */
const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))} FCFA`

const orderStatusColor = status => ({
  pending: 'warning',
  paid: 'success',
  cancelled: 'error',
  refunded: 'secondary',
})[status] ?? 'secondary'

const ticketStatusColor = status => ({
  valid: 'success',
  used: 'info',
  expired: 'warning',
  cancelled: 'error',
  refunded: 'secondary',
})[status] ?? 'secondary'

const goBack = () => router.push('/orders')

/* ─────────────────────────────────────────────────────────────────────────
 * Tables
 * ────────────────────────────────────────────────────────────────────── */
const itemHeaders = [
  { title: 'Type de billet', key: 'ticketType' },
  { title: 'Quantité', key: 'quantity' },
  { title: 'Prix unitaire', key: 'unitPrice' },
  { title: 'Sous-total', key: 'subtotal' },
]

/**
 * L'événement de la commande et son organisateur.
 *
 * Lus sur les lignes : c'est le type de billet qui porte l'événement. Une
 * commande n'en concerne qu'un en pratique — la page passe par un événement —
 * mais on affiche le décompte si les données en contiennent plusieurs, plutôt
 * que d'en choisir un au hasard.
 */
const orderEvents = computed(() => {
  const seen = new Map()

  for (const item of items.value) {
    const event = item.ticketType?.event
    if (!event?.title || seen.has(event.title)) continue

    seen.set(event.title, {
      title: event.title,
      organizer: event.organizer?.companyName ?? null,
      venue: event.venue?.name ?? null,
      city: event.venue?.city ?? null,
    })
  }

  return [...seen.values()]
})

const ticketHeaders = [
  { title: 'N° billet', key: 'ticketNumber' },
  { title: 'Participant', key: 'attendeeName' },
  { title: 'Statut', key: 'status' },
  { title: 'Check-in', key: 'checkedIn' },
  { title: 'Actions', key: 'actions', sortable: false },
]

/* ─────────────────────────────────────────────────────────────────────────
 * Ticket actions
 * ────────────────────────────────────────────────────────────────────── */
const canCheckIn = ticket => !ticket?.isCheckedIn && ticket?.status === 'valid'

/**
 * Validation manuelle — même geste, mêmes précautions que sur « Billets
 * vendus » : aucun QR n'est lu, et l'API ne sait pas défaire un check-in.
 */
const isCheckInDialogOpen = ref(false)
const checkingInTicket = ref(null)

const openCheckInDialog = ticket => {
  checkingInTicket.value = ticket
  isCheckInDialogOpen.value = true
}

const confirmCheckIn = async () => {
  isSubmitting.value = true
  try {
    await $api(`/tickets/${checkingInTicket.value.id}/check-in`, { method: 'POST' })
    isCheckInDialogOpen.value = false
    notify('Entrée validée.')
    fetchOrder()
  } catch (err) {
    notify(err?.data?.message ?? 'Impossible de valider l\'entrée.', 'error')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <!-- ─── En-tête commande ─────────────────────────────────────────────── -->
    <VCard class="mb-6">
      <VCardText>
        <div
          v-if="orderLoading && !order"
          class="d-flex justify-center pa-6"
        >
          <VProgressCircular
            indeterminate
            color="primary"
          />
        </div>

        <div
          v-else-if="order"
          class="d-flex flex-wrap gap-6"
        >
          <VAvatar
            rounded="lg"
            size="88"
            color="primary"
            variant="tonal"
          >
            <VIcon
              icon="tabler-receipt"
              size="40"
            />
          </VAvatar>

          <div class="flex-grow-1">
            <div class="d-flex align-center justify-space-between flex-wrap gap-2">
              <h2
                class="text-h5 mb-0"
                style="font-family: monospace"
              >
                {{ order.orderNumber ? `#${order.orderNumber}` : '-' }}
              </h2>
              <VBtn
                variant="tonal"
                color="secondary"
                prepend-icon="tabler-arrow-left"
                @click="goBack"
              >
                Retour
              </VBtn>
            </div>

            <VChip
              :color="orderStatusColor(order.status)"
              size="small"
              variant="tonal"
              class="mt-2"
            >
              {{ order.statusLabel }}
            </VChip>

            <div class="mt-4 d-flex flex-column gap-2 text-body-2">
              <div class="d-flex align-center gap-2">
                <VIcon
                  icon="tabler-user"
                  size="18"
                />
                <span>{{ order.fullName ?? '-' }}</span>
              </div>
              <div class="d-flex align-center gap-2">
                <VIcon
                  icon="tabler-mail"
                  size="18"
                />
                <span>{{ order.email ?? '-' }}</span>
              </div>
              <div class="d-flex align-center gap-2">
                <VIcon
                  icon="tabler-phone"
                  size="18"
                />
                <span>{{ order.phone ?? '-' }}</span>
              </div>
              <div class="d-flex align-center gap-2">
                <VIcon
                  icon="tabler-cash"
                  size="18"
                />
                <span class="font-weight-medium">{{ formatPrice(order.totalAmount) }}</span>
              </div>
              <div class="d-flex align-center gap-2">
                <VIcon
                  icon="tabler-truck-delivery"
                  size="18"
                />
                <span>{{ order.deliveryMethodLabel ?? '-' }}</span>
              </div>

              <!--
                L'événement et son organisateur : ce qu'on cherche en ouvrant
                une commande, avant même son contenu détaillé. 
              -->
              <div
                v-for="event in orderEvents"
                :key="event.title"
                class="d-flex align-center gap-2"
              >
                <VIcon
                  icon="tabler-calendar-event"
                  size="18"
                />
                <span>
                  <span class="font-weight-medium">{{ event.title }}</span>
                  <span
                    v-if="event.organizer"
                    class="text-medium-emphasis"
                  > · {{ event.organizer }}</span>
                  <span
                    v-if="event.venue"
                    class="text-medium-emphasis"
                  > · {{ event.venue }}<template v-if="event.city">, {{ event.city }}</template></span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </VCardText>
    </VCard>

    <!-- ─── Onglets ──────────────────────────────────────────────────────── -->
    <VCard>
      <VTabs v-model="activeTab">
        <VTab value="items">
          <VIcon
            start
            icon="tabler-list-details"
          />
          Billets commandés
        </VTab>
        <VTab value="tickets">
          <VIcon
            start
            icon="tabler-ticket"
          />
          Billets
        </VTab>
      </VTabs>

      <VDivider />

      <VWindow
        v-model="activeTab"
        class="disable-tab-transition"
      >
        <!-- ═══ Billets commandés ═════════════════════════════════════════ -->
        <VWindowItem value="items">
          <VDataTable
            :headers="itemHeaders"
            :items="items"
            :loading="orderLoading"
            no-data-text="Aucun article"
            class="text-no-wrap"
            hide-default-footer
            :items-per-page="-1"
          >
            <template #item.ticketType="{ item }">
              {{ item.ticketType?.name ?? '-' }}
            </template>

            <template #item.quantity="{ item }">
              {{ item.quantity ?? 0 }}
            </template>

            <template #item.unitPrice="{ item }">
              {{ formatPrice(item.unitPrice) }}
            </template>

            <template #item.subtotal="{ item }">
              <span class="font-weight-medium">{{ formatPrice(item.subtotal) }}</span>
            </template>
          </VDataTable>
        </VWindowItem>

        <!-- ═══ Billets ═══════════════════════════════════════════════════ -->
        <VWindowItem value="tickets">
          <VDataTable
            :headers="ticketHeaders"
            :items="tickets"
            :loading="orderLoading"
            no-data-text="Aucun billet"
            class="text-no-wrap"
            hide-default-footer
            :items-per-page="-1"
          >
            <template #item.ticketNumber="{ item }">
              <span
                class="font-weight-medium"
                style="font-family: monospace"
              >
                {{ item.ticketNumber ?? '-' }}
              </span>
            </template>

            <template #item.attendeeName="{ item }">
              {{ item.attendeeName ?? '-' }}
            </template>

            <template #item.status="{ item }">
              <VChip
                :color="ticketStatusColor(item.status)"
                size="small"
                variant="tonal"
              >
                {{ item.statusLabel ?? item.status }}
              </VChip>
            </template>

            <template #item.checkedIn="{ item }">
              <VChip
                :color="item.isCheckedIn ? 'success' : 'secondary'"
                size="small"
                variant="tonal"
              >
                {{ item.isCheckedIn ? 'Oui' : 'Non' }}
              </VChip>
            </template>

            <template #item.actions="{ item }">
              <VTooltip
                v-if="canCheckIn(item)"
                text="Valider l'entrée (manuel)"
                location="top"
              >
                <template #activator="{ props }">
                  <VBtn
                    v-bind="props"
                    icon
                    variant="text"
                    size="small"
                    color="success"
                    :disabled="isSubmitting"
                    @click="openCheckInDialog(item)"
                  >
                    <VIcon icon="tabler-door-enter" />
                  </VBtn>
                </template>
              </VTooltip>

              <span
                v-if="!canCheckIn(item)"
                class="text-medium-emphasis"
              >-</span>
            </template>
          </VDataTable>
        </VWindowItem>
      </VWindow>
    </VCard>

    <!-- ─── Dialog Validation manuelle ──────────────────────────────────────── -->
    <VDialog
      v-model="isCheckInDialogOpen"
      max-width="480"
    >
      <VCard title="Valider l'entrée">
        <VCardText class="pt-4">
          <p class="text-body-2 mb-3">
            Valider manuellement le billet
            <strong>{{ checkingInTicket?.ticketNumber }}</strong>
            <template v-if="checkingInTicket?.attendeeName">
              ({{ checkingInTicket.attendeeName }})
            </template>
            ?
          </p>
          <VAlert
            type="warning"
            variant="tonal"
            density="compact"
          >
            L'entrée sera enregistrée définitivement, sans scan du QR code.
          </VAlert>
        </VCardText>
        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isCheckInDialogOpen = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="success"
            :loading="isSubmitting"
            @click="confirmCheckIn"
          >
            Valider l'entrée
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
