<script setup>
import { computed } from 'vue'

// `?url` est obligatoire : le projet monte `vite-svg-loader`, qui sans ce suffixe
// transforme tout import `.svg` en composant Vue. Passé à `:src`, un composant ne
// produit aucune image — le logo Flooz (webp) s'affichait, celui de Mix by Yas non.
import mixxByYas from '@images/payments/mixx-by-yas.svg?url'
import moovMoney from '@images/payments/moov-money.webp'

/**
 * Le logo d'un opérateur mobile money, dans une boîte de taille fixe.
 *
 * Composant partagé plutôt que markup recopié : les deux marques n'ont pas la
 * même forme — Moov Money est un carré de 512 × 512, Mix by Yas un logotype de
 * 201 × 81. Dans une pastille carrée, le second ne fait plus que 14 px de haut.
 * D'où une boîte large et un logo « contenu » dedans : chacun garde ses
 * proportions et les deux occupent la même hauteur utile.
 *
 * C'est la solution déjà retenue sur le tunnel de paiement du site public. Les
 * deux surfaces montrent donc les mêmes marques de la même façon — et le piège du
 * `?url` ci-dessus n'est écrit qu'une fois.
 */
const props = defineProps({
  /** Le libellé renvoyé par l'API : « Flooz » ou « Mix by Yas ». */
  method: { type: String, default: null },

  /** Hauteur de la boîte, en rem. La largeur suit le même rapport 16/11. */
  height: { type: Number, default: 2.75 },
})

const LOGOS = {
  'Flooz': moovMoney,
  'Mix by Yas': mixxByYas,
}

/** Null pour un opérateur inconnu : on retombe alors sur une pastille neutre. */
const logo = computed(() => LOGOS[props.method] ?? null)

const boxStyle = computed(() => ({
  blockSize: `${props.height}rem`,
  inlineSize: `${(props.height * 16) / 11}rem`,
}))
</script>

<template>
  <span
    class="te-operator-logo"
    :style="boxStyle"
  >
    <img
      v-if="logo"
      :src="logo"
      :alt="props.method"
    >
    <VIcon
      v-else
      icon="tabler-currency-dollar"
      size="20"
    />
  </span>
</template>

<style lang="scss" scoped>
.te-operator-logo {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  padding: 0.25rem;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;

  img {
    block-size: 100%;
    inline-size: 100%;
    object-fit: contain;
  }
}
</style>
