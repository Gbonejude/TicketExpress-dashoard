<script setup>
import { useTheme } from 'vuetify'

/**
 * La répartition des commandes par statut.
 *
 * Tient le rôle de `EcommerceOrder` du thème — un anneau et sa légende — en
 * version courte : l'original fait 348 lignes, dont un tableau de commandes
 * fictives que la page porte déjà ailleurs.
 *
 * Les couleurs suivent la convention du reste du back-office : payé en vert, en
 * attente en orange, annulé en rouge, remboursé en gris. Un même statut garde
 * donc la même couleur d'un écran à l'autre.
 */
const props = defineProps({
  /** `ordersByStatus` de `reports/overview`, indexé par statut. */
  byStatus: { type: Object, default: () => ({}) },
})

const vuetifyTheme = useTheme()

const ORDER = ['paid', 'pending', 'cancelled', 'refunded']

const rows = computed(() =>
  ORDER
    .filter(status => props.byStatus[status])
    .map(status => ({
      status,
      label: props.byStatus[status].label,
      count: Number(props.byStatus[status].count ?? 0),
      amount: Number(props.byStatus[status].amount ?? 0),
    })))

const total = computed(() => rows.value.reduce((sum, row) => sum + row.count, 0))

const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(value ?? 0)))} FCFA`

const colorFor = status => ({
  paid: 'success',
  pending: 'warning',
  cancelled: 'error',
  refunded: 'secondary',
})[status] ?? 'secondary'

const chartSeries = computed(() => rows.value.map(row => row.count))

const chartOptions = computed(() => {
  const theme = vuetifyTheme.current.value.colors
  const isDark = vuetifyTheme.current.value.dark

  return {
    chart: { type: 'donut' },
    labels: rows.value.map(row => row.label),
    colors: rows.value.map(row => theme[colorFor(row.status)]),
    stroke: { width: 0 },
    dataLabels: { enabled: false },
    legend: { show: false },
    tooltip: { enabled: true },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            value: {
              fontSize: '1.5rem',
              color: `rgba(${isDark ? '231,227,252' : '47,43,61'},0.9)`,
              offsetY: 4,
            },
            name: { show: false },
            total: {
              show: true,
              label: 'Commandes',
              fontSize: '0.8125rem',
              color: `rgba(${isDark ? '231,227,252' : '47,43,61'},0.7)`,

              // Le centre porte le total, pas la part survolée : c'est le
              // chiffre qu'on vient chercher.
              formatter: () => String(total.value),
            },
          },
        },
      },
    },
  }
})
</script>

<template>
  <VCard title="Commandes par statut">
    <VCardText>
      <VueApexCharts
        v-if="total"
        type="donut"
        height="200"
        :options="chartOptions"
        :series="chartSeries"
      />

      <VList
        v-if="total"
        class="card-list mt-4"
      >
        <VListItem
          v-for="row in rows"
          :key="row.status"
        >
          <template #prepend>
            <VBadge
              inline
              :color="colorFor(row.status)"
              dot
              class="me-2"
            />
          </template>

          <VListItemTitle class="text-body-2">
            {{ row.label }}
          </VListItemTitle>

          <template #append>
            <div class="text-end">
              <div class="text-body-2 font-weight-medium">
                {{ row.count }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ formatPrice(row.amount) }}
              </div>
            </div>
          </template>
        </VListItem>
      </VList>

      <p
        v-else
        class="text-body-2 text-medium-emphasis mb-0"
      >
        Aucune commande sur cette période.
      </p>
    </VCardText>
  </VCard>
</template>

<style lang="scss" scoped>
.card-list {
  --v-card-list-gap: 0.75rem;
}
</style>
