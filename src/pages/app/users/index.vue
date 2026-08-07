<script setup>
import { notify, notifyApiError } from '@/utils/toast'
import { formatDateFr } from '@/utils/dateFormat'

definePage({
  meta: {
    action: 'read',
    subject: 'users',
  },
})

import { $api, toMediaUrl } from '@/utils/api'

const search = ref('')
const roleFilter = ref(null)
const currentPage = ref(1)
const isFormDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const editingUser = ref(null)
const deletingUser = ref(null)
const isSubmitting = ref(false)
const imageFile = ref(null)
const imagePreview = ref(null)
const imageInputRef = ref(null)
const formErrors = ref({})
const refForm = ref()

// Pas de `password` : il est généré par l'API et envoyé par mail au
// destinataire (CreateUserAction). Personne ne le saisit ici.
const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  role: '',
  gender: '',
  birthday: '',
})

const headers = [
  { title: 'Utilisateur', key: 'fullName' },
  { title: 'Téléphone', key: 'phone' },
  { title: 'Rôle', key: 'role' },
  { title: 'Créé le', key: 'createdAt' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const roleOptions = [
  { title: 'Participant', value: 'participant' },
  { title: 'Administrateur', value: 'admin' },
  { title: 'Organisateur', value: 'organizer-manager' },
  { title: 'Super Administrateur', value: 'super-admin' },
]

const genderOptions = [
  { title: 'Homme', value: 'male' },
  { title: 'Femme', value: 'female' },
]

const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })
  if (search.value) params.set('search', search.value)
  if (roleFilter.value) params.set('role', roleFilter.value)

  return `/users?${params.toString()}`
})

watch([search, roleFilter], () => { currentPage.value = 1 })

const { data: usersData, isFetching, execute: fetchUsers } = useApi(apiUrl)

const users = computed(() => usersData.value?.data ?? [])
const totalUsers = computed(() => usersData.value?.meta?.total ?? 0)

const onTableOptions = ({ page }) => {
  if (page && page !== currentPage.value) currentPage.value = page
}

const roleLabel = role => roleOptions.find(r => r.value === role)?.title ?? (role ?? '-')

const roleColor = role => ({
  'participant': 'secondary',
  'admin': 'primary',
  'organizer-manager': 'info',
  'super-admin': 'error',
})[role] ?? 'secondary'

const resetForm = () => {
  form.first_name = ''
  form.last_name = ''
  form.email = ''
  form.phone = ''
  form.role = ''
  form.gender = ''
  form.birthday = ''
  formErrors.value = {}
  imageFile.value = null
  imagePreview.value = null
  editingUser.value = null
  refForm.value?.resetValidation()
}

const onImageSelected = event => {
  const file = event.target.files[0]
  if (!file) return
  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
}

const resetImage = () => {
  imageFile.value = null
  imagePreview.value = null
}

const openCreateDialog = () => {
  resetForm()
  isFormDialogOpen.value = true
}

const openEditDialog = user => {
  resetForm()
  editingUser.value = user
  form.first_name = user.firstName ?? ''
  form.last_name = user.lastName ?? ''
  form.email = user.email ?? ''
  form.phone = user.phone ?? ''
  form.role = user.role ?? ''
  form.gender = user.gender ?? ''
  form.birthday = user.birthday ? String(user.birthday).slice(0, 10) : ''
  imagePreview.value = user.thumbnail
    ? toMediaUrl(user.thumbnail)
    : (user.image ? toMediaUrl(user.image) : null)
  isFormDialogOpen.value = true
}

const openDeleteDialog = user => {
  deletingUser.value = user
  isDeleteDialogOpen.value = true
}

const buildFormData = () => {
  const formData = new FormData()

  Object.entries(form).forEach(([key, val]) => {
    if (val !== '' && val !== null && val !== undefined) {
      formData.append(key, String(val))
    }
  })
  if (imageFile.value) formData.append('image', imageFile.value)

  return formData
}

