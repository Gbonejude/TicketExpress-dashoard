<script setup>
import { toMediaUrl } from '@/utils/api'

definePage({
  meta: {
    action: 'read',
    subject: 'events',
  },
})

/**
 * Événements en cours — l'écran d'exploitation.
 *
 * « En cours » se lit sur l'intervalle : commencé et pas encore terminé. Pas le
 * même filtre que la liste des événements, qui répond à « qu'est-ce que je gère »
 * quand celui-ci répond à « qu'est-ce qui tourne maintenant ».
 *
 * Un bloc « commencent bientôt » suit, pour deux raisons : l'écran ne reste pas
 * vide entre deux événements, et on voit venir ce qu'il faut préparer.
 *
 * Chaque carte mène directement au portique (onglet Contrôle d'accès) plutôt
 * qu'à la fiche : sur un événement en cours, c'est le geste attendu.
 */
const router = useRouter()

const soonHours = ref(24)

const apiUrl = computed(() => `/events/ongoing?soon_hours=${soonHours.value}`)

const { data: resp, isFetching, execute: fetchOngoing } = useApi(apiUrl)

const ongoing = computed(() => resp.value?.data?.ongoing ?? [])
const soon = computed(() => resp.value?.data?.soon ?? [])
const totals = computed(() => resp.value?.data?.totals ?? { ongoing: 0, soon: 0, sold: 0, scanned: 0 })

// Une entrée scannée ailleurs change ces chiffres.
useRealtimeRefresh('tickets', () => fetchOngoing())
useRealtimeRefresh('orders', () => fetchOngoing())

const soonOptions = [
  { title: 'Prochaines 24 h', value: 24 },
  { title: 'Prochaines 48 h', value: 48 },
  { title: 'Prochains 7 jours', value: 168 },
]

const formatNumber = value => new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))

