<script setup>
import { notify, notifyApiError } from '@/utils/toast'

definePage({
  meta: {
    action: 'read',
    subject: 'notifications',
  },
})

// NOTE: this endpoint is backed by Laravel's built-in database-notifications
// table (no dedicated Notification model / API Resource on the backend), so
// the payload keeps Laravel's native snake_case keys and raw ISO date
// strings instead of the usual camelCase + { datetime, humanDiff, human }
// convention used elsewhere in the app. See the report for details.

const currentPage = ref(1)
const isSubmitting = ref(false)
const markingReadId = ref(null)

const headers = [
  { title: 'Titre', key: 'title' },
  { title: 'Message', key: 'message' },
  { title: 'Type', key: 'type' },
  { title: 'Lu', key: 'read' },
  { title: 'Date', key: 'createdAt' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const typeLabels = {
  info: 'Info',
  success: 'Succès',
  warning: 'Avertissement',
  error: 'Erreur',
}

const typeColor = type => (['info', 'success', 'warning', 'error'].includes(type) ? type : 'info')

// ─── List (server-paginated, GET /notifications?page=) ─────────────────────
const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })

  return `/notifications?${params.toString()}`
})

const { data: notificationsData, isFetching, execute: fetchNotifications } = useApi(apiUrl)

const notifications = computed(() => notificationsData.value?.data ?? [])
const totalNotifications = computed(() => notificationsData.value?.meta?.total ?? 0)

// Backend paginates at 20 (not the usual 15) for this endpoint — reflect the
// real per_page from meta so the table footer stays accurate.
const notificationsPerPage = computed(() => notificationsData.value?.meta?.per_page ?? 15)

const onTableOptions = ({ page }) => {
  if (page && page !== currentPage.value) currentPage.value = page
}

// ─── Date formatting (raw ISO strings here, not the { human } date object) ─
const formatDate = value => {
  if (!value) return '-'

  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'

  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const router = useRouter()

const getTarget = item => {
  const data = item.data ?? {}

  if (data.order_id || data.orderId || data.order?.id)
    return { type: 'order', id: data.order_id ?? data.orderId ?? data.order?.id }
  if (data.order_number || data.orderNumber)
    return { type: 'order_number', number: data.order_number ?? data.orderNumber }
  if (data.withdrawal_id || data.withdrawalId || data.action === 'view_withdrawal')
    return { type: 'withdrawal' }
  if (data.url)
    return { type: 'url', url: data.url.replace(/^\/organizer/, '') }

  return null
}

const goToTarget = item => {
  const target = getTarget(item)
  if (!target) return

  if (!item.read_at)
    void markAsRead(item)

  if (target.type === 'order') {
    void router.push(`/orders/${target.id}`)
  } else if (target.type === 'order_number') {
    void router.push({ path: '/orders', query: { search: target.number } })
  } else if (target.type === 'withdrawal') {
    void router.push('/withdrawals')
  } else if (target.type === 'url') {
    void router.push(target.url)
  }
}
</script>

<template>
  <div>
    <VCard>
      <!--
        Ni ajout ni modification : une notification est émise par la plateforme
        quand un événement métier se produit (commande payée, organisateur
        approuvé…). En écrire une à la main depuis cet écran produirait un
        message que rien n'a déclenché — et le back-end renvoie de toute façon
        501 sur la mise à jour. L'écran reste en consultation, avec « marquer
        comme lue ».
      -->
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">Gestion des Notifications</span>
      </VCardTitle>

      <VDivider />

      <VDataTableServer
        :headers="headers"
        :items="notifications"
        :items-length="totalNotifications"
        :items-per-page="notificationsPerPage"
        :page="currentPage"
        :loading="isFetching"
        no-data-text="Aucune notification"
        class="text-no-wrap"
        @update:options="onTableOptions"
      >
        <!-- Titre -->
        <template #item.title="{ item }">
          <div class="d-flex align-center gap-2">
            <span
              :class="getTarget(item) ? 'text-primary cursor-pointer font-weight-medium text-decoration-underline' : 'font-weight-medium'"
              @click="getTarget(item) && goToTarget(item)"
            >
              {{ item.data?.title ?? '-' }}
            </span>
            <VIcon
              v-if="getTarget(item)"
              icon="tabler-arrow-up-right"
              size="16"
              color="primary"
              class="cursor-pointer"
              @click="goToTarget(item)"
            />
          </div>
        </template>

        <!-- Message -->
        <template #item.message="{ item }">
          <span
            class="text-truncate d-inline-block"
            style="max-width: 280px"
          >
            {{ item.data?.message ?? '-' }}
          </span>
        </template>

        <!-- Type -->
        <template #item.type="{ item }">
          <VChip
            size="small"
            :color="typeColor(item.data?.type)"
            variant="tonal"
          >
            {{ typeLabels[item.data?.type] ?? typeLabels.info }}
          </VChip>
        </template>

        <!-- Lu -->
        <template #item.read="{ item }">
          <VChip
            size="small"
            :color="item.read_at ? 'success' : 'warning'"
            variant="tonal"
          >
            {{ item.read_at ? 'Lu' : 'Non lu' }}
          </VChip>
        </template>

        <!-- Date -->
        <template #item.createdAt="{ item }">
          {{ formatDate(item.created_at) }}
        </template>

        <!-- Actions -->
        <template #item.actions="{ item }">
          <VTooltip
            v-if="getTarget(item)"
            :text="getTarget(item)?.type === 'withdrawal' ? 'Voir le retrait' : 'Voir la commande'"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="primary"
                @click="goToTarget(item)"
              >
                <VIcon icon="tabler-eye" />
              </VBtn>
            </template>
          </VTooltip>

          <VTooltip
            v-if="!item.read_at"
            text="Marquer comme lu"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="success"
                :loading="markingReadId === item.id"
                @click="markAsRead(item)"
              >
                <VIcon icon="tabler-check" />
              </VBtn>
            </template>
          </VTooltip>

          <span
            v-if="item.read_at && !getTarget(item)"
            class="text-medium-emphasis"
          >—</span>
        </template>
      </VDataTableServer>
    </VCard>
  </div>
</template>