const saveUser = async () => {
  const { valid } = await refForm.value?.validate() ?? { valid: true }
  if (!valid) return

  isSubmitting.value = true
  formErrors.value = {}
  try {
    if (editingUser.value) {
      if (imageFile.value) {
        const formData = buildFormData()

        formData.append('_method', 'PUT')
        await $api(`/users/${editingUser.value.id}`, { method: 'POST', body: formData })
      } else {
        await useApi(`/users/${editingUser.value.id}`).put({ ...form }).json()
      }
      notify('Utilisateur mis à jour.')
    } else {
      if (imageFile.value) {
        const formData = buildFormData()

        await $api('/users', { method: 'POST', body: formData })
      } else {
        await useApi('/users').post({ ...form }).json()
      }

      // Le mot de passe part par mail : le dire, sinon l'administrateur cherche
      // ce qu'il doit transmettre au nouvel utilisateur.
      notify(`Utilisateur créé. Ses identifiants ont été envoyés à ${form.email}.`)
    }
    isFormDialogOpen.value = false
    fetchUsers()
  } catch (error) {
    const data = error?.data ?? error?._data
    if (data?.errors) formErrors.value = data.errors
    else notifyApiError(error, "Impossible d'enregistrer l'utilisateur.")
  } finally {
    isSubmitting.value = false
  }
}

