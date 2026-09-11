<script setup>
import { notify, notifyApiError } from '@/utils/toast'

import { formatDateFr } from '@/utils/dateFormat'

definePage({
  meta: {
    action: 'read',
    subject: 'events',
  },
})

import { $api, toMediaUrl } from '@/utils/api'

const route = useRoute()
const router = useRouter()
const eventId = route.params.id

// Open the tab requested via ?tab= (e.g. from the "Gérer la billetterie"
// action on the events list), defaulting to occurrences.
const activeTab = ref(['occurrences', 'ticket-types', 'stats', 'check-in'].includes(route.query.tab) ? route.query.tab : 'occurrences')

/* ─────────────────────────────────────────────────────────────────────────
 * Event header
 * ────────────────────────────────────────────────────────────────────── */
const eventUrl = computed(() => `/events/${eventId}`)
const { data: eventResp, isFetching: eventLoading } = useApi(eventUrl)
const event = computed(() => eventResp.value?.data ?? null)

/** Affiche en grand (voir ImageLightbox). */
const isBannerOpen = ref(false)

const eventStatusColor = status => ({
  draft: 'secondary',
  published: 'success',
  cancelled: 'error',
  finished: 'info',
})[status] ?? 'secondary'

const goBack = () => router.push('/events')

/* ─────────────────────────────────────────────────────────────────────────
 * Shared helpers
 * ────────────────────────────────────────────────────────────────────── */
const isSubmitting = ref(false)