const formatDateTime = iso => {
  if (!iso) return '—'

  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const formatHour = iso => {
  if (!iso) return '—'

  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Temps restant avant la fin, en clair. Null quand l'événement n'a pas de fin. */
const remaining = event => {
  if (!event.endDate) return null

  const minutes = Math.round((new Date(event.endDate) - Date.now()) / 60000)

  if (minutes <= 0) return 'se termine'
  if (minutes < 60) return `${minutes} min restantes`

  const hours = Math.floor(minutes / 60)

  return hours < 24
    ? `${hours} h restantes`
    : `${Math.floor(hours / 24)} j restants`
}

/** Dans combien de temps ça commence. */
const startsIn = event => {
  const minutes = Math.round((new Date(event.startDate) - Date.now()) / 60000)

  if (minutes <= 0) return 'imminent'
  if (minutes < 60) return `dans ${minutes} min`

  const hours = Math.floor(minutes / 60)

  return hours < 24 ? `dans ${hours} h` : `dans ${Math.floor(hours / 24)} j`
}

const goToCheckIn = event => router.push(`/events/${event.id}?tab=check-in`)
const goToStats = event => router.push(`/events/${event.id}?tab=stats`)

const statCards = computed(() => [
  {
    label: 'En cours', value: formatNumber(totals.value.ongoing),
    icon: 'tabler-broadcast', color: 'success',
  },
  {
    label: 'Billets vendus', value: formatNumber(totals.value.sold),
    icon: 'tabler-ticket', color: 'primary',
  },
  {
    label: 'Entrées enregistrées', value: formatNumber(totals.value.scanned),
    icon: 'tabler-qrcode', color: 'info',
  },
  {
    label: 'Commencent bientôt', value: formatNumber(totals.value.soon),
    icon: 'tabler-clock', color: 'warning',
  },
])
</script>

<template>
  <div>
    <VRow class="mb-2">
      <VCol
        v-for="card in statCards"
        :key="card.label"
        cols="12"
        sm="6"
        md="3"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-4">
            <VAvatar
              :color="card.color"
              variant="tonal"
              rounded
              size="42"
            >
              <VIcon :icon="card.icon" />
            </VAvatar>
            <div>
              <div class="text-body-2 text-medium-emphasis">
                {{ card.label }}
              </div>
              <div class="text-h6">
                {{ card.value }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- ─── En cours ─────────────────────────────────────────────────────── -->
    <VCard class="mb-6">
      <VCardTitle class="d-flex align-center justify-space-between flex-wrap gap-2 pa-4">
        <div class="d-flex align-center gap-2">
          <VIcon
            icon="tabler-broadcast"
            color="success"
          />
          <span class="text-h6">Événements en cours</span>
        </div>
        <VBtn
          variant="tonal"
          color="secondary"
          size="small"
          prepend-icon="tabler-refresh"
          :loading="isFetching"
          @click="fetchOngoing"
        >
          Actualiser
        </VBtn>
      </VCardTitle>

      <VDivider />

      <VCardText>
        <div
          v-if="isFetching && !ongoing.length"
          class="d-flex justify-center pa-6"
        >
          <VProgressCircular
            indeterminate
            color="primary"
          />
        </div>

        <VRow v-else-if="ongoing.length">
          <VCol
            v-for="event in ongoing"
            :key="event.id"
            cols="12"
            md="6"
          >
            <VCard
              variant="outlined"
              class="h-100"
            >
              <VCardText>
                <div class="d-flex gap-4">
                  <VAvatar
                    rounded="lg"
                    size="64"
                    color="primary"
                    variant="tonal"
                  >
                    <VImg
                      v-if="event.thumbnail"
                      :src="toMediaUrl(event.thumbnail)"
                      cover
                    />
                    <VIcon
                      v-else
                      icon="tabler-calendar-event"
                      size="28"
                    />
                  </VAvatar>

                  <div class="flex-grow-1">
                    <div class="d-flex align-center gap-2 flex-wrap">
                      <span class="text-body-1 font-weight-medium">{{ event.title }}</span>
                      <VChip
                        color="success"
                        size="x-small"
                        variant="tonal"
                      >
                        En cours
                      </VChip>
                    </div>

                    <div class="text-caption text-medium-emphasis mt-1">
                      {{ formatHour(event.startDate) }} → {{ formatHour(event.endDate) }}
                      <template v-if="remaining(event)">
                        · {{ remaining(event) }}
                      </template>
                    </div>

                    <div class="text-caption text-medium-emphasis">
                      <template v-if="event.venue">
                        {{ event.venue.name }}<span v-if="event.venue.city">, {{ event.venue.city }}</span>
                      </template>
                      <template v-else>
                        Événement en ligne
                      </template>
                      <template v-if="event.organizer">
                        · {{ event.organizer }}
                      </template>
                    </div>
                  </div>
                </div>

                <!-- Avancement des entrées -->
                <div class="mt-4">
                  <div class="d-flex justify-space-between text-body-2 mb-1">
                    <span>Entrées</span>
                    <span class="font-weight-medium">
                      {{ formatNumber(event.scanned) }} / {{ formatNumber(event.sold) }}
                      ({{ event.attendanceRate }} %)
                    </span>
                  </div>
                  <VProgressLinear
                    :model-value="event.attendanceRate"
                    color="success"
                    height="8"
                    rounded
                  />
                  <div class="text-caption text-medium-emphasis mt-1">
                    {{ formatNumber(event.notScanned) }} billet(s) pas encore présenté(s)
                  </div>
                </div>

                <div class="d-flex gap-2 mt-4">
                  <VBtn
                    color="primary"
                    size="small"
                    prepend-icon="tabler-qrcode"
                    @click="goToCheckIn(event)"
                  >
                    Contrôle d'accès
                  </VBtn>
                  <VBtn
                    variant="tonal"
                    color="secondary"
                    size="small"
                    prepend-icon="tabler-chart-bar"
                    @click="goToStats(event)"
                  >
                    Statistiques
                  </VBtn>
                </div>
              </VCardText>
            </VCard>
          </VCol>
        </VRow>

        <div
          v-else
          class="text-center py-8"
        >
          <VIcon
            icon="tabler-calendar-off"
            size="42"
            class="text-disabled mb-2"
          />
          <p class="text-body-1 mb-0">
            Aucun événement ne se déroule en ce moment.
          </p>
          <p class="text-body-2 text-medium-emphasis">
            Les événements apparaissent ici entre leur date de début et leur date de fin.
          </p>
        </div>
      </VCardText>
    </VCard>

    <!-- ─── Bientôt ──────────────────────────────────────────────────────── -->
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between flex-wrap gap-2 pa-4">
        <div class="d-flex align-center gap-2">
          <VIcon
            icon="tabler-clock"
            color="warning"
          />
          <span class="text-h6">Commencent bientôt</span>
        </div>
        <VSelect
          v-model="soonHours"
          :items="soonOptions"
          item-title="title"
          item-value="value"
          density="compact"
          hide-details
          style="max-width: 200px"
        />
      </VCardTitle>

      <VDivider />

      <VList v-if="soon.length">
        <VListItem
          v-for="event in soon"
          :key="event.id"
          @click="goToStats(event)"
        >
          <template #prepend>
            <VAvatar
              rounded="lg"
              size="40"
              color="warning"
              variant="tonal"
            >
              <VImg
                v-if="event.thumbnail"
                :src="toMediaUrl(event.thumbnail)"
                cover
              />
              <VIcon
                v-else
                icon="tabler-calendar-event"
                size="20"
              />
            </VAvatar>
          </template>

          <VListItemTitle>{{ event.title }}</VListItemTitle>
          <VListItemSubtitle class="text-caption">
            {{ formatDateTime(event.startDate) }}
            <span v-if="event.venue">· {{ event.venue.city }}</span>
          </VListItemSubtitle>

          <template #append>
            <div class="text-end">
              <VChip
                color="warning"
                size="small"
                variant="tonal"
              >
                {{ startsIn(event) }}
              </VChip>
              <div class="text-caption text-medium-emphasis mt-1">
                {{ formatNumber(event.sold) }} vendu(s)
              </div>
            </div>
          </template>
        </VListItem>
      </VList>

      <VCardText
        v-else
        class="text-body-2 text-medium-emphasis"
      >
        Aucun événement ne commence dans cette fenêtre.
      </VCardText>
    </VCard>
  </div>
</template>
