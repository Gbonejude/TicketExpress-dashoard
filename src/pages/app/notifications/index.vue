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

const markAsRead = async notification => {
  markingReadId.value = notification.id
  try {
    await useApi(`/notifications/${notification.id}/markasread`).post().json()
    notify('Notification marquée comme lue.')
    fetchNotifications()
  } catch (error) {
    notifyApiError(error, 'Impossible de marquer la notification.')
  } finally {
    markingReadId.value = null
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
          <span class="font-weight-medium">{{ item.data?.title ?? '-' }}</span>
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

          <!--
            Modifier / Supprimer absents : le back-end renvoie 501 (non
            implémenté) sur PUT et DELETE /notifications/{id}.
          -->
          <span
            v-if="item.read_at"
            class="text-medium-emphasis"
          >—</span>
        </template>
      </VDataTableServer>
    </VCard>
  </div>
</template>
