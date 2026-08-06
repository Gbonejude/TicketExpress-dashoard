<script setup>
import { computed } from 'vue'

/**
 * Les chiffres de la billetterie du mois, dans une seule carte.
 *
 * Reprend la composition de `EcommerceStatistics` du thème — une carte, une
 * grille, pastille colorée et valeur en gros — mais les valeurs arrivent par
 * props. Le widget du thème les porte en dur (`stats: '230k'`, `'$9745'`) : le
 * recopier tel quel aurait affiché des montants inventés sur un écran d'argent.
 *
 * Aucun chiffre d'ici n'est repris ailleurs sur l'écran. Le chiffre d'affaires,
 * la commission et le net organisateurs sont le contenu de « Recettes du mois »
 * juste à gauche ; les commandes par statut, celui de l'anneau en dessous. Les
 * répéter mangeait la place de ce qui ne se lit nulle part ailleurs.
 */
const props = defineProps({
  /** Le bloc `totals` de `reports/overview`. */
  totals: { type: Object, default: () => ({}) },

  /** Libellé de la période, affiché en discret à droite du titre. */
  periodLabel: { type: String, default: null },
})

const formatNumber = value => new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))

/**
 * Les billets encore à contrôler : émis, moins ceux déjà passés à l'entrée.
 *
 * Le compteur d'entrées de la carte voisine dit la part déjà faite ; celui-ci dit
 * le reste à faire. C'est le même chiffre lu par l'autre bout, et c'est ce bout-là
 * qui compte un soir d'événement.
 */
const ticketsToCheck = computed(() =>
  Math.max(0, Number(props.totals.ticketsIssued ?? 0) - Number(props.totals.checkedIn ?? 0)))

const statistics = computed(() => [
  {
    title: 'Billets vendus',
    stats: formatNumber(props.totals.ticketsSold),
    icon: 'tabler-ticket',
    color: 'success',
  },
  {
    title: 'Billets à valider',
    stats: formatNumber(ticketsToCheck.value),
    icon: 'tabler-scan',
    color: 'info',
  },
  {
    title: 'Billets annulés',
    stats: formatNumber(props.totals.ticketsCancelled),
    icon: 'tabler-circle-x',
    color: 'error',
  },
  {
    title: 'Participants',
    stats: formatNumber(props.totals.participants),
    icon: 'tabler-users',
    color: 'secondary',
  },
])
</script>

<template>
  <VCard title="Statistiques billetterie">
    <template #append>
      <span class="text-sm text-disabled">{{ props.periodLabel }}</span>
    </template>

    <VCardText>
      <VRow>
        <VCol
          v-for="item in statistics"
          :key="item.title"
          cols="6"
          md="3"
        >
          <div class="d-flex align-center gap-4">
            <VAvatar
              :color="item.color"
              variant="tonal"
              rounded
              size="40"
            >
              <VIcon :icon="item.icon" />
            </VAvatar>

            <div class="d-flex flex-column">
              <h5 class="text-h5">
                {{ item.stats }}
              </h5>
              <div class="text-sm">
                {{ item.title }}
              </div>
            </div>
          </div>
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
