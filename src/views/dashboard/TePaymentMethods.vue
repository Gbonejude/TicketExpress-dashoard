<script setup>
import { formatPrice } from '@/utils/money'

/**
 * Ce qui est encaissé, par opérateur mobile money.
 *
 * Équivalent de `EcommerceTransactions` du thème, appliqué aux deux opérateurs du
 * Togo. Chaque ligne porte le nombre de commandes et le montant : c'est la lecture
 * utile pour un rapprochement de compte.
 *
 * Les marques passent par `PaymentMethodLogo`, partagé avec l'écran Rapports.
 */
const props = defineProps({
  /** `revenueByPaymentMethod` de `reports/overview`. */
  methods: { type: Array, default: () => [] },
})
</script>

<template>
  <VCard title="Encaissements par opérateur">
    <VCardText>
      <VList
        v-if="props.methods.length"
        class="card-list"
      >
        <VListItem
          v-for="row in props.methods"
          :key="row.method"
        >
          <template #prepend>
            <PaymentMethodLogo
              :method="row.method"
              class="me-4"
            />
          </template>

          <VListItemTitle class="font-weight-medium">
            {{ row.method }}
          </VListItemTitle>
          <VListItemSubtitle>{{ row.orders }} commande(s)</VListItemSubtitle>

          <template #append>
            <span class="text-body-1 font-weight-medium">
              {{ formatPrice(row.revenue) }}
            </span>
          </template>
        </VListItem>
      </VList>

      <p
        v-else
        class="text-body-2 text-medium-emphasis mb-0"
      >
        Aucun encaissement sur cette période.
      </p>
    </VCardText>
  </VCard>
</template>

<style lang="scss" scoped>
.card-list {
  --v-card-list-gap: 1.25rem;

  /**
   * `VList` porte `overflow-y: auto`. Avec deux opérateurs il n'y a rien à faire
   * défiler, mais les lignes dépassaient de quelques pixels la hauteur calculée
   * de la liste — assez pour faire apparaître une barre de défilement dans une
   * carte qui tient pourtant entière à l'écran. La liste suit donc son contenu,
   * et c'est la carte qui donne la hauteur.
   */
  overflow: visible;
}
</style>
