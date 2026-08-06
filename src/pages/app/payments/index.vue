<script setup>
import { formatDateFr } from '@/utils/dateFormat'

definePage({
  meta: {
    action: 'read',
    subject: 'payments',
  },
})

const currentPage = ref(1)
const search = ref('')
const statusFilter = ref(null)
const methodFilter = ref(null)

const statusOptions = [
  { title: 'Payé', value: 'paye' },
  { title: 'Non payé', value: 'non_paye' },
]

const methodOptions = [
  { title: 'Flooz', value: 'flooz' },
  { title: 'Mix by Yas', value: 'tmoney' },
]

const debouncedSearch = ref('')
let searchTimer = null

watch(search, value => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedSearch.value = value }, 400)
})

const headers = [
  { title: 'Référence', key: 'transactionReference' },
  { title: 'Commande', key: 'order', sortable: false },
  { title: 'Participant', key: 'participant', sortable: false },
  { title: 'Montant', key: 'amount' },
  { title: 'Méthode', key: 'method' },
  { title: 'Statut', key: 'status' },
  { title: 'Date', key: 'createdAt', sortable: false },
]

const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })
  if (statusFilter.value) params.set('status', statusFilter.value)
  if (methodFilter.value) params.set('method', methodFilter.value)
  if (debouncedSearch.value) params.set('search', debouncedSearch.value)

  return `/payments?${params.toString()}`
})

watch([statusFilter, methodFilter, debouncedSearch], () => { currentPage.value = 1 })

const { data: paymentsData, isFetching, execute: fetchPayments } = useApi(apiUrl)

// Live (silent) refresh when a payment is recorded elsewhere.
useRealtimeRefresh('payments', () => fetchPayments())

const payments = computed(() => paymentsData.value?.data ?? [])
const totalPayments = computed(() => paymentsData.value?.meta?.total ?? 0)

const onTableOptions = ({ page }) => {
  if (page && page !== currentPage.value) currentPage.value = page
}

const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))} FCFA`

const statusColor = status => ({
  paye: 'success',
  non_paye: 'warning',
})[status] ?? 'secondary'

const methodColor = method => ({
  stripe: 'info',
  wave: 'primary',
  flooz: 'warning',
  tmoney: 'success',
  paypal: 'info',
})[method] ?? 'secondary'
</script>

<template>
  <div>
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">Paiements</span>
      </VCardTitle>

      <VDivider />

      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <VTextField
              v-model="search"
              label="Rechercher"
              placeholder="Référence de transaction ou n° commande…"
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
              v-model="methodFilter"
              :items="methodOptions"
              item-title="title"
              item-value="value"
              label="Méthode"
              placeholder="Toutes"
              density="compact"
              clearable
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="payments"
        :items-length="totalPayments"
        :items-per-page="15"
        :page="currentPage"
        :loading="isFetching"
        no-data-text="Aucun paiement"
        class="text-no-wrap"
        @update:options="onTableOptions"
      >
        <template #item.transactionReference="{ item }">
          <span
            class="font-weight-medium"
            style="font-family: monospace"
          >
            {{ item.transactionReference ?? '-' }}
          </span>
        </template>

        <!--
          N° de commande : même traitement visuel que le statut, une puce.
          En texte monospace il se confondait avec la référence de
          transaction juste à sa gauche. 
        -->
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

        <!--
          Montant : la puce reprend la couleur du statut, donc un encaissement
          réussi et un impayé ne se lisent pas de la même façon. 
        -->
        <template #item.amount="{ item }">
          <VChip
            :color="statusColor(item.status)"
            size="small"
            variant="tonal"
            class="font-weight-medium"
          >
            {{ formatPrice(item.amount) }}
          </VChip>
        </template>

        <template #item.method="{ item }">
          <VChip
            :color="methodColor(item.method)"
            size="small"
            variant="tonal"
          >
            {{ item.methodLabel ?? item.method }}
          </VChip>
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

        <!--
          Date en français, comme partout ailleurs. `human` de l'API renvoie
          un « 3 days ago » anglais au milieu d'une interface française. 
        -->
        <template #item.createdAt="{ item }">
          {{ formatDateFr(item.paidAt ?? item.createdAt) }}
        </template>
      </VDataTableServer>
    </VCard>
  </div>
</template>
