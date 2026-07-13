<script setup>
definePage({
  meta: {
    action: 'read',
    subject: 'reviews',
  },
})

const search = ref('')
const currentPage = ref(1)
const isDeleteDialogOpen = ref(false)
const deletingReview = ref(null)
const isSubmitting = ref(false)

const perPage = 15

const headers = [
  { title: 'Auteur', key: 'user' },
  { title: 'Événement', key: 'event' },
  { title: 'Note', key: 'rating' },
  { title: 'Commentaire', key: 'comment' },
  { title: 'Date', key: 'createdAt' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })
  if (search.value) params.set('search', search.value)

  return `/reviews?${params.toString()}`
})

watch(search, () => { currentPage.value = 1 })

const { data: reviewsData, isFetching, execute: fetchReviews } = useApi(apiUrl)

// NOTE (backend behavior confirmed by reading ReviewController@index):
// it currently returns the FULL list (`Review::query()->with(['user','event'])->latest()->get()`)
// with NO `meta` block and NO `search` filter (only an optional `event_id` filter, unused here).
// The `page`/`search` query params above are kept for forward-compat with §2 once the
// backend adds real server pagination — meanwhile we fall back to client-side
// search + slicing below so the page still behaves correctly today.
const allReviews = computed(() => reviewsData.value?.data ?? [])
const hasServerMeta = computed(() => !!reviewsData.value?.meta)

const filteredReviews = computed(() => {
  if (hasServerMeta.value || !search.value) return allReviews.value

  const q = search.value.toLowerCase()

  return allReviews.value.filter(r =>
    (r.user?.fullName ?? '').toLowerCase().includes(q)
    || (r.user?.email ?? '').toLowerCase().includes(q)
    || (r.event?.title ?? '').toLowerCase().includes(q)
    || (r.comment ?? '').toLowerCase().includes(q),
  )
})

const total = computed(() => reviewsData.value?.meta?.total ?? filteredReviews.value.length)

const reviews = computed(() => {
  if (hasServerMeta.value) return allReviews.value

  const start = (currentPage.value - 1) * perPage

  return filteredReviews.value.slice(start, start + perPage)
})

const onTableOptions = ({ page }) => {
  if (page && page !== currentPage.value) currentPage.value = page
}

const truncate = (value, length = 60) => {
  const text = value ?? ''

  return text.length > length ? `${text.slice(0, length)}…` : text
}

const openDeleteDialog = review => {
  deletingReview.value = review
  isDeleteDialogOpen.value = true
}

const confirmDelete = async () => {
  isSubmitting.value = true
  try {
    await useApi(`/reviews/${deletingReview.value.id}`).delete().json()
    isDeleteDialogOpen.value = false
    fetchReviews()
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">Gestion des Avis</span>
      </VCardTitle>

      <VDivider />

      <VCardText>
        <VTextField
          v-model="search"
          placeholder="Rechercher par auteur, événement ou commentaire..."
          prepend-inner-icon="tabler-search"
          density="compact"
          class="mb-4"
          style="max-width: 360px"
        />
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="reviews"
        :items-length="total"
        :items-per-page="15"
        :page="currentPage"
        :loading="isFetching"
        :no-data-text="'Aucun avis'"
        class="text-no-wrap"
        @update:options="onTableOptions"
      >
        <!-- Auteur -->
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

        <!-- Événement -->
        <template #item.event="{ item }">
          {{ item.event?.title ?? '-' }}
        </template>

        <!-- Note -->
        <template #item.rating="{ item }">
          <div class="d-flex align-center gap-2">
            <VRating
              readonly
              density="compact"
              size="small"
              :model-value="item.rating"
            />
            <span class="text-caption text-medium-emphasis">({{ item.rating }}/5)</span>
          </div>
        </template>

        <!-- Commentaire -->
        <template #item.comment="{ item }">
          <VTooltip
            v-if="item.comment"
            :text="item.comment"
            location="top"
          >
            <template #activator="{ props }">
              <span
                v-bind="props"
                class="d-inline-block text-truncate"
                style="max-width: 280px"
              >{{ truncate(item.comment) }}</span>
            </template>
          </VTooltip>
          <span
            v-else
            class="text-medium-emphasis"
          >-</span>
        </template>

        <!-- Date -->
        <template #item.createdAt="{ item }">
          {{ item.createdAt?.human ?? '-' }}
        </template>

        <!-- Actions -->
        <template #item.actions="{ item }">
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

    <!-- ─── Dialog Suppression ───────────────────────────────────────────────── -->
    <VDialog
      v-model="isDeleteDialogOpen"
      max-width="400"
    >
      <VCard title="Supprimer l'avis">
        <VCardText class="pt-4">
          <p class="text-body-2">
            Êtes-vous sûr de vouloir supprimer l'avis de
            <strong>{{ deletingReview?.user?.fullName ?? 'cet utilisateur' }}</strong>
            sur <strong>{{ deletingReview?.event?.title ?? 'cet événement' }}</strong> ?
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
