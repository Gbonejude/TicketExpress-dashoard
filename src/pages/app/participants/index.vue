<script setup>
import { $api, toMediaUrl } from '@/utils/api'
import { notifyApiError } from '@/utils/toast'

definePage({
  meta: {
    action: 'read',
    subject: 'users',
  },
})

/**
 * Participants — les acheteurs, vus par leurs achats.
 *
 * Séparé de Gestion des Utilisateurs, qui administre des comptes : ici on ne
 * modifie rien, on regarde combien quelqu'un a acheté, pour quel montant, sur
 * quels événements, et s'il est bien entré. Ce sont deux questions différentes
 * sur les mêmes personnes, et les mélanger donnait un tableau illisible.
 */
const currentPage = ref(1)
const search = ref('')
const sort = ref('recent')

const sortOptions = [
  { title: 'Plus récents', value: 'recent' },
  { title: 'ONT le plus dépensé', value: 'spent' },
  { title: 'Plus de commandes', value: 'tickets' },
]

const debouncedSearch = ref('')
let searchTimer = null

watch(search, value => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedSearch.value = value }, 400)
})

const headers = [
  { title: 'Participant', key: 'participant', sortable: false },
  { title: 'Téléphone', key: 'phone', sortable: false },
  { title: 'Commandes payées', key: 'paidOrders', sortable: false },
  { title: 'Billets', key: 'tickets', sortable: false },
  { title: 'Total dépensé', key: 'totalSpent', sortable: false },
  { title: 'Inscrit le', key: 'createdAt', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false },
]

const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })
  if (debouncedSearch.value) params.set('search', debouncedSearch.value)
  if (sort.value) params.set('sort', sort.value)

  return `/participants?${params.toString()}`
})

watch([debouncedSearch, sort], () => { currentPage.value = 1 })

const { data: listData, isFetching } = useApi(apiUrl)

const participants = computed(() => listData.value?.data ?? [])
const total = computed(() => listData.value?.meta?.total ?? 0)

const onTableOptions = ({ page }) => {
  if (page && page !== currentPage.value) currentPage.value = page
}

