<script setup>

/**
 * Visionneuse d'image : un clic sur une vignette, l'image en grand.
 *
 * Les listes et les formulaires n'affichent que des vignettes de 40 à 88 px —
 * assez pour reconnaître une affiche, pas pour la vérifier. C'est pourtant ce
 * qu'on veut faire avant de publier un événement : lire le texte de l'affiche,
 * juger le cadrage.
 *
 * L'image reçoit sa taille du contenu, bornée à la fenêtre : une affiche portrait
 * ne déborde pas plus qu'une bannière panoramique.
 */
const props = defineProps({
  /** URL de l'image en pleine taille (pas la vignette). */
  src: { type: String, default: null },

  title: { type: String, default: null },
})

const open = defineModel({ type: Boolean, default: false })

const close = () => { open.value = false }
</script>

<template>
  <VDialog
    v-model="open"
    max-width="900"
  >
    <VCard>
      <VCardTitle
        v-if="props.title"
        class="d-flex align-center justify-space-between gap-2 pa-4"
      >
        <span class="text-body-1 text-truncate">{{ props.title }}</span>
        <VBtn
          icon
          variant="text"
          size="small"
          @click="close"
        >
          <VIcon icon="tabler-x" />
        </VBtn>
      </VCardTitle>

      <VImg
        v-if="props.src"
        :src="props.src"
        max-height="72vh"
        contain
        class="bg-surface-variant"
      >
        <template #placeholder>
          <div class="d-flex align-center justify-center h-100">
            <VProgressCircular
              indeterminate
              color="primary"
            />
          </div>
        </template>
      </VImg>

      <VCardText
        v-else
        class="text-body-2 text-medium-emphasis"
      >
        Aucune image à afficher.
      </VCardText>

      <VCardActions class="justify-end pa-4">
        <VBtn
          variant="tonal"
          color="secondary"
          @click="close"
        >
          Fermer
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
