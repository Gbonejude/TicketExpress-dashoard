<script setup>
import { notify } from '@/utils/toast'
import { formatDateFr } from '@/utils/dateFormat'

definePage({
  meta: {
    action: 'read',
    subject: 'tickets',
  },
})

import { $api } from '@/utils/api'

const activeTab = ref('issued')

// ══════════════════════════════════════════════════════════════════════════
//  Onglet 1 — Tickets émis
// ══════════════════════════════════════════════════════════════════════════
const currentPage = ref(1)
const search = ref('')
const statusFilter = ref(null)
const checkinFilter = ref(null)

const statusOptions = [
  { title: 'Valide', value: 'valid' },
  { title: 'Utilisé', value: 'used' },
  { title: 'Annulé', value: 'cancelled' },
  { title: 'Remboursé', value: 'refunded' },
]

const checkinOptions = [
  { title: 'Scanné', value: 'true' },
  { title: 'Non scanné', value: 'false' },
]

const debouncedSearch = ref('')
let searchTimer = null

watch(search, value => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedSearch.value = value }, 400)
})

const headers = [
  { title: 'N° ticket', key: 'ticketNumber' },
  { title: 'Participant', key: 'attendee', sortable: false },
  { title: 'Événement', key: 'event', sortable: false },
  { title: 'Type', key: 'ticketType', sortable: false },
  { title: 'Montant', key: 'amount', sortable: false },
  { title: 'Billets', key: 'orderTickets', sortable: false },
  { title: 'Vendu le', key: 'soldAt', sortable: false },
  { title: 'Statut', key: 'status' },
  { title: 'Check-in (jour / heure)', key: 'checkin', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false },
]

const formatPrice = value =>
  value === null || value === undefined
    ? '—'
    : `${new Intl.NumberFormat('fr-FR').format(Number(value))} FCFA`

/**
 * Date de vente : celle de la commande, pas celle du billet.
 *
 * Le billet est créé au moment du paiement, les deux coïncident donc presque
 * toujours — mais l'achat est l'événement de référence, et c'est lui qu'un
 * gestionnaire recherche.
 */
const soldAt = ticket => ticket.order?.createdAt ?? ticket.createdAt

/**
 * Nombre de billets pris dans la même commande. `ticketsCount` compte les
 * billets émis ; à défaut, les quantités commandées.
 */
const orderTicketCount = ticket => {
  const issued = Number(ticket.order?.ticketsCount ?? 0)

  if (issued > 0) return issued

  return (ticket.order?.items ?? [])
    .reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)
}

// ─── Détail d'un billet ──────────────────────────────────────────────────────
const isShowDialogOpen = ref(false)
const shownTicket = ref(null)

const openShowDialog = ticket => {
  shownTicket.value = ticket
  isShowDialogOpen.value = true
}

const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })
  if (statusFilter.value) params.set('status', statusFilter.value)
  if (checkinFilter.value !== null) params.set('checked_in', checkinFilter.value)
  if (debouncedSearch.value) params.set('search', debouncedSearch.value)

  return `/tickets?${params.toString()}`
})

watch([statusFilter, checkinFilter, debouncedSearch], () => { currentPage.value = 1 })

const { data: ticketsData, isFetching, execute: fetchTickets } = useApi(apiUrl)

// Live (silent) refresh when a ticket is issued / scanned / downloaded.
useRealtimeRefresh('tickets', () => {
  fetchTickets()
  fetchDownloads?.()
})

const tickets = computed(() => ticketsData.value?.data ?? [])
const totalTickets = computed(() => ticketsData.value?.meta?.total ?? 0)

const onTableOptions = ({ page }) => {
  if (page && page !== currentPage.value) currentPage.value = page
}

const statusColor = status => ({
  valid: 'success',
  used: 'info',
  cancelled: 'error',
  refunded: 'secondary',
})[status] ?? 'secondary'

// Ticket actions (check-in / refund)
const isSubmitting = ref(false)
const isRefundDialogOpen = ref(false)
const refundingTicket = ref(null)
const refundReason = ref('')

const checkIn = async ticket => {
  isSubmitting.value = true
  try {
    await $api(`/tickets/${ticket.id}/check-in`, { method: 'POST' })
    notify('Ticket scanné avec succès.')
    fetchTickets()
  } catch (err) {
    notify(err?.data?.message ?? 'Impossible de scanner le ticket.', 'error')
  } finally {
    isSubmitting.value = false
  }
}

