import { computed } from 'vue'
import { useAbility } from '@casl/vue'

/**
 * L'organisateur derrière la session, et ce qu'on a le droit d'en faire.
 *
 * La même question — « faut-il montrer un sélecteur d'organisateur ? » — se
 * posait sur quatre écrans, et y recevait quatre réponses recopiées à la main :
 * deux la posaient, deux l'avaient oubliée. D'où ce point unique.
 *
 * Elle se décline en deux, parce qu'un filtre et un champ de formulaire ne
 * échouent pas de la même façon :
 *
 * — Un **filtre** ne sert qu'à regarder plus loin que soi. Le droit de le voir
 *   est donc celui de voir les organisateurs, lu dans les règles CASL : elles
 *   sont rafraîchies à chaque démarrage par `/me`, alors que la relation
 *   `organizer` dépend de ce que le cookie de session porte. Un organisateur à
 *   qui on montre ce filtre croit son écran cassé : l'API le ramène à ses
 *   propres chiffres quel que soit le nom choisi.
 *
 * — Un **champ de formulaire** doit être remplacé, pas seulement caché : l'API
 *   exige l'organisateur. On ne le masque donc que si la session sait par quoi
 *   le pré-remplir — un compte connecté avant que `organizer` n'entre dans la
 *   session garde la liste plutôt que de ne plus rien pouvoir créer.
 */
export const useCurrentOrganizer = () => {
  const userData = useCookie('userData')
  const ability = useAbility()

  const isOrganizerUser = computed(() => userData.value?.role === 'organizer-manager')
  const organizer = computed(() => userData.value?.organizer ?? null)
  const organizerId = computed(() => organizer.value?.id ?? null)
  const organizerName = computed(() => organizer.value?.companyName ?? null)

  /** Filtres : réservés aux comptes qui administrent les organisateurs. */
  const canChooseOrganizer = computed(() => ability.can('read', 'organizers'))

  /** Formulaires : masquer le champ suppose pouvoir le remplir à sa place. */
  const isScopedToOwnOrganizer = computed(() => isOrganizerUser.value && !!organizerId.value)

  return {
    isOrganizerUser,
    organizer,
    organizerId,
    organizerName,
    canChooseOrganizer,
    isScopedToOwnOrganizer,
  }
}
