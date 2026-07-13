<script setup>
definePage({
  meta: {
    action: 'read',
    subject: 'administrators',
  },
})

import { $api } from '@/utils/api'

const search = ref('')

// ─── Screens catalogue (checkbox list) ──────────────────────────────────────
const { data: screensData } = useApi('/screens')
const screenCatalogue = computed(() => screensData.value?.data?.screens ?? [])

// ─── Roles list ─────────────────────────────────────────────────────────────
const { data: rolesData, isFetching, execute: fetchRoles } = useApi('/roles')
const roles = computed(() => rolesData.value?.data ?? [])

const filteredRoles = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return roles.value

  return roles.value.filter(r =>
    (r.label ?? '').toLowerCase().includes(term)
    || (r.name ?? '').toLowerCase().includes(term))
})

const headers = [
  { title: 'Rôle', key: 'label' },
  { title: 'Écrans autorisés', key: 'screens', sortable: false },
  { title: 'Utilisateurs', key: 'usersCount' },
  { title: 'Actions', key: 'actions', sortable: false },
]

// ─── Dialog state ────────────────────────────────────────────────────────────
const isFormDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const editingRole = ref(null)
const deletingRole = ref(null)
const isSubmitting = ref(false)
const formErrors = ref({})
const refForm = ref()

const form = reactive({
  name: '',
  label: '',
  screens: [],
  actions: [],
})

const actionLabels = {
  create: 'Créer',
  update: 'Modifier',
  delete: 'Supprimer',
}

// Drop a screen's action grants when the screen itself is unchecked.
watch(() => [...form.screens], selected => {
  form.actions = form.actions.filter(a => selected.includes(a.split('.')[0]))
})

const snackbar = ref(false)
const snackText = ref('')
const snackColor = ref('success')

const notify = (text, color = 'success') => {
  snackText.value = text
  snackColor.value = color
  snackbar.value = true
}

const screenLabel = key => screenCatalogue.value.find(s => s.key === key)?.label ?? key

const resetForm = () => {
  form.name = ''
  form.label = ''
  form.screens = []
  form.actions = []
  formErrors.value = {}
  editingRole.value = null
  refForm.value?.resetValidation()
}

const openCreateDialog = () => {
  resetForm()
  isFormDialogOpen.value = true
}

const openEditDialog = role => {
  resetForm()
  editingRole.value = role
  form.name = role.name ?? ''
  form.label = role.label ?? ''
  form.screens = [...(role.screens ?? [])]
  form.actions = [...(role.actions ?? [])]
  isFormDialogOpen.value = true
}

const toggleAllScreens = () => {
  if (form.screens.length === screenCatalogue.value.length)
    form.screens = []
  else
    form.screens = screenCatalogue.value.map(s => s.key)
}

const saveRole = async () => {
  const { valid } = await refForm.value?.validate() ?? { valid: true }
  if (!valid) return

  isSubmitting.value = true
  formErrors.value = {}
  try {
    if (editingRole.value) {
      await $api(`/roles/${editingRole.value.id}`, {
        method: 'PUT',
        body: { label: form.label, screens: form.screens, actions: form.actions },
      })
      notify('Rôle mis à jour.')
    } else {
      await $api('/roles', {
        method: 'POST',
        body: { name: form.name, label: form.label, screens: form.screens, actions: form.actions },
      })
      notify('Rôle créé.')
    }
    isFormDialogOpen.value = false
    fetchRoles()
  } catch (error) {
    const data = error?.data ?? error?._data
    if (data?.errors) formErrors.value = data.errors
    else notify(data?.message ?? "Impossible d'enregistrer le rôle.", 'error')
  } finally {
    isSubmitting.value = false
  }
}

const openDeleteDialog = role => {
  deletingRole.value = role
  isDeleteDialogOpen.value = true
}

