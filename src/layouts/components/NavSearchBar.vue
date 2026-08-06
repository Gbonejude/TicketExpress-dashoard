<script setup>
import Shepherd from 'shepherd.js'
import { useConfigStore } from '@core/stores/config'

defineOptions({
  inheritAttrs: false,
})

const configStore = useConfigStore()
const router = useRouter()
const ability = useAbility()

const isAppSearchBarVisible = ref(false)
const isLoading = ref(false)
const searchQuery = ref('')
const searchResult = ref([])

// Every back-office page, tagged with the ability subject that guards it.
const appPages = [
  { title: 'Tableau de bord', icon: 'tabler-layout-dashboard', subject: 'dashboard', url: { name: 'dashboard' } },
  { title: 'Événements', icon: 'tabler-calendar-event', subject: 'events', url: { name: 'events' } },
  { title: 'Commandes', icon: 'tabler-shopping-cart', subject: 'bookings', url: { name: 'orders' } },
  { title: 'Paiements', icon: 'tabler-credit-card', subject: 'payments', url: { name: 'payments' } },
  { title: 'Promotions', icon: 'tabler-rosette-discount', subject: 'promotions', url: { name: 'promotions' } },
  { title: 'Billets vendus', icon: 'tabler-ticket', subject: 'tickets', url: { name: 'tickets' } },
  { title: 'Coupons', icon: 'tabler-discount', subject: 'coupons', url: { name: 'coupons' } },
  { title: 'Catégories', icon: 'tabler-category', subject: 'categories', url: { name: 'categories' } },
  { title: 'Lieux', icon: 'tabler-map-pin', subject: 'venues', url: { name: 'venues' } },
  { title: 'Organisateurs', icon: 'tabler-building-store', subject: 'organizers', url: { name: 'organizers' } },
  { title: 'Utilisateurs', icon: 'tabler-users', subject: 'users', url: { name: 'users' } },
  { title: 'Rôles & permissions', icon: 'tabler-lock-cog', subject: 'administrators', url: { name: 'roles' } },
  { title: 'Retraits', icon: 'tabler-cash', subject: 'withdrawals', url: { name: 'withdrawals' } },
  { title: 'Notifications', icon: 'tabler-bell', subject: 'notifications', url: { name: 'notifications' } },
  { title: 'Mon compte', icon: 'tabler-user', subject: 'Auth', url: { name: 'account', query: { tab: 'profile' } } },
]

// Only the pages the current user is actually allowed to open.
const allowedPages = computed(() => appPages.filter(p => ability.can('read', p.subject)))

const suggestionGroups = computed(() => [
  {
    title: 'Navigation',
    content: allowedPages.value,
  },
])

const noDataSuggestions = computed(() => allowedPages.value.slice(0, 4))

const normalize = str => (str ?? '')
  .toString()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')

const runSearch = () => {
  const term = normalize(searchQuery.value).trim()
  if (!term) {
    searchResult.value = []

    return
  }

  const matches = allowedPages.value.filter(p => normalize(p.title).includes(term))

  searchResult.value = matches.length
    ? [{ title: 'Pages', children: matches }]
    : []
}

watch(searchQuery, runSearch)

const closeSearchBar = () => {
  isAppSearchBarVisible.value = false
  searchQuery.value = ''
}

const redirectToSuggestedPage = selected => {
  router.push(selected.url)
  closeSearchBar()
}

const LazyAppBarSearch = defineAsyncComponent(() => import('@core/components/AppBarSearch.vue'))
</script>

<template>
  <div
    class="d-flex align-center cursor-pointer"
    v-bind="$attrs"
    style="user-select: none;"
    @click="isAppSearchBarVisible = !isAppSearchBarVisible"
  >
    <IconBtn @click="Shepherd.activeTour?.cancel()">
      <VIcon icon="tabler-search" />
    </IconBtn>

    <span
      v-if="configStore.appContentLayoutNav === 'vertical'"
      class="d-none d-md-flex align-center text-disabled ms-2"
      @click="Shepherd.activeTour?.cancel()"
    >
      <span class="me-2">Rechercher</span>
      <span class="meta-key">&#8984;K</span>
    </span>
  </div>

  <LazyAppBarSearch
    v-model:isDialogVisible="isAppSearchBarVisible"
    :search-results="searchResult"
    :is-loading="isLoading"
    @search="searchQuery = $event"
  >
    <!-- suggestions -->
    <template #suggestions>
      <VCardText class="app-bar-search-suggestions pa-12">
        <VRow v-if="suggestionGroups">
          <VCol
            v-for="suggestion in suggestionGroups"
            :key="suggestion.title"
            cols="12"
          >
            <p
              class="custom-letter-spacing text-disabled text-uppercase py-2 px-4 mb-0"
              style="font-size: 0.75rem; line-height: 0.875rem;"
            >
              {{ suggestion.title }}
            </p>
            <VList class="card-list">
              <VListItem
                v-for="item in suggestion.content"
                :key="item.title"
                class="app-bar-search-suggestion mx-4 mt-2"
                @click="redirectToSuggestedPage(item)"
              >
                <VListItemTitle>{{ item.title }}</VListItemTitle>
                <template #prepend>
                  <VIcon
                    :icon="item.icon"
                    size="20"
                    class="me-n1"
                  />
                </template>
              </VListItem>
            </VList>
          </VCol>
        </VRow>
      </VCardText>
    </template>

    <!-- no data suggestion -->
    <template #noDataSuggestion>
      <div class="mt-9">
        <span class="d-flex justify-center text-disabled mb-2">Suggestions</span>
        <h6
          v-for="suggestion in noDataSuggestions"
          :key="suggestion.title"
          class="app-bar-search-suggestion text-h6 font-weight-regular cursor-pointer py-2 px-4"
          @click="redirectToSuggestedPage(suggestion)"
        >
          <VIcon
            size="20"
            :icon="suggestion.icon"
            class="me-2"
          />
          <span>{{ suggestion.title }}</span>
        </h6>
      </div>
    </template>

    <!-- search result -->
    <template #searchResult="{ item }">
      <VListSubheader class="text-disabled custom-letter-spacing font-weight-regular ps-4">
        {{ item.title }}
      </VListSubheader>
      <VListItem
        v-for="list in item.children"
        :key="list.title"
        :to="list.url"
        @click="closeSearchBar"
      >
        <template #prepend>
          <VIcon
            size="20"
            :icon="list.icon"
            class="me-n1"
          />
        </template>
        <template #append>
          <VIcon
            size="20"
            icon="tabler-corner-down-left"
            class="enter-icon flip-in-rtl"
          />
        </template>
        <VListItemTitle>
          {{ list.title }}
        </VListItemTitle>
      </VListItem>
    </template>
  </LazyAppBarSearch>
</template>

<style lang="scss">
@use "@styles/variables/vuetify.scss";

.meta-key {
  border: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  block-size: 1.5625rem;
  font-size: 0.8125rem;
  line-height: 1.3125rem;
  padding-block: 0.125rem;
  padding-inline: 0.25rem;
}

.app-bar-search-dialog {
  .custom-letter-spacing {
    letter-spacing: 0.8px;
  }

  .card-list {
    --v-card-list-gap: 8px;
  }
}
</style>
