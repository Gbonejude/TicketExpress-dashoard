<script setup>
import { $api, toMediaUrl } from '@/utils/api'
import { notifyApiError } from '@/utils/toast'
import { useCurrentOrganizer } from '@/composables/useCurrentOrganizer'

definePage({
  meta: {
    action: 'read',
    subject: 'dashboard',
  },
})

/**
 * Rapports & statistiques.
 *
 * Un seul jeu de filtres alimente les trois sorties : les compteurs, le journal
 * des commandes et le PDF. C'est ce qui permet de dire d'un rapport imprimé qu'il
 * correspond à l'écran — s'ils divergeaient, le document ne prouverait rien.
 *
 * Adapté de l'écran Report de kweek-restaurant : mêmes quatre modes de période
 * (tout / intervalle / année / mois) et même journal détaillé, mais avec les
 * dimensions de la billetterie — organisateur, événement, participant — au lieu
 * de restaurant, livreur et coursier.
 */
/**
 * Un organisateur ne choisit pas d'organisateur.
 *
 * Le sélecteur lui était présenté comme aux administrateurs, alors que l'API le
 * borne de toute façon à ses propres chiffres — y compris s'il désigne
 * explicitement un confrère. Il pouvait donc sélectionner un autre nom et voir
 * ses propres données : le filtre semblait cassé, alors qu'il faisait exactement
 * son travail.
 *
 * Le garde est commun aux quatre écrans qui posaient la question — voir
 * `useCurrentOrganizer`.
 */
const { canChooseOrganizer } = useCurrentOrganizer()

const filterType = ref('month')
const organizerId = ref(null)
const eventId = ref(null)
const participantId = ref(null)
const statusFilter = ref(null)

const today = new Date()
const iso = date => date.toISOString().slice(0, 10)

const dateRange = ref([iso(new Date(today.getFullYear(), today.getMonth(), 1)), iso(today)])
const selectedYear = ref(today.getFullYear())
const selectedMonth = ref(today.getMonth() + 1)

const filterTypeOptions = [
  { title: 'Tout', value: 'all' },
  { title: 'Période', value: 'range' },
  { title: 'Année', value: 'year' },
  { title: 'Mois', value: 'month' },
]

const yearOptions = computed(() =>
  Array.from({ length: 5 }, (_, i) => {
    const year = today.getFullYear() - i

    return { title: String(year), value: year }
  }))

const monthOptions = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
].map((title, index) => ({ title, value: index + 1 }))

const statusOptions = [
  { title: 'En attente', value: 'pending' },
  { title: 'Payé', value: 'paid' },
  { title: 'Annulé', value: 'cancelled' },
  { title: 'Remboursé', value: 'refunded' },
]

/** Listes déroulantes : 100 par page, pour ne pas tronquer le choix. */
// Pas de liste d'organisateurs à charger pour qui ne peut pas en choisir un :
// c'est une requête de plus sur un écran qui en lance déjà cinq.
const { data: organizersData } = canChooseOrganizer.value
  ? useApi('/organizers?page=1&per_page=100')
  : { data: ref(null) }

const { data: eventsData } = useApi('/events?page=1&per_page=100')
const { data: participantsData } = useApi('/participants?page=1&per_page=100&sort=spent')

const organizerOptions = computed(() => organizersData.value?.data ?? [])
const eventOptions = computed(() => eventsData.value?.data ?? [])

/**
 * Les participants sont triés par dépense décroissante : dans une liste de cent
 * noms, ceux qu'on vient chercher sont les gros acheteurs. Le libellé porte le
 * téléphone, deux personnes pouvant partager un nom.
 */
const participantOptions = computed(() =>
  (participantsData.value?.data ?? []).map(participant => ({
    id: participant.id,
    label: participant.phone
      ? `${participant.fullName} (${participant.phone})`
      : participant.fullName,
  })))

/**
 * Les paramètres de période, communs aux trois appels. Seuls ceux qui ont un sens
 * pour le mode choisi sont envoyés : envoyer une année avec un intervalle
 * laisserait croire qu'elle est prise en compte.
 */
const periodParams = computed(() => {
  const params = { filterType: filterType.value }

  if (filterType.value === 'range') {
    params.startDate = dateRange.value?.[0]
    params.endDate = dateRange.value?.[1] ?? dateRange.value?.[0]
  }

  if (filterType.value === 'year') params.year = selectedYear.value

  if (filterType.value === 'month') {
    params.year = selectedYear.value
    params.month = selectedMonth.value
  }

  return params
})

