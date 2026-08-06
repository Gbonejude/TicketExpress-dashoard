<script setup>
import { notify } from '@/utils/toast'

definePage({
  meta: {
    action: 'read',
    subject: 'organizers',
  },
})

import { useAbility } from '@casl/vue'
import { $api, toMediaUrl } from '@/utils/api'

const { can } = useAbility()

const search = ref('')
const currentPage = ref(1)
const isFormDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const isRejectDialogOpen = ref(false)
const editingOrganizer = ref(null)
const deletingOrganizer = ref(null)
const rejectingOrganizer = ref(null)
const rejectReason = ref('')
const isSubmitting = ref(false)
const logoFile = ref(null)
const logoPreview = ref(null)
const logoInputRef = ref(null)
const formErrors = ref({})
const refForm = ref()

const form = reactive({
  user_id: '',
  company_name: '',
  description: '',
  website: '',
  status: '',
})

const headers = [
  { title: 'Organisateur', key: 'companyName' },
  { title: 'Responsable', key: 'user' },
  { title: 'Statut', key: 'status' },
  { title: 'Événements', key: 'eventsCount' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const statusOptions = [
  { title: 'En attente', value: 'pending' },
  { title: 'Approuvé', value: 'approved' },
  { title: 'Rejeté', value: 'rejected' },
]

const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })
  if (search.value) params.set('search', search.value)

  return `/organizers?${params.toString()}`
})

watch(search, () => { currentPage.value = 1 })

const { data: organizersData, isFetching, execute: fetchOrganizers } = useApi(apiUrl)

// Live refresh when an organizer registers / is updated elsewhere.
useRealtimeRefresh('organizers', () => fetchOrganizers())

const organizers = computed(() => organizersData.value?.data ?? [])
const totalOrganizers = computed(() => organizersData.value?.meta?.total ?? 0)

const onTableOptions = ({ page }) => {
  if (page && page !== currentPage.value) currentPage.value = page
}

// Users for the "Responsable" select
const { data: usersData, execute: fetchUsers } = useApi('/users?page=1')

const users = computed(() => usersData.value?.data ?? [])

const statusColor = status => ({
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
})[status] ?? 'secondary'

const resetForm = () => {
  form.user_id = ''
  form.company_name = ''
  form.description = ''
  form.website = ''
  form.status = ''
  formErrors.value = {}
  logoFile.value = null
  logoPreview.value = null
  editingOrganizer.value = null
  refForm.value?.resetValidation()
}

const onLogoSelected = event => {
  const file = event.target.files[0]
  if (!file) return
  logoFile.value = file
  logoPreview.value = URL.createObjectURL(file)
}

const resetLogo = () => {
  logoFile.value = null
  logoPreview.value = null
}

const openCreateDialog = () => {
  resetForm()
  fetchUsers()
  isFormDialogOpen.value = true
}

const openEditDialog = organizer => {
  resetForm()
  editingOrganizer.value = organizer
  form.user_id = organizer.userId ?? ''
  form.company_name = organizer.companyName ?? ''
  form.description = organizer.description ?? ''
  form.website = organizer.website ?? ''
  form.status = organizer.status ?? ''
  logoPreview.value = organizer.logoThumbnail ? toMediaUrl(organizer.logoThumbnail) : (organizer.logo ? toMediaUrl(organizer.logo) : null)
  fetchUsers()
  isFormDialogOpen.value = true
}

const openDeleteDialog = organizer => {
  deletingOrganizer.value = organizer
  isDeleteDialogOpen.value = true
}

const buildFormData = () => {
  const formData = new FormData()

  Object.entries(form).forEach(([key, val]) => {
    if (val !== '' && val !== null && val !== undefined) {
      formData.append(key, String(val))
    }
  })
  if (logoFile.value) formData.append('logo', logoFile.value)

  return formData
}

const saveOrganizer = async () => {
  const { valid } = await refForm.value?.validate() ?? { valid: true }
  if (!valid) return

  isSubmitting.value = true
  formErrors.value = {}
  try {
    if (editingOrganizer.value) {
      if (logoFile.value) {
        const formData = buildFormData()

        formData.append('_method', 'PUT')
        await $api(`/organizers/${editingOrganizer.value.id}`, { method: 'POST', body: formData })
      } else {
        const payload = { ...form }

        await useApi(`/organizers/${editingOrganizer.value.id}`).put(payload).json()
      }
    } else if (logoFile.value) {
      const formData = buildFormData()

      await $api('/organizers', { method: 'POST', body: formData })
    } else {
      await useApi('/organizers').post(form).json()
    }
    isFormDialogOpen.value = false
    fetchOrganizers()
  } catch (error) {
    if (error?.data?.errors) formErrors.value = error.data.errors
    else if (error?._data?.errors) formErrors.value = error._data.errors
  } finally {
    isSubmitting.value = false
  }
}

