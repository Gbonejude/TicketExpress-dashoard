<script setup>
import { toMediaUrl } from '@/utils/api'

/**
 * Les événements qui vendent le plus.
 *
 * Transposition de `EcommercePopularProducts` : l'affiche remplace la photo du
 * produit, l'organisateur le numéro d'article, et le chiffre d'affaires le prix.
 * Le widget du thème liste six produits Apple codés en dur, images comprises.
 */
const props = defineProps({
  /** `topEvents` de `reports/overview`, déjà trié par chiffre d'affaires. */
  events: { type: Array, default: () => [] },

  /** Combien de lignes afficher — la carte n'a pas la hauteur pour dix. */
  limit: { type: Number, default: 5 },
})

const router = useRouter()

const shown = computed(() => props.events.slice(0, props.limit))

const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(value ?? 0)))} FCFA`

const formatNumber = value => new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))

const openStats = event => router.push(`/events/${event.eventId}?tab=stats`)
</script>

<template>
  <VCard
    title="Événements les plus vendus"
    :subtitle="props.events.length
      ? `${formatNumber(props.events.length)} événement(s) avec des ventes`
      : null"
  >
    <VCardText>
      <VList
        v-if="shown.length"
        class="card-list"
      >
        <VListItem
          v-for="event in shown"
          :key="event.eventId"
          @click="openStats(event)"
        >
          <template #prepend>
            <VAvatar
              rounded
              size="34"
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
                size="18"
              />
            </VAvatar>
          </template>

          <VListItemTitle class="font-weight-medium">
            {{ event.title }}
          </VListItemTitle>
          <VListItemSubtitle>
            {{ event.organizer }} · {{ formatNumber(event.tickets) }} billet(s)
          </VListItemSubtitle>

          <template #append>
            <span class="text-body-1 font-weight-medium">
              {{ formatPrice(event.revenue) }}
            </span>
          </template>
        </VListItem>
      </VList>

      <p
        v-else
        class="text-body-2 text-medium-emphasis mb-0"
      >
        Aucune vente sur cette période.
      </p>
    </VCardText>
  </VCard>
</template>

<style lang="scss" scoped>
.card-list {
  --v-card-list-gap: 1.25rem;
}
</style>
