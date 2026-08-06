<script setup>
import { toMediaUrl } from '@/utils/api'
import TeAverageBasketTrend from '@/views/dashboard/TeAverageBasketTrend.vue'
import TeOrdersDonut from '@/views/dashboard/TeOrdersDonut.vue'
import TePaymentMethods from '@/views/dashboard/TePaymentMethods.vue'
import TePlatformStats from '@/views/dashboard/TePlatformStats.vue'
import TePopularEvents from '@/views/dashboard/TePopularEvents.vue'
import TeRevenueReport from '@/views/dashboard/TeRevenueReport.vue'
import TeStatistics from '@/views/dashboard/TeStatistics.vue'

definePage({
  meta: {
    action: 'read',
    subject: 'dashboard',
  },
})

/**
 * Tableau de bord.
 *
 * Construit sur la composition du dashboard « ecommerce » du thème — bandeau
 * d'accueil, carte de statistiques, courbe des recettes, anneau des commandes,
 * palmarès, encaissements — parce que c'est le seul des trois dont chaque carte a
 * un équivalent réel en billetterie. Les cartes sont les nôtres
 * (`views/dashboard/Te*.vue`) : celles du thème portent leurs chiffres en dur, et
 * les recopier aurait affiché des montants inventés sur un écran d'argent.
 *
 * S'y ajoute « En ce moment », qui n'a pas d'équivalent ecommerce mais qui est la
 * carte la plus utile un soir d'événement.
 *
 * La période est le mois courant, sans sélecteur : le tableau de bord répond à
 * « où en est-on aujourd'hui ? ». Les périodes libres, le journal et l'export sont
 * l'affaire de Rapports & statistiques, qui interroge les mêmes endpoints — deux
 * lectures du même total ne peuvent donc pas diverger.
 */
const router = useRouter()

const now = new Date()
const params = `filterType=month&year=${now.getFullYear()}&month=${now.getMonth() + 1}`

/**
 * Le mois précédent, pour situer le mois courant.
 *
 * Un chiffre seul ne dit rien : 750 000 FCFA est un bon mois ou un mauvais selon
 * ce qui précède. D'où ce second appel, sur le même endpoint — la comparaison est
 * donc calculée sur exactement la même définition du chiffre d'affaires.
 */
const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)

const previousParams =
  `filterType=month&year=${previous.getFullYear()}&month=${previous.getMonth() + 1}`

const { data: overviewData, isFetching: overviewLoading } = useApi(`/reports/overview?${params}`)
const { data: previousData } = useApi(`/reports/overview?${previousParams}`)
const { data: ongoingData, execute: fetchOngoing } = useApi('/events/ongoing?soon_hours=48')

/**
 * Les totaux de la plateforme — sans période, contrairement à tout le reste de
 * l'écran. Un endpoint distinct plutôt qu'un bloc de plus dans `overview`, qui
 * est toujours lu à travers un mois : les deux chiffres ne répondent pas à la
 * même question.
 */
const { data: platformData, execute: fetchPlatform } = useApi('/reports/platform')

/**
 * Les retraits en attente : de l'argent qui attend une décision.
 *
 * Chargé seulement si l'écran des retraits est accessible — la route exige
 * `screen.withdrawals`, et demander sans le droit ne ramènerait qu'un 403.
 */
const ability = useAbility()

const canSeeWithdrawals = computed(() => ability.can('read', 'withdrawals'))

const { data: withdrawalsData } = canSeeWithdrawals.value
  ? useApi('/withdrawals?status=pending')
  : { data: ref(null) }

const platform = computed(() => platformData.value?.data ?? {})

const overview = computed(() => overviewData.value?.data ?? null)
const totals = computed(() => overview.value?.totals ?? {})
const periodLabel = computed(() => overview.value?.period?.label ?? '')

const previousTotals = computed(() => previousData.value?.data?.totals ?? {})
const pendingWithdrawals = computed(() => withdrawalsData.value?.stats?.pending ?? null)

const ongoing = computed(() => ongoingData.value?.data?.ongoing ?? [])
const soon = computed(() => ongoingData.value?.data?.soon ?? [])

// Une entrée scannée ou une commande payée changent ces chiffres.
useRealtimeRefresh('tickets', () => fetchOngoing())
useRealtimeRefresh('orders', () => {
  fetchOngoing()
  fetchPlatform()
})

// Un événement créé ou annulé, un organisateur validé : les totaux bougent.
useRealtimeRefresh('events', () => fetchPlatform())
useRealtimeRefresh('organizers', () => fetchPlatform())