const confirmDelete = async () => {
  isSubmitting.value = true
  try {
    await useApi(`/users/${deletingUser.value.id}`).delete().json()
    isDeleteDialogOpen.value = false
    notify('Utilisateur supprimé.')
    fetchUsers()
  } catch (error) {
    notifyApiError(error, "Impossible de supprimer l'utilisateur.")
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">Gestion des Utilisateurs</span>
        <VBtn
          v-if="$can('create', 'users')"
          color="primary"
          prepend-icon="tabler-plus"
          @click="openCreateDialog"
        >
          Ajouter un utilisateur
        </VBtn>
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
              v-model="roleFilter"
              :items="roleOptions"
              item-title="title"
              item-value="value"
              label="Rôle"
              placeholder="Tous les rôles"
              density="compact"
              clearable
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="users"
        :items-length="totalUsers"
        :items-per-page="15"
        :page="currentPage"
        :loading="isFetching"
        no-data-text="Aucun utilisateur"
        class="text-no-wrap"
        @update:options="onTableOptions"
      >
        <!-- Utilisateur (avatar + nom + email) -->
        <template #item.fullName="{ item }">
          <div class="d-flex align-center gap-3">
            <VAvatar
              size="38"
              color="primary"
              variant="tonal"
            >
              <VImg
                v-if="item.thumbnail || item.image"
                :src="toMediaUrl(item.thumbnail || item.image)"
                cover
              />
              <span
                v-else
                class="text-sm font-weight-medium"
              >
                {{ item.fullName?.charAt(0)?.toUpperCase() ?? '?' }}
              </span>
            </VAvatar>
            <div>
              <div class="font-weight-medium">
                {{ item.fullName ?? '-' }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ item.email ?? '-' }}
              </div>
            </div>
          </div>
        </template>

        <!-- Téléphone -->
        <template #item.phone="{ item }">
          {{ item.phone ?? '-' }}
        </template>

        <!-- Rôle -->
        <template #item.role="{ item }">
          <VChip
            :color="roleColor(item.role)"
            size="small"
            variant="tonal"
          >
            {{ roleLabel(item.role) }}
          </VChip>
        </template>

        <!-- Créé le -->
        <template #item.createdAt="{ item }">
          {{ formatDateFr(item.createdAt) }}
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
      <VCard :title="editingUser ? 'Modifier l\'utilisateur' : 'Ajouter un utilisateur'">
        <VCardText class="pt-4">
          <VForm ref="refForm">
            <VRow>
              <!-- Photo -->
              <VCol
                cols="12"
                class="d-flex align-center gap-6"
              >
                <VAvatar
                  size="88"
                  color="primary"
                  variant="tonal"
                >
                  <VImg
                    v-if="imagePreview"
                    :src="imagePreview"
                    cover
                  />
                  <VIcon
                    v-else
                    icon="tabler-user"
                    size="40"
                  />
                </VAvatar>

                <div class="d-flex flex-column gap-3">
                  <div class="d-flex flex-wrap gap-3">
                    <VBtn
                      size="small"
                      prepend-icon="tabler-cloud-upload"
                      @click="imageInputRef?.click()"
                    >
                      Importer une photo
                    </VBtn>
                    <VBtn
                      v-if="imagePreview"
                      size="small"
                      color="secondary"
                      variant="tonal"
                      prepend-icon="tabler-refresh"
                      @click="resetImage"
                    >
                      Réinitialiser
                    </VBtn>
                  </div>
                  <p class="text-body-2 text-medium-emphasis mb-0">
                    JPG ou PNG · Max 2 Mo
                  </p>
                </div>

                <input
                  ref="imageInputRef"
                  type="file"
                  accept="image/png, image/jpeg"
                  class="d-none"
                  @change="onImageSelected"
                >
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.first_name"
                  label="Prénom"
                  :rules="[requiredField('Prénom'), v => (v ?? '').length <= 255 || 'Le prénom ne doit pas dépasser 255 caractères']"
                  :error-messages="formErrors.first_name"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.last_name"
                  label="Nom"
                  :rules="[requiredField('Nom'), v => (v ?? '').length <= 255 || 'Le nom ne doit pas dépasser 255 caractères']"
                  :error-messages="formErrors.last_name"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.email"
                  label="Email"
                  type="email"
                  :rules="[requiredField('Email'), emailValidator]"
                  :error-messages="formErrors.email"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.phone"
                  label="Téléphone"
                  :rules="[
                    requiredField('Téléphone'),
                    v => (v ?? '').length >= 8 || 'Le téléphone doit contenir au moins 8 caractères',
                    v => (v ?? '').length <= 12 || 'Le téléphone ne doit pas dépasser 12 caractères',
                    v => /^([0-9\s\-+()]*)$/.test(v ?? '') || 'Format de téléphone invalide',
                  ]"
                  :error-messages="formErrors.phone"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="form.role"
                  :items="roleOptions"
                  item-title="title"
                  item-value="value"
                  label="Rôle"
                  :rules="[requiredField('Rôle')]"
                  :error-messages="formErrors.role"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="form.gender"
                  :items="genderOptions"
                  item-title="title"
                  item-value="value"
                  label="Genre"
                  :rules="[requiredField('Genre')]"
                  :error-messages="formErrors.gender"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.birthday"
                  label="Date de naissance"
                  type="date"
                  :rules="[v => !v || new Date(v) < new Date(new Date().toDateString()) || 'La date de naissance doit être antérieure à aujourd\'hui']"
                  :error-messages="formErrors.birthday"
                />
              </VCol>

              <!--
                Rien à l'ajout : le mot de passe généré puis envoyé par mail
                n'a pas besoin d'être annoncé dans le formulaire. À la
                modification, l'absence de champ mot de passe mérite en
                revanche une explication. 
              -->
              <VCol
                v-if="editingUser"
                cols="12"
              >
                <VAlert
                  type="info"
                  variant="tonal"
                  density="compact"
                  icon="tabler-mail-forward"
                >
                  Le mot de passe ne se modifie pas d'ici. L'utilisateur le
                  renouvelle lui-même via « mot de passe oublié ».
                </VAlert>
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
            @click="saveUser"
          >
            {{ editingUser ? 'Enregistrer les modifications' : 'Créer l\'utilisateur' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Suppression ───────────────────────────────────────────────── -->
    <VDialog
      v-model="isDeleteDialogOpen"
      max-width="400"
    >
      <VCard title="Supprimer l'utilisateur">
        <VCardText class="pt-4">
          <p class="text-body-2">
            Êtes-vous sûr de vouloir supprimer
            <strong>{{ deletingUser?.fullName }}</strong> ?
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
