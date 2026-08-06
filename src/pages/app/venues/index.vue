<script setup>
import { notify, notifyApiError } from '@/utils/toast'

definePage({
  meta: {
    action: 'read',
    subject: 'venues',
  },
})

const search = ref('')
const eventFilter = ref(null)
const currentPage = ref(1)
const isFormDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const editingVenue = ref(null)
const deletingVenue = ref(null)
const isSubmitting = ref(false)
const refForm = ref(null)
const errors = ref({})

const form = reactive({
  name: '',
  address: '',
  city: '',
  country: 'Togo',
  capacity: null,
  latitude: null,
  longitude: null,
})

const headers = [
  { title: 'Lieu', key: 'name' },
  { title: 'Ville', key: 'city' },
  { title: 'Capacité', key: 'capacity' },
  { title: 'Événements', key: 'eventsCount' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })
  if (search.value) params.set('search', search.value)
  if (eventFilter.value) params.set('event_id', eventFilter.value)

  return `/venues?${params.toString()}`
})

watch([search, eventFilter], () => { currentPage.value = 1 })

// 100 par page : le select doit contenir tous les événements, pas les 15 de la
// première page.
const { data: eventsData } = useApi('/events?page=1&per_page=100')

const eventOptions = computed(() => eventsData.value?.data ?? [])

const { data: venuesData, isFetching, execute: fetchVenues } = useApi(apiUrl)

const venues = computed(() => venuesData.value?.data ?? [])
const totalVenues = computed(() => venuesData.value?.meta?.total ?? 0)

const onTableOptions = ({ page }) => {
  if (page && page !== currentPage.value) currentPage.value = page
}

const formatNumber = value => {
  if (value === null || value === undefined || value === '') return '-'

  return new Intl.NumberFormat('fr-FR').format(value)
}

const resetForm = () => {
  form.name = ''
  form.address = ''
  form.city = ''
  form.country = 'Togo'
  form.capacity = null
  form.latitude = null
  form.longitude = null
  errors.value = {}
  editingVenue.value = null
  refForm.value?.resetValidation()
}

const openCreateDialog = () => {
  resetForm()
  isFormDialogOpen.value = true
}

const openEditDialog = venue => {
  editingVenue.value = venue
  errors.value = {}
  form.name = venue.name ?? ''
  form.address = venue.address ?? ''
  form.city = venue.city ?? ''
  form.country = venue.country ?? 'Togo'
  form.capacity = venue.capacity ?? null
  form.latitude = venue.latitude ?? null
  form.longitude = venue.longitude ?? null
  isFormDialogOpen.value = true
}

const openDeleteDialog = venue => {
  deletingVenue.value = venue
  isDeleteDialogOpen.value = true
}

const buildPayload = () => {
  const payload = {
    name: form.name,
    address: form.address,
    city: form.city,
    capacity: form.capacity,
  }

  if (form.country !== '' && form.country !== null && form.country !== undefined)
    payload.country = form.country
  if (form.latitude !== '' && form.latitude !== null && form.latitude !== undefined)
    payload.latitude = form.latitude
  if (form.longitude !== '' && form.longitude !== null && form.longitude !== undefined)
    payload.longitude = form.longitude

  return payload
}

const saveVenue = async () => {
  const { valid } = await refForm.value?.validate()

  if (!valid) return

  isSubmitting.value = true
  errors.value = {}
  try {
    const payload = buildPayload()

    if (editingVenue.value) {
      await useApi(`/venues/${editingVenue.value.id}`).put(payload).json()
    } else {
      await useApi('/venues').post(payload).json()
    }
    isFormDialogOpen.value = false
    notify(editingVenue.value ? 'Lieu mis à jour.' : 'Lieu créé.')
    fetchVenues()
  } catch (error) {
    const payloadErrors = error?.data?.errors ?? error?._data?.errors
    if (payloadErrors) errors.value = payloadErrors
    else notifyApiError(error, "Impossible d'enregistrer le lieu.")
  } finally {
    isSubmitting.value = false
  }
}