const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(value ?? 0)))} FCFA`

const formatNumber = value => new Intl.NumberFormat('fr-FR').format(Number(value ?? 0))

const formatHour = iso => {
  if (!iso) return '—'

  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Part des billets émis déjà passés à l'entrée. */
const attendanceRate = computed(() => {
  const issued = Number(totals.value.ticketsIssued ?? 0)

  if (!issued) return 0

  return Math.round((Number(totals.value.checkedIn ?? 0) / issued) * 100)
})

/**
 * L'écart avec le mois précédent, en pourcentage.
 *
 * Renvoie null quand le mois précédent est à zéro : passer de 0 à 750 000 n'est
 * pas « +∞ % », c'est un premier mois — et l'afficher comme une progression
 * mentirait sur la tendance.
 */
const trend = computed(() => {
  const before = Number(previousTotals.value.revenue ?? 0)
  const current = Number(totals.value.revenue ?? 0)

  if (!before) return null

  return Math.round(((current - before) / before) * 100)
})

const trendColor = computed(() => {
  if (trend.value === null) return 'secondary'

  return trend.value >= 0 ? 'success' : 'error'
})

const goToCheckIn = event => router.push(`/events/${event.id}?tab=check-in`)
</script>

<template>
  <VRow class="match-height">
    <!-- ─── Bandeau d'accueil ─────────────────────────────────────────────── -->
    <VCol
      cols="12"
      md="4"
    >
      <VCard>
        <VCardText>
          <h5 class="text-h5 mb-1">
            Recettes du mois
          </h5>
          <p class="text-body-2 mb-2">
            {{ periodLabel }}
          </p>

          <div class="d-flex align-center flex-wrap gap-2 mb-1">
            <h4 class="text-h4 text-primary mb-0">
              {{ formatPrice(totals.revenue) }}
            </h4>

            <!--
              La tendance, quand le mois précédent existe : un montant seul ne
              dit pas si le mois est bon. 
            -->
            <VChip
              v-if="trend !== null"
              :color="trendColor"
              size="small"
              variant="tonal"
              :prepend-icon="trend >= 0 ? 'tabler-trending-up' : 'tabler-trending-down'"
            >
              {{ trend >= 0 ? '+' : '' }}{{ trend }} %
            </VChip>
          </div>

          <!--
            Le partage du montant, sous le montant lui-même : la commission de la
            plateforme et ce qui revient aux organisateurs. Les deux lignes se
            lisent ensemble — chacune seule laisse deviner l'autre, et c'est
            précisément la question qu'on se pose devant une recette.
          -->
          <p class="text-body-2 mb-1">
            dont {{ formatPrice(totals.commission) }} de commission
          </p>
          <p class="text-body-2 mb-1">
            Net organisateurs : {{ formatPrice(totals.netRevenue) }}
          </p>
          <!--
            Le rappel du mois précédent seulement s'il y a eu des ventes. Sans
            elles il n'y a rien à comparer, et l'écrire n'apprend rien : la
            tendance est déjà absente, ce qui le dit assez.
          -->
          <p
            v-if="trend !== null"
            class="text-caption text-medium-emphasis mb-0"
          >
            Mois précédent : {{ formatPrice(previousTotals.revenue) }}
          </p>

          <!--
            L'écart se prend sur le bouton et non sur la ligne au-dessus : celle
            du mois précédent peut ne pas être là, et le bouton se retrouverait
            alors collé au partage du montant.
          -->
          <VBtn
            class="mt-4"
            variant="tonal"
            size="small"
            prepend-icon="tabler-report-analytics"
            to="/reports"
          >
            Voir les rapports
          </VBtn>
        </VCardText>
      </VCard>
    </VCol>

    <!-- ─── Statistiques ──────────────────────────────────────────────────── -->
    <VCol
      cols="12"
      md="8"
    >
      <TeStatistics
        :totals="totals"
        :period-label="periodLabel"
      />
    </VCol>

    <!-- ─── Courbe des recettes ───────────────────────────────────────────── -->
    <VCol
      cols="12"
      md="8"
    >
      <TeRevenueReport
        :series="overview?.series ?? []"
        :loading="overviewLoading"
      />
    </VCol>

    <!-- ─── Commandes par statut ──────────────────────────────────────────── -->
    <VCol
      cols="12"
      md="4"
    >
      <TeOrdersDonut :by-status="overview?.ordersByStatus ?? {}" />
    </VCol>

    <!-- ─── Valeur moyenne d'un achat ─────────────────────────────────────── -->
    <VCol cols="12">
      <TeAverageBasketTrend
        :series="overview?.series ?? []"
        :average="totals.averageBasket"
        :loading="overviewLoading"
      />
    </VCol>

    <!--
      ─── Totaux de la plateforme ─────────────────────────────────────────

      Les seuls compteurs sans période — ce que la plateforme porte depuis le
      début, là où tout le reste de l'écran se lit à travers le mois courant.
      D'où une rangée à part, qui coupe l'écran en deux : le mois au-dessus, le
      fond en dessous.
    -->
    <VCol cols="12">
      <TePlatformStats :platform="platform" />
    </VCol>

    <!--
      ─── Entrées et retraits ─────────────────────────────────────────────

      Les cartes sont empilées dans un conteneur flex en colonne, et non posées
      les unes sous les autres : la rangée porte `match-height`, dont la règle
      `block-size: 100%` frappe *toutes* les cartes qu'elle contient, si bien
      que chacune réclamait la hauteur entière de la colonne.
      Le débordement passait sous la rangée suivante. `h-auto` rend à chaque carte
      sa hauteur de contenu — sans quoi le flex les comprime, et comme `VCard`
      masque son débordement, le texte se retrouvait coupé net. La première prend
      la place restante, pour que le bas de la colonne s'aligne sur ses voisines.
    -->
    <VCol
      cols="12"
      md="4"
    >
      <div class="d-flex flex-column gap-6 h-100">
        <VCard
          title="Entrées"
          class="h-auto flex-grow-1"
        >
          <VCardText>
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-h5">{{ attendanceRate }} %</span>
              <span class="text-body-2 text-medium-emphasis">
                {{ formatNumber(totals.checkedIn) }} / {{ formatNumber(totals.ticketsIssued) }}
              </span>
            </div>
            <VProgressLinear
              :model-value="attendanceRate"
              color="success"
              height="8"
              rounded
            />
            <p class="text-caption text-medium-emphasis mt-2 mb-0">
              Part des billets émis déjà présentés à l'entrée.
            </p>
          </VCardText>
        </VCard>

        <!--
          Les retraits en attente : de l'argent qui attend une décision. Visible
          seulement pour qui a l'écran des retraits.
        -->
        <VCard
          v-if="pendingWithdrawals"
          class="h-auto"
        >
          <VCardText class="d-flex align-center justify-space-between gap-4">
            <div class="d-flex align-center gap-4">
              <VAvatar
                color="warning"
                variant="tonal"
                rounded
                size="40"
              >
                <VIcon icon="tabler-cash-banknote" />
              </VAvatar>
              <div>
                <h5 class="text-h5">
                  {{ formatPrice(pendingWithdrawals.total) }}
                </h5>
                <div class="text-sm">
                  {{ pendingWithdrawals.count }} retrait(s) en attente
                </div>
              </div>
            </div>

            <VBtn
              icon
              variant="text"
              size="small"
              to="/withdrawals"
            >
              <VIcon icon="tabler-chevron-right" />
            </VBtn>
          </VCardText>
        </VCard>
      </div>
    </VCol>

    <!-- ─── Palmarès ──────────────────────────────────────────────────────── -->
    <VCol
      cols="12"
      md="4"
    >
      <TePopularEvents :events="overview?.topEvents ?? []" />
    </VCol>

    <!-- ─── Encaissements ─────────────────────────────────────────────────── -->
    <VCol
      cols="12"
      md="4"
    >
      <TePaymentMethods :methods="overview?.revenueByPaymentMethod ?? []" />
    </VCol>

    <!-- ─── En ce moment ──────────────────────────────────────────────────── -->
    <VCol cols="12">
      <VCard>
        <VCardItem>
          <VCardTitle>
            <VIcon
              icon="tabler-broadcast"
              color="success"
              size="20"
              class="me-1"
            />
            En ce moment
          </VCardTitle>
          <template #append>
            <VBtn
              variant="text"
              size="small"
              to="/live-events"
            >
              Tout voir
            </VBtn>
          </template>
        </VCardItem>

        <VDivider />

        <VList v-if="ongoing.length">
          <VListItem
            v-for="event in ongoing"
            :key="event.id"
            @click="goToCheckIn(event)"
          >
            <template #prepend>
              <VAvatar
                rounded="lg"
                size="40"
                color="success"
                variant="tonal"
              >
                <VImg
                  v-if="event.thumbnail"
                  :src="toMediaUrl(event.thumbnail)"
                  cover
                />
                <VIcon
                  v-else
                  icon="tabler-calendar-event"
                  size="20"
                />
              </VAvatar>
            </template>

            <VListItemTitle>{{ event.title }}</VListItemTitle>
            <VListItemSubtitle class="text-caption">
              {{ formatHour(event.startDate) }} → {{ formatHour(event.endDate) }}
              <span v-if="event.venue">· {{ event.venue.city }}</span>
            </VListItemSubtitle>

            <template #append>
              <div class="text-end">
                <div class="text-body-2 font-weight-medium">
                  {{ event.scanned }} / {{ event.sold }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  entrées
                </div>
              </div>
            </template>
          </VListItem>
        </VList>

        <VCardText
          v-else
          class="text-body-2 text-medium-emphasis"
        >
          Aucun événement en cours.
          <span v-if="soon.length">
            {{ soon.length }} commence(nt) dans les 48 h.
          </span>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>