const openRefundDialog = ticket => {
  refundingTicket.value = ticket
  refundReason.value = ''
  isRefundDialogOpen.value = true
}

const confirmRefund = async () => {
  isSubmitting.value = true
  try {
    await $api(`/tickets/${refundingTicket.value.id}/refund`, {
      method: 'POST',
      body: { reason: refundReason.value || 'Demande de remboursement', force_refund: true },
    })
    isRefundDialogOpen.value = false
    notify('Ticket remboursé.')
    fetchTickets()
  } catch (err) {
    notify(err?.data?.message ?? 'Impossible de rembourser le ticket.', 'error')
  } finally {
    isSubmitting.value = false
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  Onglet 2 — Téléchargements
// ══════════════════════════════════════════════════════════════════════════
const dlPage = ref(1)
const dlSearch = ref('')
const dlStateFilter = ref(null)

const dlStateOptions = [
  { title: 'Valide', value: 'valid' },
  { title: 'Expiré', value: 'expired' },
  { title: 'Limite atteinte', value: 'limit_reached' },
]

const dlDebouncedSearch = ref('')
let dlTimer = null

watch(dlSearch, value => {
  clearTimeout(dlTimer)
  dlTimer = setTimeout(() => { dlDebouncedSearch.value = value }, 400)
})

const dlHeaders = [
  { title: 'N° commande', key: 'order', sortable: false },
  { title: 'Participant', key: 'participant', sortable: false },
  { title: 'Événement', key: 'event', sortable: false },
  { title: 'Billets', key: 'tickets', sortable: false },
  { title: 'Téléchargements', key: 'downloads' },
  { title: 'Expire le', key: 'expiresAt', sortable: false },
  { title: 'État', key: 'state' },
]

const dlUrl = computed(() => {
  const params = new URLSearchParams({ page: String(dlPage.value) })
  if (dlStateFilter.value) params.set('state', dlStateFilter.value)
  if (dlDebouncedSearch.value) params.set('search', dlDebouncedSearch.value)

  return `/ticket-downloads?${params.toString()}`
})

watch([dlStateFilter, dlDebouncedSearch], () => { dlPage.value = 1 })

const { data: downloadsData, isFetching: dlFetching, execute: fetchDownloads } = useApi(dlUrl)

const downloads = computed(() => downloadsData.value?.data ?? [])
const totalDownloads = computed(() => downloadsData.value?.meta?.total ?? 0)

const onDlTableOptions = ({ page }) => {
  if (page && page !== dlPage.value) dlPage.value = page
}

const dlStateColor = state => ({
  valid: 'success',
  expired: 'secondary',
  limit_reached: 'warning',
})[state] ?? 'secondary'

const dlStateLabel = state => ({
  valid: 'Valide',
  expired: 'Expiré',
  limit_reached: 'Limite atteinte',
})[state] ?? state
</script>

<template>
  <div>
    <VCard>
      <VTabs v-model="activeTab">
        <VTab value="issued">
          <VIcon
            start
            icon="tabler-ticket"
          />
          Billets vendus
        </VTab>
        <VTab value="downloads">
          <VIcon
            start
            icon="tabler-download"
          />
          Téléchargements
        </VTab>
      </VTabs>

      <VDivider />

      <VWindow v-model="activeTab">
        <!-- ═══ Tickets émis ═══════════════════════════════════════════════ -->
        <VWindowItem value="issued">
          <VCardText>
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="search"
                  label="Rechercher"
                  placeholder="N° ticket, nom ou email du participant…"
                  prepend-inner-icon="tabler-search"
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
                  placeholder="Tous"
                  density="compact"
                  clearable
                />
              </VCol>
              <VCol
                cols="12"
                md="3"
              >
                <VSelect
                  v-model="checkinFilter"
                  :items="checkinOptions"
                  item-title="title"
                  item-value="value"
                  label="Check-in"
                  placeholder="Tous"
                  density="compact"
                  clearable
                />
              </VCol>
            </VRow>
          </VCardText>

          <VDataTableServer
            :headers="headers"
            :items="tickets"
            :items-length="totalTickets"
            :items-per-page="15"
            :page="currentPage"
            :loading="isFetching"
            no-data-text="Aucun ticket"
            class="text-no-wrap"
            @update:options="onTableOptions"
          >
            <template #item.ticketNumber="{ item }">
              <span
                class="font-weight-medium"
                style="font-family: monospace"
              >
                {{ item.ticketNumber ?? '-' }}
              </span>
            </template>

            <!--
              Le téléphone remplace l'email : c'est par lui qu'on joint
              l'acheteur. Le billet est au porteur, la personne qui présente le QR
              peut donc être quelqu'un d'autre. 
            -->
            <template #item.attendee="{ item }">
              <div>
                <div class="font-weight-medium">
                  {{ item.attendeeName ?? '-' }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ item.order?.phone || '—' }}
                </div>
              </div>
            </template>

            <template #item.event="{ item }">
              <div
                class="text-body-2 text-truncate"
                style="max-width: 200px"
              >
                {{ item.ticketType?.event?.title ?? '-' }}
              </div>
            </template>

            <template #item.ticketType="{ item }">
              {{ item.ticketType?.name ?? '-' }}
            </template>

            <template #item.amount="{ item }">
              <span class="font-weight-medium">{{ formatPrice(item.amount) }}</span>
            </template>

            <template #item.orderTickets="{ item }">
              {{ orderTicketCount(item) }}
            </template>

            <template #item.soldAt="{ item }">
              {{ formatDateFr(soldAt(item)) }}
            </template>

            <template #item.status="{ item }">
              <VChip
                :color="statusColor(item.status)"
                size="small"
                variant="tonal"
              >
                {{ item.statusLabel ?? item.status }}
              </VChip>
            </template>

            <template #item.checkin="{ item }">
              <div v-if="item.isCheckedIn">
                {{ formatDateFr(item.checkedInAt) || 'Scanné' }}
              </div>
              <VChip
                v-else
                color="secondary"
                size="small"
                variant="tonal"
              >
                Non scanné
              </VChip>
            </template>

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
                    @click="openShowDialog(item)"
                  >
                    <VIcon icon="tabler-eye" />
                  </VBtn>
                </template>
              </VTooltip>

              <VTooltip
                v-if="item.status === 'valid' && !item.isCheckedIn"
                text="Check-in"
                location="top"
              >
                <template #activator="{ props }">
                  <VBtn
                    v-bind="props"
                    icon
                    variant="text"
                    size="small"
                    color="success"
                    @click="checkIn(item)"
                  >
                    <VIcon icon="tabler-qrcode" />
                  </VBtn>
                </template>
              </VTooltip>

              <VTooltip
                v-if="item.status === 'valid'"
                text="Rembourser"
                location="top"
              >
                <template #activator="{ props }">
                  <VBtn
                    v-bind="props"
                    icon
                    variant="text"
                    size="small"
                    color="warning"
                    @click="openRefundDialog(item)"
                  >
                    <VIcon icon="tabler-cash-banknote" />
                  </VBtn>
                </template>
              </VTooltip>
            </template>
          </VDataTableServer>
        </VWindowItem>

        <!-- ═══ Téléchargements ════════════════════════════════════════════ -->
        <VWindowItem value="downloads">
          <VCardText>
            <VRow>
              <VCol
                cols="12"
                md="8"
              >
                <VTextField
                  v-model="dlSearch"
                  label="Rechercher"
                  placeholder="N° commande, participant ou événement…"
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
                  v-model="dlStateFilter"
                  :items="dlStateOptions"
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
            :headers="dlHeaders"
            :items="downloads"
            :items-length="totalDownloads"
            :items-per-page="15"
            :page="dlPage"
            :loading="dlFetching"
            no-data-text="Aucun téléchargement"
            class="text-no-wrap"
            @update:options="onDlTableOptions"
          >
            <template #item.order="{ item }">
              <VChip
                v-if="item.order?.orderNumber"
                color="primary"
                size="small"
                variant="tonal"
                class="font-weight-medium"
              >
                #{{ item.order.orderNumber }}
              </VChip>
              <span
                v-else
                class="text-medium-emphasis"
              >-</span>
            </template>

            <template #item.participant="{ item }">
              <ParticipantCell
                :name="item.order?.fullName"
                :phone="item.order?.phone"
                :user="item.order?.user"
              />
            </template>

            <template #item.event="{ item }">
              <div
                class="text-body-2 text-truncate"
                style="max-width: 200px"
              >
                {{ (item.order?.events ?? []).join(', ') || '—' }}
              </div>
            </template>

            <template #item.tickets="{ item }">
              {{ item.order?.ticketsCount ?? 0 }}
            </template>

            <template #item.downloads="{ item }">
              <span class="font-weight-medium">{{ item.downloadCount ?? 0 }}</span>
              <span class="text-medium-emphasis"> / {{ item.maxDownloads ?? 0 }}</span>
            </template>

            <template #item.expiresAt="{ item }">
              {{ formatDateFr(item.expiresAt) }}
            </template>

            <template #item.state="{ item }">
              <VChip
                :color="dlStateColor(item.state)"
                size="small"
                variant="tonal"
              >
                {{ dlStateLabel(item.state) }}
              </VChip>
            </template>
          </VDataTableServer>
        </VWindowItem>
      </VWindow>
    </VCard>

    <!-- ─── Dialog Détail du billet ─────────────────────────────────────────── -->
    <VDialog
      v-model="isShowDialogOpen"
      max-width="600"
      scrollable
    >
      <VCard :title="`Billet ${shownTicket?.ticketNumber ?? ''}`">
        <VCardText class="pt-2">
          <div class="d-flex align-center gap-3 mb-4">
            <VChip
              :color="statusColor(shownTicket?.status)"
              size="small"
              variant="tonal"
            >
              {{ shownTicket?.statusLabel ?? shownTicket?.status }}
            </VChip>
            <VChip
              :color="shownTicket?.isCheckedIn ? 'info' : 'secondary'"
              size="small"
              variant="tonal"
            >
              {{ shownTicket?.isCheckedIn ? 'Entré' : 'Pas encore entré' }}
            </VChip>
          </div>

          <VRow dense>
            <VCol
              v-for="row in [
                { label: 'Événement', value: shownTicket?.ticketType?.event?.title ?? '—' },
                { label: 'Type de billet', value: shownTicket?.ticketType?.name ?? '—' },
                { label: 'Montant payé', value: formatPrice(shownTicket?.amount) },
                { label: 'Acheteur', value: shownTicket?.attendeeName ?? '—' },
                { label: 'Téléphone', value: shownTicket?.order?.phone || '—' },
                { label: 'Email', value: shownTicket?.attendeeEmail || '—' },
                { label: 'N° de commande', value: shownTicket?.order?.orderNumber ? `#${shownTicket.order.orderNumber}` : '—' },
                { label: 'Billets dans la commande', value: shownTicket ? orderTicketCount(shownTicket) : '—' },
                { label: 'Vendu le', value: formatDateFr(soldAt(shownTicket ?? {})) },
                { label: 'Check-in', value: shownTicket?.checkedInAt ? formatDateFr(shownTicket.checkedInAt) : 'Aucun' },
                { label: 'Accès', value: shownTicket?.accessMethod ?? '—' },
              ]"
              :key="row.label"
              cols="12"
              sm="6"
            >
              <div class="text-caption text-medium-emphasis">
                {{ row.label }}
              </div>
              <div class="text-body-1">
                {{ row.value }}
              </div>
            </VCol>

            <VCol
              v-if="shownTicket?.refundReason"
              cols="12"
            >
              <VAlert
                type="warning"
                variant="tonal"
                density="compact"
              >
                Remboursé : {{ shownTicket.refundReason }}
                <template v-if="shownTicket.refundedAt">
                  ({{ formatDateFr(shownTicket.refundedAt) }})
                </template>
              </VAlert>
            </VCol>
          </VRow>
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isShowDialogOpen = false"
          >
            Fermer
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Remboursement ─────────────────────────────────────────────── -->
    <VDialog
      v-model="isRefundDialogOpen"
      max-width="480"
    >
      <VCard title="Rembourser le ticket">
        <VCardText class="pt-4">
          <p class="text-body-2 mb-4">
            Rembourser le ticket
            <strong>{{ refundingTicket?.ticketNumber }}</strong> ?
          </p>
          <VTextarea
            v-model="refundReason"
            label="Motif (optionnel)"
            rows="2"
          />
        </VCardText>
        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isRefundDialogOpen = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="warning"
            :loading="isSubmitting"
            @click="confirmRefund"
          >
            Rembourser
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