const filterParams = computed(() => {
  const params = { ...periodParams.value }

  if (organizerId.value) params.organizer_id = organizerId.value
  if (eventId.value) params.event_id = eventId.value
  if (participantId.value) params.participant_id = participantId.value

  return params
})

const toQuery = params => new URLSearchParams(
  Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
).toString()

/* ─── Compteurs ─────────────────────────────────────────────────────────────── */
const overviewUrl = computed(() => `/reports/overview?${toQuery(filterParams.value)}`)
const { data: overviewData, isFetching: overviewLoading } = useApi(overviewUrl)

const overview = computed(() => overviewData.value?.data ?? null)
const totals = computed(() => overview.value?.totals ?? {})
const periodLabel = computed(() => overview.value?.period?.label ?? null)

/* ─── Journal ───────────────────────────────────────────────────────────────── */
const journalPage = ref(1)
const perPage = ref(15)

const journalUrl = computed(() => {
  const params = { ...filterParams.value, page: journalPage.value, per_page: perPage.value }

  if (statusFilter.value) params.status = statusFilter.value

  return `/reports/journal?${toQuery(params)}`
})

const { data: journalData, isFetching: journalLoading } = useApi(journalUrl)

const journal = computed(() => journalData.value?.data ?? [])
const journalTotal = computed(() => journalData.value?.meta?.total ?? 0)

watch(
  [filterType, organizerId, eventId, participantId, statusFilter, dateRange, selectedYear, selectedMonth],
  () => { journalPage.value = 1 },
  { deep: true },
)

const onJournalOptions = ({ page, itemsPerPage }) => {
  if (page && page !== journalPage.value) journalPage.value = page
  if (itemsPerPage && itemsPerPage !== perPage.value) perPage.value = itemsPerPage
}

/* ─── Mise en forme ─────────────────────────────────────────────────────────── */
const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(value ?? 0)))} FCFA`

const formatNumber = value => new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))

const formatDateTime = iso8601 => {
  if (!iso8601) return '—'

  return new Date(iso8601).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Le palmarès mène à la fiche de l'événement.
 *
 * Passe par le routeur plutôt que par un `to` sur chaque cellule : la cible est
 * la ligne entière, et `VTable` ne sait pas rendre un `tr` comme un lien.
 */
const router = useRouter()

const goToEvent = eventId => router.push(`/events/${eventId}`)

const statusColor = status => ({
  pending: 'warning',
  paid: 'success',
  cancelled: 'error',
  refunded: 'secondary',
})[status] ?? 'secondary'

const statCards = computed(() => [
  {
    label: "Chiffre d'affaires", value: formatPrice(totals.value.revenue),
    icon: 'tabler-cash', color: 'success',
  },
  {
    label: `Commission (${Math.round((totals.value.commissionRate ?? 0) * 100)} %)`,
    value: formatPrice(totals.value.commission), icon: 'tabler-percentage', color: 'primary',
  },
  {
    // « Net organisateurs » se lit comme la part versée à d'autres quand l'écran
    // est déjà borné à un seul — et c'est précisément la sienne.
    label: canChooseOrganizer.value ? 'Net organisateurs' : 'Net à vous reverser',
    value: formatPrice(totals.value.netRevenue),
    icon: 'tabler-wallet', color: 'info',
  },
  {
    label: 'Commandes payées',
    value: `${formatNumber(totals.value.paidOrders)} / ${formatNumber(totals.value.orders)}`,
    icon: 'tabler-shopping-cart', color: 'secondary',
  },
  {
    label: 'Billets vendus', value: formatNumber(totals.value.ticketsSold),
    icon: 'tabler-ticket', color: 'warning',
  },
  {
    label: 'Entrées enregistrées',
    value: `${formatNumber(totals.value.checkedIn)} / ${formatNumber(totals.value.ticketsIssued)}`,
    icon: 'tabler-qrcode', color: 'info',
  },
  {
    label: 'Participants', value: formatNumber(totals.value.participants),
    icon: 'tabler-users', color: 'primary',
  },
  {
    label: 'Panier moyen', value: formatPrice(totals.value.averageBasket),
    icon: 'tabler-receipt', color: 'secondary',
  },
])

/* ─── Export ────────────────────────────────────────────────────────────────── */
const isExporting = ref(false)

/**
 * Le PDF est récupéré en blob plutôt qu'ouvert dans un onglet : la route exige le
 * jeton d'authentification, qu'une simple navigation n'emporterait pas.
 */
const exportPdf = async () => {
  isExporting.value = true
  try {
    const blob = await $api(`/reports/export/pdf?${toQuery(filterParams.value)}`, {
      responseType: 'blob',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `rapport-billetterie-${new Date().toISOString().slice(0, 10)}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    notifyApiError(error, "Impossible d'exporter le rapport.")
  } finally {
    isExporting.value = false
  }
}

