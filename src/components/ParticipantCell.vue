<script setup>
import { toMediaUrl } from '@/utils/api'

/**
 * Cellule « Participant » des tableaux : portrait rond, nom, téléphone.
 *
 * Les listes de commandes et de paiements affichaient le nom et l'email en deux
 * lignes de texte. L'email est l'identifiant du compte, pas ce qu'on lit pour
 * reconnaître quelqu'un — au guichet on appelle un nom et on rappelle un
 * numéro. Le portrait vient du compte quand il existe ; sinon les initiales,
 * pour qu'une ligne d'achat invité garde la même hauteur qu'une autre.
 *
 * Le nom et le téléphone sont pris sur la commande, pas sur le compte : une
 * commande passée en invité n'a pas de compte, et une commande passée pour
 * quelqu'un d'autre porte le nom du participant, pas celui de l'acheteur.
 */
const props = defineProps({
  /** Nom complet, tel que porté par la commande. */
  name: { type: String, default: null },

  /** Téléphone de la commande. */
  phone: { type: String, default: null },

  /** Le compte rattaché, s'il y en a un — sert au portrait. */
  user: { type: Object, default: null },

  size: { type: [Number, String], default: 38 },
})

const photo = computed(() => {
  const source = props.user?.thumbnail || props.user?.image

  // `getFirstMediaUrl` de Spatie renvoie une chaîne vide, pas null, quand il n'y
  // a pas de média : le `||` ci-dessus la traite comme absente.
  return source ? toMediaUrl(source) : null
})

/**
 * Deux initiales quand on a prénom + nom, une sinon.
 */
const initials = computed(() => {
  const words = (props.name ?? '').trim().split(/\s+/).filter(Boolean)

  if (!words.length) return '?'

  return words
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('')
})
</script>

<template>
  <div class="d-flex align-center gap-3">
    <VAvatar
      :size="size"
      color="primary"
      variant="tonal"
    >
      <VImg
        v-if="photo"
        :src="photo"
        cover
      />
      <span
        v-else
        class="text-sm font-weight-medium"
      >{{ initials }}</span>
    </VAvatar>

    <div>
      <div class="font-weight-medium">
        {{ name ?? '-' }}
      </div>
      <div class="text-caption text-medium-emphasis">
        {{ phone || '—' }}
      </div>
    </div>
  </div>
</template>