const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))} FCFA`

const formatDateTime = iso => {
  if (!iso) return '—'

  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

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

/* ─── Fiche ─────────────────────────────────────────────────────────────────── */
const isDetailOpen = ref(false)
const detail = ref(null)
const isDetailLoading = ref(false)
const detailTab = ref('orders')

const openDetail = async participant => {
  isDetailOpen.value = true
  detailTab.value = 'orders'
  isDetailLoading.value = true
  detail.value = null
  try {
    const res = await $api(`/participants/${participant.id}`)

    detail.value = res?.data ?? null
  } catch (error) {
    notifyApiError(error, 'Impossible de charger la fiche du participant.')
    isDetailOpen.value = false
  } finally {
    isDetailLoading.value = false
  }
}

const detailTotals = computed(() => detail.value?.totals ?? {})
const detailParticipant = computed(() => detail.value?.participant ?? {})
</script>

<template>
  <div>
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">Participants</span>
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
              placeholder="Nom, email ou téléphone…"
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
              v-model="sort"
              :items="sortOptions"
              item-title="title"
              item-value="value"
              label="Trier par"
              density="compact"
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="participants"
        :items-length="total"
        :items-per-page="15"
        :page="currentPage"
        :loading="isFetching"
        no-data-text="Aucun participant"
        class="text-no-wrap"
        @update:options="onTableOptions"
      >
        <template #item.participant="{ item }">
          <ParticipantCell
            :name="item.fullName"
            :phone="item.email"
            :user="item"
          />
        </template>

        <template #item.phone="{ item }">
          {{ item.phone || '—' }}
        </template>

        <template #item.paidOrders="{ item }">
          {{ item.paidOrders }}
        </template>

        <template #item.tickets="{ item }">
          <VChip
            :color="item.tickets > 0 ? 'primary' : 'secondary'"
            size="small"
            variant="tonal"
            class="font-weight-medium"
          >
            {{ item.tickets }}
          </VChip>
        </template>

        <template #item.totalSpent="{ item }">
          <span class="font-weight-medium">{{ formatPrice(item.totalSpent) }}</span>
        </template>

        <template #item.createdAt="{ item }">
          {{ formatDateTime(item.createdAt) }}
        </template>

        <template #item.actions="{ item }">
          <VTooltip
            text="Voir la fiche"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="default"
                @click="openDetail(item)"
              >
                <VIcon icon="tabler-eye" />
              </VBtn>
            </template>
          </VTooltip>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- ─── Fiche participant ───────────────────────────────────────────────── -->
    <VDialog
      v-model="isDetailOpen"
      max-width="900"
      scrollable
    >
      <VCard>
        <VCardText v-if="isDetailLoading">
          <div class="d-flex justify-center pa-8">
            <VProgressCircular
              indeterminate
              color="primary"
            />
          </div>
        </VCardText>

        <template v-else-if="detail">
          <VCardText class="pb-0">
            <div class="d-flex flex-wrap align-center gap-4">
              <VAvatar
                size="72"
                color="primary"
                variant="tonal"
              >
                <VImg
                  v-if="detailParticipant.thumbnail || detailParticipant.image"
                  :src="toMediaUrl(detailParticipant.thumbnail || detailParticipant.image)"
                  cover
                />
                <span
                  v-else
                  class="text-h6"
                >
                  {{ (detailParticipant.fullName ?? '?').charAt(0).toUpperCase() }}
                </span>
              </VAvatar>

              <div class="flex-grow-1">
                <div class="text-h6">
                  {{ detailParticipant.fullName }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ detailParticipant.phone || '—' }}
                  <template v-if="detailParticipant.email">
                    · {{ detailParticipant.email }}
                  </template>
                </div>
                <div class="text-caption text-medium-emphasis">
                  Inscrit le {{ formatDateTime(detailParticipant.createdAt) }}
                </div>
              </div>

              <VBtn
                icon
                variant="text"
                size="small"
                @click="isDetailOpen = false"
              >
                <VIcon icon="tabler-x" />
              </VBtn>
            </div>

            <VRow class="mt-4">
              <VCol
                v-for="stat in [
                  { label: 'Commandes payées', value: detailTotals.paidOrders, icon: 'tabler-shopping-cart', color: 'primary' },
                  { label: 'Billets', value: detailTotals.tickets, icon: 'tabler-ticket', color: 'info' },
                  { label: 'Total dépensé', value: formatPrice(detailTotals.totalSpent), icon: 'tabler-cash', color: 'success' },
                  { label: 'Entrées', value: detailTotals.checkedIn, icon: 'tabler-qrcode', color: 'warning' },
                ]"
                :key="stat.label"
                cols="6"
                md="3"
              >
                <VCard variant="outlined">
                  <VCardText class="d-flex align-center gap-3 pa-3">
                    <VAvatar
                      :color="stat.color"
                      variant="tonal"
                      rounded
                      size="36"
                    >
                      <VIcon
                        :icon="stat.icon"
                        size="20"
                      />
                    </VAvatar>
                    <div>
                      <div class="text-caption text-medium-emphasis">
                        {{ stat.label }}
                      </div>
                      <div class="text-body-1 font-weight-medium">
                        {{ stat.value }}
                      </div>
                    </div>
                  </VCardText>
                </VCard>
              </VCol>
            </VRow>
          </VCardText>

          <VTabs
            v-model="detailTab"
            class="px-4 mt-2"
          >
            <VTab value="orders">
              Commandes ({{ detail.orders.length }})
            </VTab>
            <VTab value="tickets">
              Billets ({{ detail.tickets.length }})
            </VTab>
          </VTabs>

          <VDivider />

          <VCardText>
            <VWindow v-model="detailTab">
              <VWindowItem value="orders">
                <VTable v-if="detail.orders.length">
                  <thead>
                    <tr>
                      <th>N° commande</th>
                      <th>Événement</th>
                      <th class="text-end">
                        Billets
                      </th>
                      <th class="text-end">
                        Montant
                      </th>
                      <th>Statut</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="order in detail.orders"
                      :key="order.id"
                    >
                      <td>
                        <VChip
                          color="primary"
                          size="small"
                          variant="tonal"
                        >
                          #{{ order.orderNumber }}
                        </VChip>
                      </td>
                      <td>{{ order.events.join(', ') || '—' }}</td>
                      <td class="text-end">
                        {{ order.ticketsCount }}
                      </td>
                      <td class="text-end">
                        {{ formatPrice(order.totalAmount) }}
                      </td>
                      <td>
                        <VChip
                          :color="orderStatusColor(order.status)"
                          size="small"
                          variant="tonal"
                        >
                          {{ order.statusLabel }}
                        </VChip>
                      </td>
                      <td>{{ formatDateTime(order.createdAt) }}</td>
                    </tr>
                  </tbody>
                </VTable>
                <p
                  v-else
                  class="text-body-2 text-medium-emphasis mb-0"
                >
                  Aucune commande.
                </p>
              </VWindowItem>

              <VWindowItem value="tickets">
                <VTable v-if="detail.tickets.length">
                  <thead>
                    <tr>
                      <th>N° billet</th>
                      <th>Événement</th>
                      <th>Type</th>
                      <th>Statut</th>
                      <th>Entrée</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="ticket in detail.tickets"
                      :key="ticket.id"
                    >
                      <td style="font-family: monospace">
                        {{ ticket.ticketNumber }}
                      </td>
                      <td>{{ ticket.event ?? '—' }}</td>
                      <td>{{ ticket.ticketType ?? '—' }}</td>
                      <td>
                        <VChip
                          :color="ticketStatusColor(ticket.status)"
                          size="small"
                          variant="tonal"
                        >
                          {{ ticket.statusLabel }}
                        </VChip>
                      </td>
                      <td>
                        {{ ticket.checkedInAt ? formatDateTime(ticket.checkedInAt) : '—' }}
                      </td>
                    </tr>
                  </tbody>
                </VTable>
                <p
                  v-else
                  class="text-body-2 text-medium-emphasis mb-0"
                >
                  Aucun billet.
                </p>
              </VWindowItem>
            </VWindow>
          </VCardText>
        </template>
      </VCard>
    </VDialog>
  </div>
</template>