const approveOrganizer = async organizer => {
  isSubmitting.value = true
  try {
    await $api(`/organizers/${organizer.id}/approve`, { method: 'POST' })
    notify(`${organizer.companyName} a été approuvé.`)
    fetchOrganizers()
  } catch (err) {
    notify(err?.data?.message ?? "Impossible d'approuver l'organisateur.", 'error')
  } finally {
    isSubmitting.value = false
  }
}

const openRejectDialog = organizer => {
  rejectingOrganizer.value = organizer
  rejectReason.value = organizer.rejectionReason ?? ''
  isRejectDialogOpen.value = true
}

const confirmReject = async () => {
  isSubmitting.value = true
  try {
    await $api(`/organizers/${rejectingOrganizer.value.id}/reject`, {
      method: 'POST',
      body: { reason: rejectReason.value || null },
    })
    isRejectDialogOpen.value = false
    notify(`${rejectingOrganizer.value.companyName} a été rejeté.`, 'warning')
    fetchOrganizers()
  } catch (err) {
    notify(err?.data?.message ?? "Impossible de rejeter l'organisateur.", 'error')
  } finally {
    isSubmitting.value = false
  }
}

const toggleActive = async organizer => {
  isSubmitting.value = true
  const action = organizer.isActive ? 'deactivate' : 'activate'
  try {
    await $api(`/organizers/${organizer.id}/${action}`, { method: 'POST' })
    notify(
      organizer.isActive
        ? `${organizer.companyName} a été désactivé.`
        : `${organizer.companyName} a été réactivé.`,
      organizer.isActive ? 'warning' : 'success',
    )
    fetchOrganizers()
  } catch (err) {
    notify(err?.data?.message ?? "Impossible de changer l'état de l'organisateur.", 'error')
  } finally {
    isSubmitting.value = false
  }
}

