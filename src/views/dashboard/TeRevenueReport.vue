<script setup>
import { useTheme } from 'vuetify'
import { formatBucket } from '@/utils/reportBucket'

/**
 * La courbe du chiffre d'affaires, sur la période.
 *
 * Même rôle que `EcommerceRevenueReport` du thème, en beaucoup plus court : le
 * widget d'origine fait 448 lignes pour deux graphiques et un budget fictif. Ici
 * une seule série, celle que renvoie `reports/overview` — le pas est décidé par
 * l'API (jour ou mois selon l'étendue de la période).
 */
const props = defineProps({
  /** `[{ bucket, revenue, orders }]` renvoyé par l'API. */
  series: { type: Array, default: () => [] },

  /** Barre de chargement de la carte, pendant l'appel. */
  loading: { type: Boolean, default: false },
})

const vuetifyTheme = useTheme()

const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(value ?? 0)))} FCFA`

const chartSeries = computed(() => [{
  name: "Chiffre d'affaires",
  data: props.series.map(point => point.revenue),
}])

const chartOptions = computed(() => {
  const theme = vuetifyTheme.current.value.colors
  const isDark = vuetifyTheme.current.value.dark
  const labelColor = `rgba(${isDark ? '231,227,252' : '47,43,61'},0.7)`

  return {
    chart: { type: 'area', toolbar: { show: false }, parentHeightOffset: 0 },
    colors: [theme.primary],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
    grid: { borderColor: `rgba(${isDark ? '231,227,252' : '47,43,61'},0.12)` },

    // Un seul point ne trace ni courbe ni aire : le graphique paraît vide alors
    // qu'il porte une valeur. On ne montre le marqueur que dans ce cas — au-delà,
    // il alourdit la courbe sans rien apprendre.
    markers: { size: props.series.length === 1 ? 6 : 0 },
    xaxis: {
      categories: props.series.map(point => formatBucket(point.bucket)),
      labels: { style: { colors: labelColor } },
      axisTicks: { show: false },
      axisBorder: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: labelColor },

        // Notation compacte : « 750k » plutôt que « 750 000 », sinon l'axe
        // mange la moitié de la largeur du graphique.
        formatter: value => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(value),
      },
    },
    tooltip: { y: { formatter: value => formatPrice(value) } },
  }
})
</script>

<template>
  <VCard :loading="props.loading">
    <!--
      Pas de « net organisateurs » ici : « Recettes du mois » porte désormais le
      partage complet du montant. Le répéter en en-tête faisait apparaître trois
      fois la même somme sur un seul écran.
    -->
    <VCardItem>
      <VCardTitle>Chiffre d'affaires</VCardTitle>
    </VCardItem>

    <VCardText>
      <VueApexCharts
        v-if="props.series.length"
        type="area"
        height="290"
        :options="chartOptions"
        :series="chartSeries"
      />
      <p
        v-else
        class="text-body-2 text-medium-emphasis mb-0"
      >
        Aucune vente sur cette période.
      </p>
    </VCardText>
  </VCard>
</template>
