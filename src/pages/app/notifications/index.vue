<script setup>
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
const isFormDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const editingNotification = ref(null)
const deletingNotification = ref(null)
const isSubmitting = ref(false)
const formRef = ref(null)
const markingReadId = ref(null)

const fieldErrors = reactive({
  user_id: undefined,
  title: undefined,
  message: undefined,
  type: undefined,
})

const form = reactive({
  user_id: null,
  title: '',
  message: '',
  type: 'info',
})

const headers = [
  { title: 'Titre', key: 'title' },
  { title: 'Message', key: 'message' },
  { title: 'Type', key: 'type' },
  { title: 'Lu', key: 'read' },
  { title: 'Date', key: 'createdAt' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const typeOptions = [
  { value: 'info', title: 'Info' },
  { value: 'success', title: 'Succès' },
  { value: 'warning', title: 'Avertissement' },
  { value: 'error', title: 'Erreur' },
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

// ─── Recipient options for the create form (GET /users) ────────────────────
const { data: usersData } = useApi('/users')

const userOptions = computed(() => (usersData.value?.data ?? []).map(u => ({
  value: u.id,
  title: u.email ? `${u.fullName} (${u.email})` : u.fullName,
})))

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

// ─── Form helpers ────────────────────────────────────────────────────────
const resetForm = () => {
  form.user_id = null
  form.title = ''
  form.message = ''
  form.type = 'info'
  fieldErrors.user_id = undefined
  fieldErrors.title = undefined
  fieldErrors.message = undefined
  fieldErrors.type = undefined
  editingNotification.value = null
  formRef.value?.resetValidation()
}

const openCreateDialog = () => {
  resetForm()
  isFormDialogOpen.value = true
}

const openEditDialog = notification => {
  resetForm()
  editingNotification.value = notification
  form.title = notification.data?.title ?? ''
  form.message = notification.data?.message ?? ''
  form.type = notification.data?.type ?? 'info'
  isFormDialogOpen.value = true
}

const openDeleteDialog = notification => {
  deletingNotification.value = notification
  isDeleteDialogOpen.value = true
}

const saveNotification = async () => {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  fieldErrors.user_id = undefined
  fieldErrors.title = undefined
  fieldErrors.message = undefined
  fieldErrors.type = undefined
  isSubmitting.value = true

  const payload = editingNotification.value
    ? {
      title: form.title,
      message: form.message,
      type: form.type,
    }
    : {
      user_id: form.user_id || undefined,
      title: form.title,
      message: form.message,
      type: form.type,
    }

  try {
    if (editingNotification.value) {
      await useApi(`/notifications/${editingNotification.value.id}`).put(payload).json()
    } else {
      await useApi('/notifications').post(payload).json()
    }
    isFormDialogOpen.value = false
    fetchNotifications()
  } catch (error) {
    const errors = error?.data?.errors ?? error?._data?.errors
    if (errors) {
      fieldErrors.user_id = errors.user_id?.[0]
      fieldErrors.title = errors.title?.[0]
      fieldErrors.message = errors.message?.[0]
      fieldErrors.type = errors.type?.[0]
    }
  } finally {
    isSubmitting.value = false
  }
}

const confirmDelete = async () => {
  isSubmitting.value = true
  try {
    await useApi(`/notifications/${deletingNotification.value.id}`).delete().json()
    isDeleteDialogOpen.value = false
    fetchNotifications()
  } finally {
    isSubmitting.value = false
  }
}

const markAsRead = async notification => {
  markingReadId.value = notification.id
  try {
    await useApi(`/notifications/${notification.id}/markasread`).post().json()
    fetchNotifications()
  } finally {
    markingReadId.value = null
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">Gestion des Notifications</span>
        <VBtn
          color="primary"
          prepend-icon="tabler-plus"
          @click="openCreateDialog"
        >
          Ajouter une notification
        </VBtn>
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

          <!-- Modifier / Supprimer volontairement absents : le back-end renvoie
               501 (non implémenté) sur PUT/DELETE /notifications/{id}. -->
          <span
            v-if="item.read_at"
            class="text-medium-emphasis"
          >—</span>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- ─── Dialog Créer / Modifier ─────────────────────────────────────────── -->
    <VDialog
      v-model="isFormDialogOpen"
      max-width="640"
      scrollable
    >
      <VCard :title="editingNotification ? 'Modifier la notification' : 'Ajouter une notification'">
        <VCardText class="pt-4">
          <VForm ref="formRef">
            <VRow>
              <VCol
                v-if="!editingNotification"
                cols="12"
              >
                <VSelect
                  v-model="form.user_id"
                  label="Destinataire (optionnel, vous par défaut)"
                  :items="userOptions"
                  clearable
                  :error-messages="fieldErrors.user_id"
                />
              </VCol>
              <VCol cols="12">
                <VTextField
                  v-model="form.title"
                  label="Titre"
                  :rules="[requiredValidator]"
                  :error-messages="fieldErrors.title"
                  required
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="form.message"
                  label="Message"
                  :rules="[requiredValidator]"
                  :error-messages="fieldErrors.message"
                  required
                />
              </VCol>
              <VCol cols="12">
                <VSelect
                  v-model="form.type"
                  label="Type"
                  :items="typeOptions"
                  :rules="[requiredValidator]"
                  :error-messages="fieldErrors.type"
                  required
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isFormDialogOpen = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="primary"
            :loading="isSubmitting"
            @click="saveNotification"
          >
            {{ editingNotification ? 'Enregistrer les modifications' : 'Créer la notification' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

  </div>
</template>