const confirmDelete = async () => {
  isSubmitting.value = true
  try {
    await useApi(`/organizers/${deletingOrganizer.value.id}`).delete().json()
    isDeleteDialogOpen.value = false
    notify('Organisateur supprimé.')
    fetchOrganizers()
  } catch (err) {
    notify(err?.data?.message ?? "Impossible de supprimer l'organisateur.", 'error')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">Gestion des Organisateurs</span>
        <VBtn
          v-if="can('create', 'Organizer')"
          color="primary"
          prepend-icon="tabler-plus"
          @click="openCreateDialog"
        >
          Ajouter un organisateur
        </VBtn>
      </VCardTitle>

      <VDivider />

      <VCardText>
        <VTextField
          v-model="search"
          placeholder="Rechercher par nom d'entreprise..."
          prepend-inner-icon="tabler-search"
          density="compact"
          class="mb-4"
          style="max-width: 360px"
        />
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="organizers"
        :items-length="totalOrganizers"
        :items-per-page="15"
        :page="currentPage"
        :loading="isFetching"
        :no-data-text="'Aucun organisateur'"
        class="text-no-wrap"
        @update:options="onTableOptions"
      >
        <!-- Organisateur (logo + nom + site web) -->
        <template #item.companyName="{ item }">
          <div class="d-flex align-center gap-3">
            <VAvatar
              rounded
              size="34"
              color="primary"
              variant="tonal"
            >
              <VImg
                v-if="item.logoThumbnail || item.logo"
                :src="toMediaUrl(item.logoThumbnail || item.logo)"
                cover
              />
              <span
                v-else
                class="text-sm font-weight-medium"
              >
                {{ item.companyName?.charAt(0)?.toUpperCase() ?? '?' }}
              </span>
            </VAvatar>
            <div>
              <div class="font-weight-medium">
                {{ item.companyName ?? '-' }}
              </div>
              <div class="text-caption text-medium-emphasis">
                <a
                  v-if="item.website"
                  :href="item.website"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click.stop
                >{{ item.website }}</a>
                <span v-else>-</span>
              </div>
            </div>
          </div>
        </template>

        <!-- Responsable -->
        <template #item.user="{ item }">
          <div>
            <div class="font-weight-medium">
              {{ item.user?.fullName ?? '-' }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ item.user?.email ?? '' }}
            </div>
          </div>
        </template>

        <!-- Statut -->
        <template #item.status="{ item }">
          <div class="d-flex align-center gap-2">
            <VChip
              :color="statusColor(item.status)"
              size="small"
              variant="tonal"
            >
              {{ item.statusLabel ?? item.status }}
            </VChip>
            <VChip
              v-if="item.isActive === false"
              color="secondary"
              size="small"
              variant="tonal"
              prepend-icon="tabler-ban"
            >
              Désactivé
            </VChip>
          </div>
        </template>

        <!-- Événements -->
        <template #item.eventsCount="{ item }">
          {{ item.eventsCount ?? 0 }}
        </template>

        <!-- Actions -->
        <template #item.actions="{ item }">
          <VTooltip
            v-if="item.status !== 'approved'"
            text="Approuver"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="success"
                @click="approveOrganizer(item)"
              >
                <VIcon icon="tabler-check" />
              </VBtn>
            </template>
          </VTooltip>

          <VTooltip
            v-if="item.status !== 'rejected'"
            text="Rejeter"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="warning"
                @click="openRejectDialog(item)"
              >
                <VIcon icon="tabler-x" />
              </VBtn>
            </template>
          </VTooltip>

          <VTooltip
            :text="item.isActive ? 'Désactiver' : 'Réactiver'"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                :color="item.isActive ? 'secondary' : 'info'"
                @click="toggleActive(item)"
              >
                <VIcon :icon="item.isActive ? 'tabler-user-off' : 'tabler-user-check'" />
              </VBtn>
            </template>
          </VTooltip>

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
                @click="openEditDialog(item)"
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
                @click="openDeleteDialog(item)"
              >
                <VIcon icon="tabler-trash" />
              </VBtn>
            </template>
          </VTooltip>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- ─── Dialog Créer / Modifier ─────────────────────────────────────────── -->
    <VDialog
      v-model="isFormDialogOpen"
      max-width="640"
      scrollable
    >
      <VCard :title="editingOrganizer ? 'Modifier l\'organisateur' : 'Ajouter un organisateur'">
        <VCardText class="pt-4">
          <VForm ref="refForm">
            <VRow>
              <!-- Logo -->
              <VCol
                cols="12"
                class="d-flex align-center gap-6"
              >
                <VAvatar
                  rounded
                  size="88"
                  color="primary"
                  variant="tonal"
                >
                  <VImg
                    v-if="logoPreview"
                    :src="logoPreview"
                    cover
                  />
                  <VIcon
                    v-else
                    icon="tabler-building-store"
                    size="40"
                  />
                </VAvatar>

                <div class="d-flex flex-column gap-3">
                  <div class="d-flex flex-wrap gap-3">
                    <VBtn
                      size="small"
                      prepend-icon="tabler-cloud-upload"
                      @click="logoInputRef?.click()"
                    >
                      Importer un logo
                    </VBtn>
                    <VBtn
                      v-if="logoPreview"
                      size="small"
                      color="secondary"
                      variant="tonal"
                      prepend-icon="tabler-refresh"
                      @click="resetLogo"
                    >
                      Réinitialiser
                    </VBtn>
                  </div>
                  <p class="text-body-2 text-medium-emphasis mb-0">
                    JPG ou PNG · Max 2 Mo
                  </p>
                </div>

                <input
                  ref="logoInputRef"
                  type="file"
                  accept="image/png, image/jpeg"
                  class="d-none"
                  @change="onLogoSelected"
                >
              </VCol>

              <VCol cols="12">
                <VSelect
                  v-model="form.user_id"
                  :items="users"
                  item-title="fullName"
                  item-value="id"
                  label="Responsable"
                  :rules="[requiredValidator]"
                  :error-messages="formErrors.user_id"
                />
              </VCol>

              <VCol cols="12">
                <VTextField
                  v-model="form.company_name"
                  label="Nom de l'entreprise"
                  :rules="[requiredValidator, v => (v ?? '').length <= 255 || 'Le nom ne doit pas dépasser 255 caractères']"
                  :error-messages="formErrors.company_name"
                />
              </VCol>

              <VCol cols="12">
                <VTextarea
                  v-model="form.description"
                  label="Description"
                  :rules="[requiredValidator]"
                  :error-messages="formErrors.description"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.website"
                  label="Site web"
                  placeholder="https://exemple.com"
                  :rules="[urlValidator]"
                  :error-messages="formErrors.website"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="form.status"
                  :items="statusOptions"
                  item-title="title"
                  item-value="value"
                  label="Statut"
                  clearable
                  :error-messages="formErrors.status"
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
            @click="saveOrganizer"
          >
            {{ editingOrganizer ? 'Enregistrer les modifications' : 'Créer l\'organisateur' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Suppression ───────────────────────────────────────────────── -->
    <VDialog
      v-model="isDeleteDialogOpen"
      max-width="400"
    >
      <VCard title="Supprimer l'organisateur">
        <VCardText class="pt-4">
          <p class="text-body-2">
            Êtes-vous sûr de vouloir supprimer
            <strong>{{ deletingOrganizer?.companyName }}</strong> ?
            Cette action est irréversible.
          </p>
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isDeleteDialogOpen = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="error"
            :loading="isSubmitting"
            @click="confirmDelete"
          >
            Supprimer
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Rejet (motif) ─────────────────────────────────────────────── -->
    <VDialog
      v-model="isRejectDialogOpen"
      max-width="480"
    >
      <VCard title="Rejeter l'organisateur">
        <VCardText class="pt-4">
          <p class="text-body-2 mb-4">
            Vous êtes sur le point de rejeter
            <strong>{{ rejectingOrganizer?.companyName }}</strong>.
            Vous pouvez préciser un motif (visible par l'organisateur).
          </p>
          <VTextarea
            v-model="rejectReason"
            label="Motif du rejet (optionnel)"
            rows="3"
            placeholder="Ex : Documents manquants ou non conformes."
          />
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isRejectDialogOpen = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="warning"
            :loading="isSubmitting"
            @click="confirmReject"
          >
            Rejeter
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

  </div>
</template>