const confirmDelete = async () => {
  isSubmitting.value = true
  try {
    await useApi(`/venues/${deletingVenue.value.id}`).delete().json()
    isDeleteDialogOpen.value = false
    notify('Lieu supprimé.')
    fetchVenues()
  } catch (error) {
    notifyApiError(error, 'Impossible de supprimer le lieu.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">Gestion des Lieux</span>
        <VBtn
          v-if="$can('create', 'venues')"
          color="primary"
          prepend-icon="tabler-plus"
          @click="openCreateDialog"
        >
          Ajouter un lieu
        </VBtn>
      </VCardTitle>

      <VDivider />

      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="7"
          >
            <VTextField
              v-model="search"
              label="Rechercher"
              placeholder="Nom, ville ou adresse…"
              prepend-inner-icon="tabler-search"
              density="compact"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            md="5"
          >
            <!--
              Filtre par événement : on part de l'affiche pour retrouver la
              salle, son adresse et sa capacité. 
            -->
            <VSelect
              v-model="eventFilter"
              :items="eventOptions"
              item-title="title"
              item-value="id"
              label="Événement"
              placeholder="Tous les événements"
              density="compact"
              clearable
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="venues"
        :items-length="totalVenues"
        :items-per-page="15"
        :page="currentPage"
        :loading="isFetching"
        no-data-text="Aucun lieu"
        class="text-no-wrap"
        @update:options="onTableOptions"
      >
        <!-- Lieu -->
        <template #item.name="{ item }">
          <div class="d-flex align-center gap-3">
            <VAvatar
              size="34"
              color="primary"
              variant="tonal"
            >
              <VIcon icon="tabler-map-pin" />
            </VAvatar>
            <div>
              <div class="font-weight-medium">
                {{ item.name ?? '-' }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ item.address ?? '' }}
              </div>
            </div>
          </div>
        </template>

        <!-- Ville -->
        <template #item.city="{ item }">
          <div>
            <div>{{ item.city ?? '-' }}</div>
            <div class="text-caption text-medium-emphasis">
              {{ item.country ?? '' }}
            </div>
          </div>
        </template>

        <!-- Capacité -->
        <template #item.capacity="{ item }">
          {{ formatNumber(item.capacity) }}
        </template>

        <!-- Événements -->
        <template #item.eventsCount="{ item }">
          <VChip
            size="small"
            color="secondary"
            variant="tonal"
          >
            {{ item.eventsCount ?? 0 }}
          </VChip>
        </template>

        <!-- Actions -->
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
      <VCard :title="editingVenue ? 'Modifier le lieu' : 'Ajouter un lieu'">
        <VCardText class="pt-4">
          <VForm ref="refForm">
            <VRow>
              <VCol cols="12">
                <VTextField
                  v-model="form.name"
                  label="Nom du lieu"
                  :rules="[requiredValidator, v => !v || v.length <= 255 || 'Maximum 255 caractères']"
                  :error-messages="errors.name"
                  required
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="form.address"
                  label="Adresse"
                  rows="2"
                  :rules="[requiredValidator]"
                  :error-messages="errors.address"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.city"
                  label="Ville"
                  :rules="[requiredValidator, v => !v || v.length <= 255 || 'Maximum 255 caractères']"
                  :error-messages="errors.city"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.country"
                  label="Pays"
                  placeholder="Togo"
                  :rules="[v => !v || v.length <= 255 || 'Maximum 255 caractères']"
                  :error-messages="errors.country"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model.number="form.capacity"
                  label="Capacité"
                  type="number"
                  min="1"
                  :rules="[requiredValidator, integerValidator, v => !v || v >= 1 || 'La capacité doit être au moins 1']"
                  :error-messages="errors.capacity"
                  required
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model.number="form.latitude"
                  label="Latitude"
                  type="number"
                  step="any"
                  placeholder="6.1319"
                  :rules="[v => !v && v !== 0 ? true : betweenValidator(v, -90, 90)]"
                  :error-messages="errors.latitude"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model.number="form.longitude"
                  label="Longitude"
                  type="number"
                  step="any"
                  placeholder="1.2228"
                  :rules="[v => !v && v !== 0 ? true : betweenValidator(v, -180, 180)]"
                  :error-messages="errors.longitude"
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
            @click="saveVenue"
          >
            {{ editingVenue ? 'Enregistrer les modifications' : 'Créer le lieu' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Suppression ───────────────────────────────────────────────── -->
    <VDialog
      v-model="isDeleteDialogOpen"
      max-width="400"
    >
      <VCard title="Supprimer le lieu">
        <VCardText class="pt-4">
          <p class="text-body-2">
            Êtes-vous sûr de vouloir supprimer
            <strong>{{ deletingVenue?.name }}</strong> ?
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
  </div>
</template>