const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))} FCFA`

const toDatetimeLocal = dateObj =>
  dateObj?.datetime ? dateObj.datetime.slice(0, 16) : ''

/* ─────────────────────────────────────────────────────────────────────────
 * Occurrences
 * ────────────────────────────────────────────────────────────────────── */
const occPage = ref(1)
const occUrl = computed(() => `/events/${eventId}/occurrences?page=${occPage.value}`)
const { data: occResp, isFetching: occLoading, execute: fetchOccurrences } = useApi(occUrl)

const occurrences = computed(() => occResp.value?.data ?? [])
const totalOccurrences = computed(() => occResp.value?.meta?.total ?? 0)

const onOccOptions = ({ page }) => {
  if (page && page !== occPage.value) occPage.value = page
}

const occHeaders = [
  { title: 'Début', key: 'start' },
  { title: 'Fin', key: 'end' },
  { title: 'Capacité', key: 'capacity' },
  { title: 'Statut', key: 'status' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const occStatusOptions = [
  { title: 'Actif', value: 'active' },
  { title: 'Complet', value: 'sold_out' },
  { title: 'Annulé', value: 'cancelled' },
]

const occStatusColor = status => ({
  active: 'success',
  sold_out: 'warning',
  cancelled: 'error',
})[status] ?? 'secondary'

const occStatusLabel = status => ({
  active: 'Actif',
  sold_out: 'Complet',
  cancelled: 'Annulé',
})[status] ?? status

const isOccDialogOpen = ref(false)
const isOccDeleteDialogOpen = ref(false)
const editingOccurrence = ref(null)
const deletingOccurrence = ref(null)
const occFormRef = ref()
const occErrors = ref({})

const occForm = reactive({
  start_date: '',
  end_date: '',
  max_attendees: '',
  status: 'active',
  notes: '',
})

// Une représentation vit dans la période de l'événement : on borne la saisie au
// créneau [début, fin] de l'événement (et la fin ne précède pas le début
// saisi). Mêmes garde-fous que l'API, mais dès la saisie.
const eventStartInput = computed(() => toDatetimeLocal(event.value?.startDate))
const eventEndInput = computed(() => toDatetimeLocal(event.value?.endDate))
const occEndMin = computed(() => occForm.start_date || eventStartInput.value)

const resetOccForm = () => {
  occForm.start_date = ''
  occForm.end_date = ''
  occForm.max_attendees = ''
  occForm.status = 'active'
  occForm.notes = ''
  occErrors.value = {}
  editingOccurrence.value = null
}

const openOccCreateDialog = () => {
  resetOccForm()
  isOccDialogOpen.value = true
}

const openOccEditDialog = occ => {
  resetOccForm()
  editingOccurrence.value = occ
  occForm.start_date = toDatetimeLocal(occ.startDate)
  occForm.end_date = toDatetimeLocal(occ.endDate)
  occForm.max_attendees = occ.maxAttendees ?? ''
  occForm.status = occ.status ?? 'active'
  occForm.notes = occ.notes ?? ''
  isOccDialogOpen.value = true
}

const openOccDeleteDialog = occ => {
  deletingOccurrence.value = occ
  isOccDeleteDialogOpen.value = true
}

const saveOccurrence = async () => {
  const validation = occFormRef.value ? await occFormRef.value.validate() : { valid: true }
  if (!validation.valid) return

  isSubmitting.value = true
  occErrors.value = {}
  try {
    const payload = {
      start_date: occForm.start_date,
      end_date: occForm.end_date,
      status: occForm.status,
    }

    if (occForm.max_attendees !== '' && occForm.max_attendees !== null)
      payload.max_attendees = Number(occForm.max_attendees)
    if (occForm.notes) payload.notes = occForm.notes

    if (editingOccurrence.value) {
      await $api(`/event-occurrences/${editingOccurrence.value.id}`, { method: 'PUT', body: payload })
    } else {
      payload.event_id = eventId
      await $api('/event-occurrences', { method: 'POST', body: payload })
    }
    isOccDialogOpen.value = false
    notify(editingOccurrence.value ? 'Occurrence mise à jour.' : 'Occurrence ajoutée.')
    fetchOccurrences()
  } catch (err) {
    const errors = err?.data?.errors ?? err?.response?._data?.errors

    occErrors.value = errors ?? {}
    if (!errors) notifyApiError(err, "Impossible d'enregistrer l'occurrence.")
  } finally {
    isSubmitting.value = false
  }
}

const confirmOccDelete = async () => {
  isSubmitting.value = true
  try {
    await $api(`/event-occurrences/${deletingOccurrence.value.id}`, { method: 'DELETE' })
    isOccDeleteDialogOpen.value = false
    notify('Occurrence supprimée.')
    fetchOccurrences()
  } catch (error) {
    notifyApiError(error, "Impossible de supprimer l'occurrence.")
  } finally {
    isSubmitting.value = false
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * Ticket types
 * ────────────────────────────────────────────────────────────────────── */
const ticketPage = ref(1)
const ticketUrl = computed(() => `/events/${eventId}/ticket-types?page=${ticketPage.value}`)
const { data: ticketResp, isFetching: ticketLoading, execute: fetchTickets } = useApi(ticketUrl)

const ticketTypes = computed(() => ticketResp.value?.data ?? [])
const totalTickets = computed(() => ticketResp.value?.meta?.total ?? 0)

const onTicketOptions = ({ page }) => {
  if (page && page !== ticketPage.value) ticketPage.value = page
}

const ticketHeaders = [
  { title: 'Nom', key: 'name' },
  { title: 'Prix', key: 'price' },
  { title: 'Stock', key: 'stock' },
  { title: 'Disponibilité', key: 'availability' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const isTicketDialogOpen = ref(false)
const isTicketDeleteDialogOpen = ref(false)
const editingTicket = ref(null)
const deletingTicket = ref(null)
const ticketFormRef = ref()
const ticketErrors = ref({})

const ticketForm = reactive({
  occurrence_id: null,
  name: '',
  description: '',
  price: '',
  quantity: '',
  sale_start_date: '',
  sale_end_date: '',
  benefits: [],
  location_details: '',
  is_featured: false,
  sort_order: '',
  promotional_price: '',
  promotion_start_date: '',
  promotion_end_date: '',
})

// Bornes des dates du billet : la vente reste dans l'événement, la promotion
// dans la vente (mêmes garde-fous que l'API, dès la saisie). `undefined` laisse
// la borne libre quand la référence n'est pas encore saisie.
const saleEndMin = computed(() => ticketForm.sale_start_date || undefined)
const promoStartMin = computed(() => ticketForm.sale_start_date || undefined)
const promoStartMax = computed(() => ticketForm.sale_end_date || eventEndInput.value || undefined)
const promoEndMin = computed(() => ticketForm.promotion_start_date || ticketForm.sale_start_date || undefined)
const promoEndMax = computed(() => ticketForm.sale_end_date || eventEndInput.value || undefined)

// Occurrences the ticket type can be tied to (for multi-date events).
const occurrenceOptions = computed(() => occurrences.value.map(o => ({
  value: o.id,
  title: formatDateFr(o.startDate) || o.startDate?.datetime || 'Séance',
})))

const resetTicketForm = () => {
  ticketForm.occurrence_id = null
  ticketForm.name = ''
  ticketForm.description = ''
  ticketForm.price = ''
  ticketForm.quantity = ''
  ticketForm.sale_start_date = ''
  ticketForm.sale_end_date = ''
  ticketForm.benefits = []
  ticketForm.location_details = ''
  ticketForm.is_featured = false
  ticketForm.sort_order = ''
  ticketForm.promotional_price = ''
  ticketForm.promotion_start_date = ''
  ticketForm.promotion_end_date = ''
  ticketErrors.value = {}
  editingTicket.value = null
}

const openTicketCreateDialog = () => {
  resetTicketForm()
  isTicketDialogOpen.value = true
}

const openTicketEditDialog = ticket => {
  resetTicketForm()
  editingTicket.value = ticket
  ticketForm.occurrence_id = ticket.occurrenceId ?? null
  ticketForm.name = ticket.name ?? ''
  ticketForm.description = ticket.description ?? ''
  ticketForm.price = ticket.price ?? ''
  ticketForm.quantity = ticket.quantity ?? ''
  ticketForm.sale_start_date = toDatetimeLocal(ticket.saleStartDate)
  ticketForm.sale_end_date = toDatetimeLocal(ticket.saleEndDate)
  ticketForm.benefits = Array.isArray(ticket.benefits) ? [...ticket.benefits] : []
  ticketForm.location_details = ticket.locationDetails ?? ''
  ticketForm.is_featured = !!ticket.isFeatured
  ticketForm.sort_order = ticket.sortOrder ?? ''
  ticketForm.promotional_price = ticket.promotionalPrice ?? ''
  ticketForm.promotion_start_date = toDatetimeLocal(ticket.promotionStartDate)
  ticketForm.promotion_end_date = toDatetimeLocal(ticket.promotionEndDate)
  isTicketDialogOpen.value = true
}

const openTicketDeleteDialog = ticket => {
  deletingTicket.value = ticket
  isTicketDeleteDialogOpen.value = true
}

const saveTicket = async () => {
  const validation = ticketFormRef.value ? await ticketFormRef.value.validate() : { valid: true }
  if (!validation.valid) return

  isSubmitting.value = true
  ticketErrors.value = {}
  try {
    const payload = {
      name: ticketForm.name,
      price: Number(ticketForm.price),
      quantity: Number(ticketForm.quantity),
      is_featured: ticketForm.is_featured,
      benefits: ticketForm.benefits ?? [],
    }

    if (ticketForm.occurrence_id) payload.occurrence_id = ticketForm.occurrence_id
    if (ticketForm.description) payload.description = ticketForm.description
    if (ticketForm.sale_start_date) payload.sale_start_date = ticketForm.sale_start_date
    if (ticketForm.sale_end_date) payload.sale_end_date = ticketForm.sale_end_date
    if (ticketForm.location_details) payload.location_details = ticketForm.location_details
    if (ticketForm.sort_order !== '' && ticketForm.sort_order !== null)
      payload.sort_order = Number(ticketForm.sort_order)
    if (ticketForm.promotional_price !== '' && ticketForm.promotional_price !== null) {
      payload.promotional_price = Number(ticketForm.promotional_price)
      payload.promotion_start_date = ticketForm.promotion_start_date
      payload.promotion_end_date = ticketForm.promotion_end_date
    }

    if (editingTicket.value) {
      await $api(`/events/${eventId}/ticket-types/${editingTicket.value.id}`, { method: 'PUT', body: payload })
    } else {
      await $api(`/events/${eventId}/ticket-types`, { method: 'POST', body: payload })
    }
    isTicketDialogOpen.value = false
    notify(editingTicket.value ? 'Type de billet mis à jour.' : 'Type de billet créé.')
    fetchTickets()
  } catch (err) {
    const errors = err?.data?.errors ?? err?.response?._data?.errors

    ticketErrors.value = errors ?? {}
    if (!errors) notifyApiError(err, "Impossible d'enregistrer le type de billet.")
  } finally {
    isSubmitting.value = false
  }
}

const confirmTicketDelete = async () => {
  isSubmitting.value = true
  try {
    await $api(`/events/${eventId}/ticket-types/${deletingTicket.value.id}`, { method: 'DELETE' })
    isTicketDeleteDialogOpen.value = false
    notify('Type de billet supprimé.')
    fetchTickets()
  } catch (error) {
    notifyApiError(error, 'Impossible de supprimer le type de billet.')
  } finally {
    isSubmitting.value = false
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * Box-office report (per ticket type: sold / scanned / revenue / commission)
 * ────────────────────────────────────────────────────────────────────── */
const statsUrl = computed(() => `/events/${eventId}/stats`)
const { data: statsResp, isFetching: statsLoading, execute: fetchStats } = useApi(statsUrl)

const stats = computed(() => statsResp.value?.data ?? null)
const statsRows = computed(() => stats.value?.ticketTypes ?? [])
const statsTotals = computed(() => stats.value?.totals ?? null)

// Live (silent) refresh: a purchase or a scan changes these numbers. L'onglet
// contrôle d'accès affiche le compteur « entrées / vendus », il a donc besoin
// des mêmes chiffres.
const NEEDS_STATS = ['stats', 'check-in']

useRealtimeRefresh('tickets', () => { if (NEEDS_STATS.includes(activeTab.value)) fetchStats() })
useRealtimeRefresh('orders', () => { if (NEEDS_STATS.includes(activeTab.value)) fetchStats() })

// Declared event capacity, falling back to the total of ticket-type quantities.
const maxCapacity = computed(() => stats.value?.event?.maxAttendees ?? statsTotals.value?.quantity ?? 0)

const commissionPct = computed(() => Math.round((stats.value?.commissionRate ?? 0) * 100))

const formatNumber = value => new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))

const statsHeaders = [
  { title: 'Type de billet', key: 'name' },
  { title: 'Prix', key: 'price', align: 'end' },
  { title: 'Quantité max', key: 'quantity', align: 'end' },
  { title: 'Vendus', key: 'sold', align: 'end' },
  { title: 'Scannés', key: 'scanned', align: 'end' },
  { title: 'Non scannés', key: 'notScanned', align: 'end' },
  { title: 'Non vendus', key: 'notSold', align: 'end' },
  { title: 'Chiffre d\'affaires', key: 'revenue', align: 'end' },
  { title: 'Commission', key: 'commission', align: 'end' },
]
</script>

<template>
  <div>
    <!-- ─── En-tête événement ────────────────────────────────────────────── -->
    <VCard class="mb-6">
      <VCardText>
        <div
          v-if="eventLoading && !event"
          class="d-flex justify-center pa-6"
        >
          <VProgressCircular
            indeterminate
            color="primary"
          />
        </div>

        <div
          v-else-if="event"
          class="d-flex flex-wrap gap-6"
        >
          <!-- Cliquable : l'affiche en grand, pour la vérifier. -->
          <VImg
            v-if="event.banner"
            :src="toMediaUrl(event.banner)"
            :width="220"
            :height="140"
            cover
            rounded="lg"
            class="flex-grow-0 cursor-pointer"
            @click="isBannerOpen = true"
          />
          <VAvatar
            v-else
            rounded="lg"
            size="140"
            color="primary"
            variant="tonal"
          >
            <VIcon
              icon="tabler-calendar-event"
              size="48"
            />
          </VAvatar>

          <div class="flex-grow-1">
            <div class="d-flex align-center justify-space-between flex-wrap gap-2">
              <h2 class="text-h5 mb-0">
                {{ event.title }}
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
              :color="eventStatusColor(event.status)"
              size="small"
              variant="tonal"
              class="mt-2"
            >
              {{ event.statusLabel }}
            </VChip>

            <div class="mt-4 d-flex flex-column gap-2 text-body-2">
              <div class="d-flex align-center gap-2">
                <VIcon
                  icon="tabler-calendar"
                  size="18"
                />
                <span>{{ formatDateFr(event.startDate) }} → {{ formatDateFr(event.endDate) }}</span>
              </div>
              <div class="d-flex align-center gap-2">
                <VIcon
                  icon="tabler-category"
                  size="18"
                />
                <span>{{ event.category?.name ?? '-' }}</span>
              </div>
              <div class="d-flex align-center gap-2">
                <VIcon
                  icon="tabler-map-pin"
                  size="18"
                />
                <span>{{ event.venue?.name ?? '-' }}</span>
              </div>
            </div>
          </div>
        </div>
      </VCardText>
    </VCard>

    <!-- ─── Onglets ──────────────────────────────────────────────────────── -->
    <VCard>
      <VTabs v-model="activeTab">
        <VTab value="occurrences">
          <VIcon
            start
            icon="tabler-calendar-repeat"
          />
          Occurrences
        </VTab>
        <VTab value="ticket-types">
          <VIcon
            start
            icon="tabler-ticket"
          />
          Types de billets
        </VTab>
        <VTab value="stats">
          <VIcon
            start
            icon="tabler-chart-bar"
          />
          Statistiques
        </VTab>
        <VTab value="check-in">
          <VIcon
            start
            icon="tabler-qrcode"
          />
          Contrôle d'accès
        </VTab>
      </VTabs>

      <VDivider />

      <VWindow
        v-model="activeTab"
        class="disable-tab-transition"
      >
        <!-- ═══ Occurrences ═══════════════════════════════════════════════ -->
        <VWindowItem value="occurrences">
          <VCardTitle class="d-flex align-center justify-space-between pa-4">
            <span class="text-h6">Occurrences</span>
            <VBtn
              color="primary"
              prepend-icon="tabler-plus"
              @click="openOccCreateDialog"
            >
              Ajouter une occurrence
            </VBtn>
          </VCardTitle>

          <VDivider />

          <VDataTableServer
            :headers="occHeaders"
            :items="occurrences"
            :items-length="totalOccurrences"
            :items-per-page="15"
            :page="occPage"
            :loading="occLoading"
            no-data-text="Aucune occurrence"
            class="text-no-wrap"
            @update:options="onOccOptions"
          >
            <template #item.start="{ item }">
              {{ formatDateFr(item.startDate) }}
            </template>

            <template #item.end="{ item }">
              {{ formatDateFr(item.endDate) }}
            </template>

            <template #item.capacity="{ item }">
              <div style="min-width: 150px">
                <div class="text-caption mb-1">
                  {{ item.currentAttendees ?? 0 }} / {{ item.maxAttendees ?? '∞' }}
                </div>
                <VProgressLinear
                  :model-value="item.availabilityPercentage ?? 0"
                  color="success"
                  height="6"
                  rounded
                />
              </div>
            </template>

            <template #item.status="{ item }">
              <VChip
                :color="occStatusColor(item.status)"
                size="small"
                variant="tonal"
              >
                {{ occStatusLabel(item.status) }}
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
                    @click="openOccEditDialog(item)"
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
                    @click="openOccDeleteDialog(item)"
                  >
                    <VIcon icon="tabler-trash" />
                  </VBtn>
                </template>
              </VTooltip>
            </template>
          </VDataTableServer>
        </VWindowItem>

        <!-- ═══ Types de billets ══════════════════════════════════════════ -->
        <VWindowItem value="ticket-types">
          <VCardTitle class="d-flex align-center justify-space-between pa-4">
            <span class="text-h6">Types de billets</span>
            <VBtn
              color="primary"
              prepend-icon="tabler-plus"
              @click="openTicketCreateDialog"
            >
              Ajouter un type
            </VBtn>
          </VCardTitle>

          <VDivider />

          <VDataTableServer
            :headers="ticketHeaders"
            :items="ticketTypes"
            :items-length="totalTickets"
            :items-per-page="15"
            :page="ticketPage"
            :loading="ticketLoading"
            no-data-text="Aucun type de billet"
            class="text-no-wrap"
            @update:options="onTicketOptions"
          >
            <template #item.name="{ item }">
              <div class="d-flex align-center gap-2">
                <VIcon
                  v-if="item.isFeatured"
                  icon="tabler-star-filled"
                  size="18"
                  color="warning"
                />
                <div>
                  <div class="font-weight-medium">
                    {{ item.name }}
                  </div>
                  <div
                    v-if="item.locationDetails"
                    class="text-caption text-medium-emphasis"
                  >
                    {{ item.locationDetails }}
                  </div>
                </div>
              </div>
            </template>

            <template #item.price="{ item }">
              <div v-if="item.hasActivePromotion">
                <span class="text-decoration-line-through text-medium-emphasis text-caption">
                  {{ formatPrice(item.price) }}
                </span>
                <div class="font-weight-medium text-success">
                  {{ formatPrice(item.currentPrice) }}
                  <VChip
                    v-if="item.discountPercentage"
                    size="x-small"
                    color="success"
                    variant="tonal"
                    class="ms-1"
                  >
                    -{{ item.discountPercentage }}%
                  </VChip>
                </div>
              </div>
              <span
                v-else
                class="font-weight-medium"
              >
                {{ formatPrice(item.price) }}
              </span>
            </template>

            <template #item.stock="{ item }">
              <div style="min-width: 150px">
                <div class="text-caption mb-1">
                  {{ item.soldQuantity ?? 0 }} / {{ item.quantity ?? 0 }}
                </div>
                <VProgressLinear
                  :model-value="item.soldPercentage ?? 0"
                  color="primary"
                  height="6"
                  rounded
                />
              </div>
            </template>

            <template #item.availability="{ item }">
              <VChip
                :color="item.availabilityStatusColor || 'secondary'"
                size="small"
                variant="tonal"
              >
                {{ item.availabilityStatusLabel }}
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
                    @click="openTicketEditDialog(item)"
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
                    @click="openTicketDeleteDialog(item)"
                  >
                    <VIcon icon="tabler-trash" />
                  </VBtn>
                </template>
              </VTooltip>
            </template>
          </VDataTableServer>
        </VWindowItem>

        <!-- ═══ Statistiques (rapport billetterie) ════════════════════════ -->
        <VWindowItem value="stats">
          <VCardText>
            <div
              v-if="statsLoading && !stats"
              class="d-flex justify-center pa-6"
            >
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>

            <template v-else>
              <!-- Cartes récapitulatives -->
              <VRow class="mb-2">
                <VCol
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <VCard
                    variant="tonal"
                    color="primary"
                  >
                    <VCardText class="d-flex align-center gap-3">
                      <VAvatar
                        rounded
                        variant="tonal"
                        color="primary"
                      >
                        <VIcon icon="tabler-users-group" />
                      </VAvatar>
                      <div>
                        <div class="text-caption">
                          Capacité max
                        </div>
                        <div class="text-h6">
                          {{ formatNumber(maxCapacity) }}
                        </div>
                      </div>
                    </VCardText>
                  </VCard>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <VCard
                    variant="tonal"
                    color="success"
                  >
                    <VCardText class="d-flex align-center gap-3">
                      <VAvatar
                        rounded
                        variant="tonal"
                        color="success"
                      >
                        <VIcon icon="tabler-ticket" />
                      </VAvatar>
                      <div>
                        <div class="text-caption">
                          Billets vendus
                        </div>
                        <div class="text-h6">
                          {{ formatNumber(statsTotals?.sold) }}
                          <span class="text-caption text-medium-emphasis">/ {{ formatNumber(statsTotals?.quantity) }}</span>
                        </div>
                      </div>
                    </VCardText>
                  </VCard>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <VCard
                    variant="tonal"
                    color="info"
                  >
                    <VCardText class="d-flex align-center gap-3">
                      <VAvatar
                        rounded
                        variant="tonal"
                        color="info"
                      >
                        <VIcon icon="tabler-qrcode" />
                      </VAvatar>
                      <div>
                        <div class="text-caption">
                          Scannés (entrés)
                        </div>
                        <div class="text-h6">
                          {{ formatNumber(statsTotals?.scanned) }}
                          <span class="text-caption text-medium-emphasis">/ {{ formatNumber(statsTotals?.sold) }}</span>
                        </div>
                      </div>
                    </VCardText>
                  </VCard>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <VCard
                    variant="tonal"
                    color="warning"
                  >
                    <VCardText class="d-flex align-center gap-3">
                      <VAvatar
                        rounded
                        variant="tonal"
                        color="warning"
                      >
                        <VIcon icon="tabler-cash" />
                      </VAvatar>
                      <div>
                        <div class="text-caption">
                          Chiffre d'affaires
                        </div>
                        <div class="text-h6">
                          {{ formatPrice(statsTotals?.revenue) }}
                        </div>
                      </div>
                    </VCardText>
                  </VCard>
                </VCol>
              </VRow>

              <p class="text-caption text-medium-emphasis mb-4">
                Commission TicketExpress : {{ commissionPct }} % — total généré
                <strong>{{ formatPrice(statsTotals?.commission) }}</strong>.
                « Non scannés » = vendus mais pas encore entrés ; « Non vendus » = places restantes.
              </p>

              <!-- Tableau par type de billet -->
              <VDataTable
                :headers="statsHeaders"
                :items="statsRows"
                :items-per-page="-1"
                no-data-text="Aucun type de billet"
                class="text-no-wrap"
                hide-default-footer
              >
                <template #item.name="{ item }">
                  <span class="font-weight-medium">{{ item.name }}</span>
                </template>
                <template #item.price="{ item }">
                  {{ formatPrice(item.price) }}
                </template>
                <template #item.quantity="{ item }">
                  {{ formatNumber(item.quantity) }}
                </template>
                <template #item.sold="{ item }">
                  <span class="text-success font-weight-medium">{{ formatNumber(item.sold) }}</span>
                </template>
                <template #item.scanned="{ item }">
                  <span class="text-info font-weight-medium">{{ formatNumber(item.scanned) }}</span>
                </template>
                <template #item.notScanned="{ item }">
                  {{ formatNumber(item.notScanned) }}
                </template>
                <template #item.notSold="{ item }">
                  {{ formatNumber(item.notSold) }}
                </template>
                <template #item.revenue="{ item }">
                  <span class="font-weight-medium">{{ formatPrice(item.revenue) }}</span>
                </template>
                <template #item.commission="{ item }">
                  <span class="text-warning font-weight-medium">{{ formatPrice(item.commission) }}</span>
                </template>

                <template #body.append>
                  <tr class="font-weight-bold">
                    <td>Total</td>
                    <td class="text-end" />
                    <td class="text-end">
                      {{ formatNumber(statsTotals?.quantity) }}
                    </td>
                    <td class="text-end">
                      {{ formatNumber(statsTotals?.sold) }}
                    </td>
                    <td class="text-end">
                      {{ formatNumber(statsTotals?.scanned) }}
                    </td>
                    <td class="text-end">
                      {{ formatNumber(statsTotals?.notScanned) }}
                    </td>
                    <td class="text-end">
                      {{ formatNumber(statsTotals?.notSold) }}
                    </td>
                    <td class="text-end">
                      {{ formatPrice(statsTotals?.revenue) }}
                    </td>
                    <td class="text-end">
                      {{ formatPrice(statsTotals?.commission) }}
                    </td>
                  </tr>
                </template>
              </VDataTable>
            </template>
          </VCardText>
        </VWindowItem>

        <!-- ═══ Contrôle d'accès ══════════════════════════════════════════ -->
        <VWindowItem value="check-in">
          <EventCheckInPanel
            :event-id="String(eventId)"
            :sold="statsTotals?.sold ?? null"
            :scanned="statsTotals?.scanned ?? null"
            @validated="fetchStats"
          />
        </VWindowItem>
      </VWindow>
    </VCard>

    <!-- ─── Dialog Occurrence (Créer / Modifier) ─────────────────────────── -->
    <VDialog
      v-model="isOccDialogOpen"
      max-width="640"
      scrollable
    >
      <VCard :title="editingOccurrence ? 'Modifier l\'occurrence' : 'Ajouter une occurrence'">
        <VDivider />
        <VCardText class="pt-4">
          <VForm ref="occFormRef">
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="occForm.start_date"
                  label="Date et heure de début"
                  type="datetime-local"
                  :min="eventStartInput"
                  :max="eventEndInput"
                  :rules="[requiredField('Date et heure de début')]"
                  :error-messages="occErrors.start_date"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="occForm.end_date"
                  label="Date et heure de fin"
                  type="datetime-local"
                  :min="occEndMin"
                  :max="eventEndInput"
                  :rules="[requiredField('Date et heure de fin')]"
                  :error-messages="occErrors.end_date"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="occForm.max_attendees"
                  label="Capacité maximale"
                  type="number"
                  min="1"
                  placeholder="Illimitée si vide"
                  :error-messages="occErrors.max_attendees"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="occForm.status"
                  :items="occStatusOptions"
                  item-title="title"
                  item-value="value"
                  label="Statut"
                  :error-messages="occErrors.status"
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="occForm.notes"
                  label="Notes"
                  rows="3"
                  counter="1000"
                  :error-messages="occErrors.notes"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isOccDialogOpen = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="primary"
            :loading="isSubmitting"
            @click="saveOccurrence"
          >
            {{ editingOccurrence ? 'Enregistrer les modifications' : 'Créer l\'occurrence' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Suppression Occurrence ────────────────────────────────── -->
    <VDialog
      v-model="isOccDeleteDialogOpen"
      max-width="400"
    >
      <VCard title="Supprimer l'occurrence">
        <VCardText class="pt-4">
          <p class="text-body-2">
            Êtes-vous sûr de vouloir supprimer cette occurrence
            <strong>{{ formatDateFr(deletingOccurrence?.startDate) }}</strong> ?
            Cette action est irréversible.
          </p>
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isOccDeleteDialogOpen = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="error"
            :loading="isSubmitting"
            @click="confirmOccDelete"
          >
            Supprimer
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Type de billet (Créer / Modifier) ─────────────────────── -->
    <VDialog
      v-model="isTicketDialogOpen"
      max-width="640"
      scrollable
    >
      <VCard :title="editingTicket ? 'Modifier le type de billet' : 'Ajouter un type de billet'">
        <VDivider />
        <VCardText class="pt-4">
          <VForm ref="ticketFormRef">
            <VRow>
              <VCol
                v-if="occurrenceOptions.length"
                cols="12"
              >
                <VSelect
                  v-model="ticketForm.occurrence_id"
                  :items="occurrenceOptions"
                  item-title="title"
                  item-value="value"
                  label="Séance / occurrence (optionnel)"
                  placeholder="Toutes les dates"
                  clearable
                  hint="Laisser vide pour appliquer ce tarif à tout l'événement ; sinon choisir la date concernée."
                  persistent-hint
                />
              </VCol>
              <VCol
                cols="12"
                md="8"
              >
                <VTextField
                  v-model="ticketForm.name"
                  label="Nom"
                  placeholder="VIP, Standard, Early Bird..."
                  :rules="[requiredField('Nom')]"
                  :error-messages="ticketErrors.name"
                />
              </VCol>
              <VCol
                cols="12"
                md="4"
                class="d-flex align-center"
              >
                <VSwitch
                  v-model="ticketForm.is_featured"
                  label="Mis en avant"
                  :error-messages="ticketErrors.is_featured"
                />
              </VCol>

              <VCol cols="12">
                <VTextarea
                  v-model="ticketForm.description"
                  label="Description"
                  rows="2"
                  :error-messages="ticketErrors.description"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="ticketForm.price"
                  label="Prix (FCFA)"
                  type="number"
                  min="0"
                  :rules="[requiredField('Prix (FCFA)')]"
                  :error-messages="ticketErrors.price"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="ticketForm.quantity"
                  label="Quantité"
                  type="number"
                  min="1"
                  :rules="[requiredField('Quantité')]"
                  :error-messages="ticketErrors.quantity"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="ticketForm.sale_start_date"
                  label="Début des ventes"
                  type="datetime-local"
                  :max="eventEndInput || undefined"
                  :error-messages="ticketErrors.sale_start_date"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="ticketForm.sale_end_date"
                  label="Fin des ventes"
                  type="datetime-local"
                  :min="saleEndMin"
                  :max="eventEndInput || undefined"
                  :error-messages="ticketErrors.sale_end_date"
                />
              </VCol>

              <VCol cols="12">
                <VCombobox
                  v-model="ticketForm.benefits"
                  label="Avantages inclus"
                  placeholder="Appuyez sur Entrée pour ajouter"
                  multiple
                  chips
                  closable-chips
                  clearable
                  :error-messages="ticketErrors.benefits"
                />
              </VCol>

              <VCol cols="12">
                <VTextField
                  v-model="ticketForm.location_details"
                  label="Détails de l'emplacement"
                  counter="500"
                  :error-messages="ticketErrors.location_details"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="ticketForm.sort_order"
                  label="Ordre d'affichage"
                  type="number"
                  min="0"
                  :error-messages="ticketErrors.sort_order"
                />
              </VCol>

              <VCol cols="12">
                <VDivider class="my-2" />
                <p class="text-subtitle-2 mb-0">
                  Promotion (optionnelle)
                </p>
                <p class="text-caption text-medium-emphasis">
                  Les dates de promotion sont requises si un prix promotionnel est renseigné.
                </p>
              </VCol>

              <VCol
                cols="12"
                md="4"
              >
                <VTextField
                  v-model="ticketForm.promotional_price"
                  label="Prix promotionnel (FCFA)"
                  type="number"
                  min="0"
                  :error-messages="ticketErrors.promotional_price"
                />
              </VCol>
              <VCol
                cols="12"
                md="4"
              >
                <VTextField
                  v-model="ticketForm.promotion_start_date"
                  label="Début de la promotion"
                  type="datetime-local"
                  :min="promoStartMin"
                  :max="promoStartMax"
                  :error-messages="ticketErrors.promotion_start_date"
                />
              </VCol>
              <VCol
                cols="12"
                md="4"
              >
                <VTextField
                  v-model="ticketForm.promotion_end_date"
                  label="Fin de la promotion"
                  type="datetime-local"
                  :min="promoEndMin"
                  :max="promoEndMax"
                  :error-messages="ticketErrors.promotion_end_date"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isTicketDialogOpen = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="primary"
            :loading="isSubmitting"
            @click="saveTicket"
          >
            {{ editingTicket ? 'Enregistrer les modifications' : 'Créer le type' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Suppression Type de billet ────────────────────────────── -->
    <VDialog
      v-model="isTicketDeleteDialogOpen"
      max-width="400"
    >
      <VCard title="Supprimer le type de billet">
        <VCardText class="pt-4">
          <p class="text-body-2">
            Êtes-vous sûr de vouloir supprimer
            <strong>{{ deletingTicket?.name }}</strong> ?
            Cette action est irréversible.
          </p>
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isTicketDeleteDialogOpen = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="error"
            :loading="isSubmitting"
            @click="confirmTicketDelete"
          >
            Supprimer
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <ImageLightbox
      v-model="isBannerOpen"
      :src="event?.banner ? toMediaUrl(event.banner) : null"
      :title="event?.title"
    />
  </div>
</template>
