<script setup>
definePage({
  meta: {
    action: 'read',
    subject: 'categories',
  },
})

const search = ref('')
const currentPage = ref(1)
const isFormDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const editingCategory = ref(null)
const deletingCategory = ref(null)
const isSubmitting = ref(false)
const formRef = ref(null)
const slugTouched = ref(false)
const fieldErrors = reactive({
  name: undefined,
  slug: undefined,
})

const form = reactive({
  name: '',
  slug: '',
})

const headers = [
  { title: 'Nom', key: 'name' },
  { title: 'Slug', key: 'slug' },
  { title: 'Événements', key: 'eventsCount' },
  { title: 'Créée le', key: 'createdAt' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })
  if (search.value) params.set('search', search.value)

  return `/categories?${params.toString()}`
})

watch(search, () => { currentPage.value = 1 })

const { data: categoriesData, isFetching, execute: fetchCategories } = useApi(apiUrl)

const categories = computed(() => categoriesData.value?.data ?? [])
const totalCategories = computed(() => categoriesData.value?.meta?.total ?? 0)

const onTableOptions = ({ page }) => {
  if (page && page !== currentPage.value) currentPage.value = page
}

const maxLengthValidator = (value, length) => {
  if (!value) return true

  return String(value).length <= length || `Ce champ ne doit pas dépasser ${length} caractères.`
}

const slugify = value => (value ?? '')
  .toString()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')

watch(() => form.name, val => {
  if (!slugTouched.value) form.slug = slugify(val)
})

const resetForm = () => {
  form.name = ''
  form.slug = ''
  fieldErrors.name = undefined
  fieldErrors.slug = undefined
  slugTouched.value = false
  editingCategory.value = null
  formRef.value?.resetValidation()
}

const openCreateDialog = () => {
  resetForm()
  isFormDialogOpen.value = true
}

const openEditDialog = category => {
  resetForm()
  editingCategory.value = category
  form.name = category.name ?? ''
  form.slug = category.slug ?? ''
  slugTouched.value = true
  isFormDialogOpen.value = true
}

const openDeleteDialog = category => {
  deletingCategory.value = category
  isDeleteDialogOpen.value = true
}

const onSlugInput = () => {
  slugTouched.value = true
}

const saveCategory = async () => {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  fieldErrors.name = undefined
  fieldErrors.slug = undefined
  isSubmitting.value = true

  const payload = {
    name: form.name,
    slug: form.slug,
  }

  try {
    if (editingCategory.value) {
      await useApi(`/categories/${editingCategory.value.id}`).put(payload).json()
    } else {
      await useApi('/categories').post(payload).json()
    }
    isFormDialogOpen.value = false
    fetchCategories()
  } catch (error) {
    const errors = error?.data?.errors ?? error?._data?.errors
    if (errors) {
      fieldErrors.name = errors.name?.[0]
      fieldErrors.slug = errors.slug?.[0]
    }
  } finally {
    isSubmitting.value = false
  }
}

const confirmDelete = async () => {
  isSubmitting.value = true
  try {
    await useApi(`/categories/${deletingCategory.value.id}`).delete().json()
    isDeleteDialogOpen.value = false
    fetchCategories()
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">Gestion des Catégories</span>
        <VBtn
          color="primary"
          v-if="$can('create', 'categories')"
          prepend-icon="tabler-plus"
          @click="openCreateDialog"
        >
          Ajouter une catégorie
        </VBtn>
      </VCardTitle>

      <VDivider />

      <VCardText>
        <VTextField
          v-model="search"
          placeholder="Rechercher par nom ou slug..."
          prepend-inner-icon="tabler-search"
          density="compact"
          class="mb-4"
          style="max-width: 360px"
        />
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="categories"
        :items-length="totalCategories"
        :items-per-page="15"
        :page="currentPage"
        :loading="isFetching"
        :no-data-text="'Aucune catégorie'"
        class="text-no-wrap"
        @update:options="onTableOptions"
      >
        <!-- Nom -->
        <template #item.name="{ item }">
          <span class="font-weight-medium">{{ item.name }}</span>
        </template>

        <!-- Slug -->
        <template #item.slug="{ item }">
          <VChip
            size="small"
            color="secondary"
            variant="tonal"
            class="font-mono"
          >
            {{ item.slug }}
          </VChip>
        </template>

        <!-- Événements -->
        <template #item.eventsCount="{ item }">
          {{ item.eventsCount ?? 0 }}
        </template>

        <!-- Créée le -->
        <template #item.createdAt="{ item }">
          {{ item.createdAt?.human ?? '-' }}
        </template>

        <!-- Actions -->
        <template #item.actions="{ item }">
          <VTooltip text="Modifier" location="top">
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

          <VTooltip text="Supprimer" location="top">
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
      <VCard :title="editingCategory ? 'Modifier la catégorie' : 'Ajouter une catégorie'">
        <VCardText class="pt-4">
          <VForm ref="formRef">
            <VRow>
              <VCol cols="12">
                <VTextField
                  v-model="form.name"
                  label="Nom"
                  :rules="[requiredValidator, v => maxLengthValidator(v, 255)]"
                  :error-messages="fieldErrors.name"
                  required
                />
              </VCol>
              <VCol cols="12">
                <VTextField
                  v-model="form.slug"
                  label="Slug"
                  hint="Généré automatiquement depuis le nom, modifiable"
                  persistent-hint
                  :rules="[requiredValidator, v => maxLengthValidator(v, 255)]"
                  :error-messages="fieldErrors.slug"
                  required
                  @input="onSlugInput"
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
            @click="saveCategory"
          >
            {{ editingCategory ? 'Enregistrer les modifications' : 'Créer la catégorie' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Suppression ───────────────────────────────────────────────── -->
    <VDialog
      v-model="isDeleteDialogOpen"
      max-width="400"
    >
      <VCard title="Supprimer la catégorie">
        <VCardText class="pt-4">
          <p class="text-body-2">
            Êtes-vous sûr de vouloir supprimer
            <strong>{{ deletingCategory?.name }}</strong> ?
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
