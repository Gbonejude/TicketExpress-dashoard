<script setup>
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import { formatBucket } from '@/utils/reportBucket'

/**
 * La variation de la valeur moyenne d'un achat, pas après pas.
 *
 * Le panier moyen affiché en un seul chiffre ne dit pas grand-chose : 124 458
 * FCFA peut être une série régulière ou deux grosses commandes noyées dans des
 * achats à l'unité. C'est la variation qui répond — et qui montre l'effet d'un
 * tarif de groupe ou d'une promotion sur ce que les gens dépensent réellement.
 *
 * Rien n'est demandé de plus à l'API : la valeur se calcule à partir de la série
 * déjà renvoyée, recettes divisées par commandes. C'est exactement la définition
 * de `totals.averageBasket` côté serveur, appliquée à chaque pas — la courbe et
 * le total ne peuvent donc pas se contredire.
 */
const props = defineProps({
  /** `[{ bucket, revenue, orders }]` renvoyé par `reports/overview`. */
  series: { type: Array, default: () => [] },

  /** `totals.averageBasket` — la moyenne sur toute la période, en en-tête. */
  average: { type: [Number, String], default: 0 },

  /** Barre de chargement de la carte, pendant l'appel. */
  loading: { type: Boolean, default: false },
})

const vuetifyTheme = useTheme()

const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(value ?? 0)))} FCFA`

/**
 * Les pas sans commande sont écartés plutôt que mis à zéro : un jour sans vente
 * n'a pas de panier moyen. Le tracer à 0 dessinerait une chute vers le bas, qui
 * se lirait comme un effondrement du montant moyen alors qu'il ne s'est
 * simplement rien passé.
 */
const points = computed(() =>
  props.series
    .filter(point => Number(point.orders ?? 0) > 0)
    .map(point => ({
      bucket: point.bucket,
      value: Math.round(Number(point.revenue ?? 0) / Number(point.orders)),
    })))

const chartSeries = computed(() => [{
  name: 'Valeur moyenne',
  data: points.value.map(point => point.value),
}])

const chartOptions = computed(() => {
  const theme = vuetifyTheme.current.value.colors
  const isDark = vuetifyTheme.current.value.dark
  const labelColor = `rgba(${isDark ? '231,227,252' : '47,43,61'},0.7)`

  return {
    chart: { type: 'line', toolbar: { show: false }, parentHeightOffset: 0 },
    colors: [theme.info],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    grid: { borderColor: `rgba(${isDark ? '231,227,252' : '47,43,61'},0.12)` },

    // Un seul point ne trace pas de ligne : le graphique paraît vide alors qu'il
    // porte une valeur. Au-delà, les marqueurs alourdissent la courbe.
    markers: { size: points.value.length === 1 ? 6 : 0 },
    xaxis: {
      categories: points.value.map(point => formatBucket(point.bucket)),
      labels: { style: { colors: labelColor } },
      axisTicks: { show: false },
      axisBorder: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: labelColor },
        formatter: value => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(value),
      },
    },
    tooltip: { y: { formatter: value => formatPrice(value) } },
  }
})
</script>

<template>
  <VCard :loading="props.loading">
    <VCardItem>
      <VCardTitle>Valeur moyenne d'un achat</VCardTitle>
      <VCardSubtitle>Recettes divisées par commandes payées, pas à pas</VCardSubtitle>
      <template #append>
        <span class="text-sm text-disabled">
          Moyenne sur la période : {{ formatPrice(props.average) }}
        </span>
      </template>
    </VCardItem>

    <VCardText>
      <VueApexCharts
        v-if="points.length"
        type="line"
        height="250"
        :options="chartOptions"
        :series="chartSeries"
      />
      <p
        v-else
        class="text-body-2 text-medium-emphasis mb-0"
      >
        Aucun achat sur cette période.
      </p>
    </VCardText>
  </VCard>
</template>