const journalHeaders = [
  { title: 'N° commande', key: 'orderNumber', sortable: false },
  { title: 'Participant', key: 'participant', sortable: false },
  { title: 'Événement', key: 'events', sortable: false },
  { title: 'Billets', key: 'quantity', sortable: false, align: 'end' },
  { title: 'Montant', key: 'totalAmount', sortable: false, align: 'end' },
  { title: 'Statut', key: 'status', sortable: false },
  { title: 'Paiement', key: 'paymentMethod', sortable: false },
  { title: 'Date', key: 'createdAt', sortable: false },
]

const methodLabel = method => ({
  flooz: 'Flooz',
  tmoney: 'Mix by Yas',
})[method] ?? (method || '—')
</script>

<template>
  <div>
    <!-- ─── Filtres ──────────────────────────────────────────────────────── -->
    <VCard class="mb-6">
      <VCardText>
        <VRow align="end">
          <VCol
            cols="12"
            sm="6"
            md="2"
          >
            <VSelect
              v-model="filterType"
              :items="filterTypeOptions"
              item-title="title"
              item-value="value"
              label="Période"
              density="compact"
            />
          </VCol>

          <VCol
            v-if="filterType === 'range'"
            cols="12"
            sm="6"
            md="3"
          >
            <AppDateTimePicker
              v-model="dateRange"
              label="Du / au"
              :config="{ mode: 'range' }"
              density="compact"
            />
          </VCol>

          <VCol
            v-if="filterType === 'year' || filterType === 'month'"
            cols="12"
            sm="6"
            md="2"
          >
            <VSelect
              v-model="selectedYear"
              :items="yearOptions"
              item-title="title"
              item-value="value"
              label="Année"
              density="compact"
            />
          </VCol>

          <VCol
            v-if="filterType === 'month'"
            cols="12"
            sm="6"
            md="2"
          >
            <VSelect
              v-model="selectedMonth"
              :items="monthOptions"
              item-title="title"
              item-value="value"
              label="Mois"
              density="compact"
            />
          </VCol>

          <VCol
            v-if="canChooseOrganizer"
            cols="12"
            sm="6"
            md="2"
          >
            <VSelect
              v-model="organizerId"
              :items="organizerOptions"
              item-title="companyName"
              item-value="id"
              label="Organisateur"
              placeholder="Tous"
              density="compact"
              clearable
            />
          </VCol>

          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <VSelect
              v-model="eventId"
              :items="eventOptions"
              item-title="title"
              item-value="id"
              label="Événement"
              placeholder="Tous"
              density="compact"
              clearable
            />
          </VCol>

          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <!--
              Autocomplete plutôt que select : une liste de participants se
              parcourt mal, on y cherche un nom. 
            -->
            <VAutocomplete
              v-model="participantId"
              :items="participantOptions"
              item-title="label"
              item-value="id"
              label="Participant"
              placeholder="Tous"
              density="compact"
              clearable
              no-data-text="Aucun participant"
            />
          </VCol>

          <VCol
            cols="12"
            sm="6"
            md="2"
          >
            <VBtn
              color="primary"
              block
              prepend-icon="tabler-file-download"
              :loading="isExporting"
              @click="exportPdf"
            >
              Exporter
            </VBtn>
          </VCol>

          <VCol
            v-if="periodLabel"
            cols="12"
          >
            <VChip
              color="primary"
              variant="tonal"
              prepend-icon="tabler-calendar"
            >
              {{ periodLabel }}
            </VChip>
            <VChip
              v-if="overview?.filters?.organizer"
              class="ms-2"
              variant="tonal"
              prepend-icon="tabler-building-store"
            >
              {{ overview.filters.organizer }}
            </VChip>
            <VChip
              v-if="overview?.filters?.event"
              class="ms-2"
              variant="tonal"
              prepend-icon="tabler-calendar-event"
            >
              {{ overview.filters.event }}
            </VChip>
            <VChip
              v-if="overview?.filters?.participant"
              class="ms-2"
              variant="tonal"
              prepend-icon="tabler-user"
            >
              {{ overview.filters.participant }}
            </VChip>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <!-- ─── Compteurs ────────────────────────────────────────────────────── -->
    <VRow class="mb-2">
      <VCol
        v-for="card in statCards"
        :key="card.label"
        cols="12"
        sm="6"
        md="3"
      >
        <VCard :loading="overviewLoading">
          <VCardText class="d-flex align-center gap-4">
            <VAvatar
              :color="card.color"
              variant="tonal"
              rounded
              size="42"
            >
              <VIcon :icon="card.icon" />
            </VAvatar>
            <div>
              <div class="text-body-2 text-medium-emphasis">
                {{ card.label }}
              </div>
              <div class="text-h6">
                {{ card.value }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VRow>
      <!-- ─── Palmarès ───────────────────────────────────────────────────── -->
      <VCol
        cols="12"
        md="7"
      >
        <VCard title="Événements les plus vendus">
          <VDivider />
          <VTable v-if="(overview?.topEvents ?? []).length">
            <thead>
              <tr>
                <th>Événement</th>
                <!--
                  Une colonne qui répète le même nom à chaque ligne n'apprend
                  rien : pour un organisateur, ce palmarès est le sien.
                -->
                <th v-if="canChooseOrganizer">
                  Organisateur
                </th>
                <th class="text-end">
                  Billets
                </th>
                <th class="text-end">
                  Chiffre d'affaires
                </th>
              </tr>
            </thead>
            <tbody>
              <!--
                La ligne entière mène à l'événement : depuis un palmarès, la
                question suivante est toujours « et celui-là, il en est où ? ».
                Le lien est sur la ligne et non sur le seul titre — viser trois
                mots dans un tableau dense est inutilement exigeant.
              -->
              <tr
                v-for="event in overview.topEvents"
                :key="event.eventId"
                class="cursor-pointer te-top-event"
                @click="goToEvent(event.eventId)"
              >
                <!--
                  L'affiche avant le titre : dans un palmarès de dix lignes, c'est
                  elle qu'on reconnaît avant d'avoir lu. Repli sur une pastille
                  d'icône quand l'événement n'en a pas — une case vide casserait
                  l'alignement de la colonne.
                -->
                <td>
                  <div class="d-flex align-center gap-3">
                    <VAvatar
                      rounded
                      size="38"
                      color="primary"
                      variant="tonal"
                    >
                      <VImg
                        v-if="event.thumbnail"
                        :src="toMediaUrl(event.thumbnail)"
                        :alt="event.title"
                        cover
                      />
                      <VIcon
                        v-else
                        icon="tabler-calendar-event"
                        size="20"
                      />
                    </VAvatar>
                    <span class="font-weight-medium">{{ event.title }}</span>
                  </div>
                </td>
                <td
                  v-if="canChooseOrganizer"
                  class="text-medium-emphasis"
                >
                  {{ event.organizer }}
                </td>
                <td class="text-end">
                  {{ formatNumber(event.tickets) }}
                </td>
                <td class="text-end font-weight-medium">
                  {{ formatPrice(event.revenue) }}
                </td>
              </tr>
            </tbody>
          </VTable>
          <VCardText
            v-else
            class="text-body-2 text-medium-emphasis"
          >
            Aucune vente sur cette période.
          </VCardText>
        </VCard>
      </VCol>

      <!-- ─── Catégories & paiement ──────────────────────────────────────── -->
      <VCol
        cols="12"
        md="5"
      >
        <!--
          « Par catégorie » seul ne disait pas de quelle catégorie il s'agit — il
          y en a plusieurs dans le domaine (catégorie de billet, de lieu). Ce sont
          les catégories d'événement du catalogue : Concert, Festival, Soirée.
        -->
        <VCard title="Par catégorie d'événement">
          <VDivider />
          <VTable v-if="(overview?.revenueByCategory ?? []).length">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th class="text-end">
                  Billets
                </th>
                <th class="text-end">
                  CA
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in overview.revenueByCategory"
                :key="row.name"
              >
                <td>{{ row.name }}</td>
                <td class="text-end">
                  {{ formatNumber(row.tickets) }}
                </td>
                <td class="text-end">
                  {{ formatPrice(row.revenue) }}
                </td>
              </tr>
            </tbody>
          </VTable>
          <VCardText
            v-else
            class="text-body-2 text-medium-emphasis"
          >
            Aucune donnée.
          </VCardText>
        </VCard>

        <VCard
          title="Par moyen de paiement"
          class="mt-6"
        >
          <VDivider />

          <!--
            Une liste et non un tableau, contrairement aux deux cartes voisines :
            `VTable` enferme son contenu dans un conteneur `overflow: auto`, et
            deux lignes hautes de logos suffisaient à y faire naître une barre de
            défilement — dans une carte qui tient pourtant entière à l'écran. Deux
            opérateurs et trois valeurs ne réclament de toute façon pas une grille.
          -->
          <VCardText v-if="(overview?.revenueByPaymentMethod ?? []).length">
            <div class="d-flex flex-column gap-4">
              <div
                v-for="row in overview.revenueByPaymentMethod"
                :key="row.method"
                class="d-flex align-center gap-3"
              >
                <PaymentMethodLogo
                  :method="row.method"
                  :height="2.25"
                />
                <div class="flex-grow-1">
                  <div class="text-body-2 font-weight-medium">
                    {{ row.method }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ formatNumber(row.orders) }} commande(s)
                  </div>
                </div>
                <span class="text-body-2 font-weight-medium">
                  {{ formatPrice(row.revenue) }}
                </span>
              </div>
            </div>
          </VCardText>
          <VCardText
            v-else
            class="text-body-2 text-medium-emphasis"
          >
            Aucune donnée.
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- ─── Journal ──────────────────────────────────────────────────────── -->
    <VCard class="mt-6">
      <VCardTitle class="d-flex align-center justify-space-between flex-wrap gap-2 pa-4">
        <span class="text-h6">Journal des commandes</span>
        <VSelect
          v-model="statusFilter"
          :items="statusOptions"
          item-title="title"
          item-value="value"
          label="Statut"
          placeholder="Tous"
          density="compact"
          clearable
          style="max-width: 220px"
        />
      </VCardTitle>

      <VDivider />

      <VDataTableServer
        :headers="journalHeaders"
        :items="journal"
        :items-length="journalTotal"
        :items-per-page="perPage"
        :page="journalPage"
        :loading="journalLoading"
        no-data-text="Aucune commande sur cette période"
        class="text-no-wrap"
        @update:options="onJournalOptions"
      >
        <template #item.orderNumber="{ item }">
          <VChip
            color="primary"
            size="small"
            variant="tonal"
            class="font-weight-medium"
          >
            #{{ item.orderNumber }}
          </VChip>
        </template>

        <!--
          Nom et téléphone sur une seule ligne : c'est ainsi que le participant
          est désigné partout ailleurs sur l'écran, filtre compris. Deux lignes
          faisaient respirer le journal d'une ligne de plus par commande sans rien
          apprendre.
        -->
        <template #item.participant="{ item }">
          <div class="text-body-2">
            {{ item.participant || '—' }}
            <span
              v-if="item.phone"
              class="text-medium-emphasis"
            >({{ item.phone }})</span>
          </div>
        </template>

        <template #item.events="{ item }">
          <div
            class="text-body-2 text-truncate"
            style="max-width: 220px"
          >
            {{ item.events.join(', ') || '—' }}
          </div>
        </template>

        <template #item.quantity="{ item }">
          {{ formatNumber(item.quantity) }}
        </template>

        <template #item.totalAmount="{ item }">
          <span class="font-weight-medium">{{ formatPrice(item.totalAmount) }}</span>
        </template>

        <template #item.status="{ item }">
          <VChip
            :color="statusColor(item.status)"
            size="small"
            variant="tonal"
          >
            {{ item.statusLabel }}
          </VChip>
        </template>

        <template #item.paymentMethod="{ item }">
          {{ methodLabel(item.paymentMethod) }}
        </template>

        <template #item.createdAt="{ item }">
          {{ formatDateTime(item.createdAt) }}
        </template>
      </VDataTableServer>
    </VCard>
  </div>
</template>

<style lang="scss" scoped>
/*
 * Un survol sur la ligne du palmarès : sans lui, rien n'annonce qu'elle est
 * cliquable — le curseur seul ne se voit qu'une fois dessus.
 */
.te-top-event:hover {
  background-color: rgba(var(--v-theme-on-surface), var(--v-hover-opacity));
}
</style>