const confirmDelete = async () => {
  isSubmitting.value = true
  try {
    await $api(`/roles/${deletingRole.value.id}`, { method: 'DELETE' })
    isDeleteDialogOpen.value = false
    notify('Rôle supprimé.')
    fetchRoles()
  } catch (error) {
    notify(error?.data?.message ?? 'Impossible de supprimer le rôle.', 'error')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">Rôles &amp; permissions</span>
        <VBtn
          color="primary"
          prepend-icon="tabler-plus"
          @click="openCreateDialog"
        >
          Créer un rôle
        </VBtn>
      </VCardTitle>

      <VDivider />

      <VCardText>
        <VTextField
          v-model="search"
          placeholder="Rechercher un rôle..."
          prepend-inner-icon="tabler-search"
          density="compact"
          style="max-width: 360px"
        />
      </VCardText>

      <VDataTable
        :headers="headers"
        :items="filteredRoles"
        :loading="isFetching"
        :items-per-page="10"
        no-data-text="Aucun rôle"
        class="text-no-wrap"
      >
        <!-- Rôle -->
        <template #item.label="{ item }">
          <div class="font-weight-medium">
            {{ item.label ?? item.name }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ item.name }}
            <VChip
              v-if="item.isSystem"
              size="x-small"
              color="info"
              variant="tonal"
              class="ms-1"
            >
              Système
            </VChip>
          </div>
        </template>

        <!-- Écrans -->
        <template #item.screens="{ item }">
          <div
            v-if="item.name === 'super-admin'"
            class="text-medium-emphasis"
          >
            Accès total
          </div>
          <div
            v-else-if="!item.screens?.length"
            class="text-disabled"
          >
            Aucun écran
          </div>
          <div
            v-else
            class="d-flex flex-wrap gap-1"
            style="max-width: 520px; white-space: normal;"
          >
            <VChip
              v-for="s in item.screens"
              :key="s"
              size="x-small"
              variant="tonal"
            >
              {{ screenLabel(s) }}
            </VChip>
          </div>
        </template>

        <!-- Utilisateurs -->
        <template #item.usersCount="{ item }">
          {{ item.usersCount ?? 0 }}
        </template>

        <!-- Actions -->
        <template #item.actions="{ item }">
          <VTooltip
            v-if="item.name !== 'super-admin'"
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
            v-if="!item.isSystem"
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
      </VDataTable>
    </VCard>

    <!-- ─── Dialog Créer / Modifier ─────────────────────────────────────────── -->
    <VDialog
      v-model="isFormDialogOpen"
      max-width="720"
      scrollable
    >
      <VCard :title="editingRole ? 'Modifier le rôle' : 'Créer un rôle'">
        <VCardText class="pt-4">
          <VForm ref="refForm">
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.name"
                  label="Nom technique"
                  placeholder="ex : guichet"
                  :disabled="!!editingRole"
                  :rules="editingRole ? [] : [requiredValidator]"
                  :error-messages="formErrors.name"
                  hint="Identifiant unique, non modifiable après création."
                  persistent-hint
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.label"
                  label="Libellé"
                  placeholder="ex : Guichet"
                  :error-messages="formErrors.label"
                />
              </VCol>
            </VRow>

            <div class="d-flex align-center justify-space-between mt-4 mb-2">
              <span class="text-subtitle-1 font-weight-medium">Écrans &amp; actions autorisés</span>
              <VBtn
                size="small"
                variant="text"
                @click="toggleAllScreens"
              >
                {{ form.screens.length === screenCatalogue.length ? 'Tout décocher' : 'Tout cocher' }}
              </VBtn>
            </div>
            <p class="text-caption text-medium-emphasis mb-2">
              Cocher un écran donne l'accès (voir/lister). Les cases Créer / Modifier / Supprimer accordent les actions correspondantes.
            </p>
            <VList class="border rounded py-0">
              <template
                v-for="(screen, idx) in screenCatalogue"
                :key="screen.key"
              >
                <VDivider v-if="idx" />
                <VListItem class="px-3 py-1">
                  <div
                    class="d-flex flex-wrap align-center"
                    style="gap: 4px 24px;"
                  >
                    <VCheckbox
                      v-model="form.screens"
                      :value="screen.key"
                      :label="screen.label"
                      density="compact"
                      hide-details
                      style="min-inline-size: 190px;"
                    />
                    <div
                      v-if="form.screens.includes(screen.key) && screen.actions?.length"
                      class="d-flex flex-wrap"
                      style="gap: 0 18px;"
                    >
                      <VCheckbox
                        v-for="a in screen.actions"
                        :key="a"
                        v-model="form.actions"
                        :value="`${screen.key}.${a}`"
                        :label="actionLabels[a] ?? a"
                        density="compact"
                        color="primary"
                        hide-details
                      />
                    </div>
                    <span
                      v-else-if="form.screens.includes(screen.key)"
                      class="text-caption text-disabled"
                    >Lecture seule</span>
                  </div>
                </VListItem>
              </template>
            </VList>
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
            @click="saveRole"
          >
            {{ editingRole ? 'Enregistrer' : 'Créer le rôle' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Suppression ───────────────────────────────────────────────── -->
    <VDialog
      v-model="isDeleteDialogOpen"
      max-width="400"
    >
      <VCard title="Supprimer le rôle">
        <VCardText class="pt-4">
          <p class="text-body-2">
            Êtes-vous sûr de vouloir supprimer le rôle
            <strong>{{ deletingRole?.label ?? deletingRole?.name }}</strong> ?
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

    <VSnackbar
      v-model="snackbar"
      :color="snackColor"
      location="top end"
    >
      {{ snackText }}
    </VSnackbar>
  </div>
</template>
