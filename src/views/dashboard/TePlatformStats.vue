<script setup>
import { useAbility } from '@casl/vue'
import { computed } from 'vue'

/**
 * Les totaux de la plateforme, en une rangée de cartes.
 *
 * Ce sont des compteurs de fond — depuis le début, sans période — là où le reste
 * du tableau de bord lit le mois courant. D'où une rangée à part : mélanger les
 * deux ferait lire « 12 événements » comme « 12 événements en août ».
 *
 * Les chiffres viennent de `reports/platform`, qui applique la même portée
 * organisateur que les autres compteurs.
 */
const props = defineProps({
  /** Le bloc `data` de `reports/platform`. */
  platform: { type: Object, default: () => ({}) },
})

const formatNumber = value => new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))

const ability = useAbility()

/**
 * Chaque carte mène à l'écran qui détaille son chiffre — mais seulement si le
 * rôle y a accès : un lien qui rebondit sur le garde de route est pire que pas
 * de lien du tout.
 */
const linkTo = (path, subject) => (ability.can('read', subject) ? path : undefined)

/**
 * L'ordre n'est pas décoratif : il se lit en deux temps.
 *
 * D'abord les trois volumes — qui organise, qui achète, combien d'événements —
 * puis la répartition de ce dernier total : à venir, passés, annulés. Le total
 * précède donc toujours son détail, et sur trois colonnes (tablette) la coupure
 * tombe exactement entre les deux temps.
 *
 * `organizers` est nul pour un organisateur : le compteur n'a de sens qu'à
 * l'échelle de la plateforme. La carte disparaît alors plutôt que d'afficher 0,
 * qui se lirait comme « aucun organisateur ».
 *
 * Le tri se fait sur `null` strictement, et non sur « vide » : avant que l'appel
 * réponde, `platform` est un objet sans clés et toutes les valeurs sont
 * `undefined`. Les écarter aussi faisait disparaître la rangée entière pendant
 * le chargement — elle surgissait après coup, alors que le reste de l'écran
 * était déjà posé. Les cartes sont donc là d'emblée, à 0, comme les autres.
 */
const cards = computed(() =>
  [
    {
      title: 'Organisateurs',
      value: props.platform?.organizers,
      icon: 'tabler-building-store',
      color: 'primary',
      to: linkTo('/organizers', 'organizers'),
    },
    {
      title: 'Participants',
      value: props.platform?.participants,
      icon: 'tabler-users',
      color: 'success',
      to: linkTo('/participants', 'users'),
    },
    {
      title: 'Événements',
      value: props.platform?.events,
      icon: 'tabler-calendar-event',
      color: 'info',
      to: linkTo('/events', 'events'),
    },
    {
      title: 'Événements à venir',
      value: props.platform?.upcomingEvents,
      icon: 'tabler-calendar-plus',
      color: 'warning',
      to: linkTo('/events', 'events'),
    },
    {
      title: 'Événements passés',
      value: props.platform?.pastEvents,
      icon: 'tabler-calendar-check',
      color: 'secondary',
      to: linkTo('/events', 'events'),
    },
    {
      title: 'Événements annulés',
      value: props.platform?.cancelledEvents,
      icon: 'tabler-calendar-x',
      color: 'error',
      to: linkTo('/events', 'events'),
    },
  ].filter(card => card.value !== null),
)
</script>

<template>
  <VRow class="match-height">
    <VCol
      v-for="card in cards"
      :key="card.title"
      cols="6"
      sm="4"
      lg="2"
    >
      <VCard
        :to="card.to"
        :ripple="false"
        class="platform-stat h-100"
      >
        <VCardText class="d-flex flex-column gap-2">
          <VAvatar
            :color="card.color"
            variant="tonal"
            rounded
            size="40"
          >
            <VIcon
              :icon="card.icon"
              size="24"
            />
          </VAvatar>

          <div>
            <h5 class="text-h5">
              {{ formatNumber(card.value) }}
            </h5>
            <div class="text-sm text-medium-emphasis">
              {{ card.title }}
            </div>
          </div>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<style scoped>
/*
 * Vuetify pose un voile sombre au survol d'une carte cliquable. Sur une rangée
 * de six, ce voile se lit comme une sélection — on croit avoir activé la carte.
 * Le lien reste, le voile part.
 *
 * Le survol seulement : le même voile sert d'anneau de focus au clavier, et le
 * supprimer partout rendrait la rangée intraversable sans souris.
 */
.platform-stat:hover :deep(.v-card__overlay) {
  opacity: 0;
}
</style>
