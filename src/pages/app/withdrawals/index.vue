<script setup>
import { notify, notifyApiError } from '@/utils/toast'
import { formatDateFr } from '@/utils/dateFormat'
import { useCurrentOrganizer } from '@/composables/useCurrentOrganizer'

definePage({
  meta: {
    action: 'read',
    subject: 'withdrawals',
  },
})

import { $api } from '@/utils/api'

/**
 * Gestion des Retraits.
 *
 * Le principe de l'écran : on ne demande jamais un montant à l'aveugle, et on ne
 * propose jamais une action que le circuit refuse.
 *
 * - Le solde disponible de l'organisateur est affiché dans le formulaire, dès
 *   qu'il est choisi (endpoint `withdrawals/earnings`, qui existait mais que
 *   personne n'appelait). Les demandes déjà en attente en sont déduites.
 * - Les statuts proposés au traitement viennent de `nextStatuses`, calculé par le
 *   domaine : un retrait payé n'offre plus rien, et « payé » n'apparaît qu'après
 *   approbation.
 */
/**
 * Un organisateur demande un retrait pour lui-même.
 *
 * Le formulaire lui faisait choisir un organisateur dans la liste entière ; s'il
 * en désignait un autre, l'API répondait 403 — « vous ne pouvez demander un
 * retrait que pour votre propre compte ». Le champ disparaît et se remplit tout
 * seul : c'est la seule valeur que le circuit accepte de lui.
 */
const {
  organizerId: ownOrganizerId,
  canChooseOrganizer,
  isScopedToOwnOrganizer,
} = useCurrentOrganizer()

const currentPage = ref(1)
const search = ref('')
const statusFilter = ref(null)

// Pas de filtre « organisateur » : la recherche porte déjà sur son nom (et sur le
// numéro du demandeur). Un select en doublon aurait surtout obligé à charger la
// liste complète des organisateurs à l'ouverture de la page.
const methodFilter = ref(null)

const isFormDialogOpen = ref(false)
const isProcessDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const processingWithdrawal = ref(null)
const deletingWithdrawal = ref(null)
const isSubmitting = ref(false)
const formErrors = ref({})
const refForm = ref()
const refProcessForm = ref()

const form = reactive({
  organizerId: '',
  requesterPhone: '',
  amount: null,
  paymentMethod: '',
})

const processForm = reactive({
  status: '',
  notes: '',
  payoutReference: '',
})

/** La référence n'est demandée — et exigée — que pour clore un retrait. */
const isMarkingPaid = computed(() => processForm.status === 'paid')

const headers = computed(() => [
  // Le nom de l'organisateur n'a de sens que pour qui en voit plusieurs : sur
  // son propre écran, c'est le sien répété à chaque ligne.
  ...(canChooseOrganizer.value ? [{ title: 'Organisateur', key: 'organizer' }] : []),
  { title: 'Téléphone', key: 'requesterPhone' },
  { title: 'Montant', key: 'amount' },
  { title: 'Méthode', key: 'paymentMethod' },
  { title: 'Statut', key: 'status' },
  { title: 'Demandé le', key: 'createdAt' },
  { title: 'Traité', key: 'processed', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false },
])

const statusOptions = [
  { title: 'En attente', value: 'pending' },
  { title: 'Approuvé', value: 'approved' },
  { title: 'Payé', value: 'paid' },
  { title: 'Rejeté', value: 'rejected' },
]

const paymentMethodOptions = [
  { title: 'Flooz (Moov Money)', value: 'flooz' },
  { title: 'Mix by Yas', value: 'tmoney' },
]

const debouncedSearch = ref('')
let searchTimer = null

watch(search, value => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedSearch.value = value }, 400)
})

const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })
  if (statusFilter.value) params.set('status', statusFilter.value)
  if (methodFilter.value) params.set('payment_method', methodFilter.value)
  if (debouncedSearch.value) params.set('search', debouncedSearch.value)

  return `/withdrawals?${params.toString()}`
})

watch([statusFilter, methodFilter, debouncedSearch], () => { currentPage.value = 1 })

const { data: withdrawalsData, isFetching, execute: fetchWithdrawals } = useApi(apiUrl)

const withdrawals = computed(() => withdrawalsData.value?.data ?? [])
const totalWithdrawals = computed(() => withdrawalsData.value?.meta?.total ?? 0)

/** Totaux par statut, calculés par l'API sur l'ensemble filtré. */
const stats = computed(() => withdrawalsData.value?.stats ?? {})

/**
 * Le libellé français est connu d'avance, et sert de repli.
 *
 * Les cartes retombaient sur la clé de l'API tant qu'elle n'avait pas répondu :
 * l'écran s'ouvrait sur « pending », « paid », « rejected », qui se changeaient
 * en français une seconde plus tard. Le titre d'une carte ne dépend pas des
 * données qu'elle compte — seuls les chiffres les attendent.
 *
 * `statusOptions` reste la source : c'est déjà la liste du filtre juste
 * au-dessus, et deux traductions du même statut finiraient par diverger.
 */
const STATUS_LABELS = Object.fromEntries(statusOptions.map(option => [option.value, option.title]))

const statCards = computed(() => [
  { key: 'pending', icon: 'tabler-clock', color: 'warning' },
  { key: 'approved', icon: 'tabler-circle-check', color: 'info' },
  { key: 'paid', icon: 'tabler-cash', color: 'success' },
  { key: 'rejected', icon: 'tabler-ban', color: 'error' },
].map(card => ({
  ...card,
  label: stats.value[card.key]?.label ?? STATUS_LABELS[card.key] ?? card.key,
  count: stats.value[card.key]?.count ?? 0,
  total: stats.value[card.key]?.total ?? 0,
})))

const onTableOptions = ({ page }) => {
  if (page && page !== currentPage.value) currentPage.value = page
}

// 100 par page : la liste déroulante doit contenir tous les organisateurs, pas
// seulement les 15 de la première page.
const { data: organizersData, execute: fetchOrganizers } = useApi('/organizers?page=1&per_page=100')

const organizers = computed(() => organizersData.value?.data ?? [])

// `Math.round` comme sur le tableau de bord et les rapports : la commission est
// un pourcentage, elle produit des demi-francs qu'aucune caisse ne rend. La
// validation, elle, continue de travailler sur le montant exact.
const formatPrice = value =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(value ?? 0)))} FCFA`

const statusColor = status => ({
  pending: 'warning',
  approved: 'info',
  paid: 'success',
  rejected: 'error',
})[status] ?? 'secondary'

// Les actions suivent ce que le domaine autorise, pas une liste de statuts
// recopiée dans la page.
const canProcess = item => (item.nextStatuses?.length ?? 0) > 0
const canDelete = item => item.status === 'pending' && !item.processedAt

/* ─── Solde de l'organisateur choisi ────────────────────────────────────────── */
const balance = ref(null)
const isBalanceLoading = ref(false)

const loadBalance = async organizerId => {
  balance.value = null
  if (!organizerId) return

  isBalanceLoading.value = true
  try {
    const res = await $api(`/withdrawals/earnings/${organizerId}`)

    balance.value = res?.data ?? null
  } catch {
    // Un solde indisponible ne doit pas bloquer la saisie : l'API refusera de
    // toute façon un montant trop élevé.
    balance.value = null
  } finally {
    isBalanceLoading.value = false
  }
}

watch(() => form.organizerId, id => loadBalance(id))

const available = computed(() => Number(balance.value?.availableBalance ?? 0))

/**
 * Le solde de l'organisateur connecté, chargé avec la page.
 *
 * `loadBalance` ne partait qu'à l'ouverture du formulaire : le montant
 * disponible ne se lisait donc qu'après avoir décidé d'en demander un, alors
 * que c'est précisément le chiffre qu'on vient voir ici.
 *
 * Il se recharge après chaque mouvement — déposer une demande fait passer son
 * montant « en attente », et le solde baisse d'autant.
 */
const refreshOwnBalance = () => {
  if (isScopedToOwnOrganizer.value) void loadBalance(ownOrganizerId.value)
}

refreshOwnBalance()

const exceedsBalance = computed(() =>
  balance.value !== null && Number(form.amount ?? 0) > available.value)

/* ─── Créer ─────────────────────────────────────────────────────────────────── */
const resetForm = () => {
  const organizerId = isScopedToOwnOrganizer.value ? ownOrganizerId.value : ''

  // Le solde n'est oublié que si l'organisateur change. Pour un organisateur le
  // champ revient toujours au sien : le `watch` ne se redéclencherait pas, et le
  // vider ici laisserait la carte du solde vide à la deuxième ouverture.
  if (organizerId !== form.organizerId) balance.value = null

  form.organizerId = organizerId
  form.requesterPhone = ''
  form.amount = null
  form.paymentMethod = ''
  formErrors.value = {}
  refForm.value?.resetValidation()
}

const openCreateDialog = () => {
  resetForm()

  // Inutile de charger la liste pour qui n'a pas le choix : le solde, lui, part
  // tout seul par le `watch` sur `form.organizerId`.
  if (!isScopedToOwnOrganizer.value) fetchOrganizers()
  isFormDialogOpen.value = true
}

const saveWithdrawal = async () => {
  const { valid } = await refForm.value?.validate() ?? { valid: true }
  if (!valid) return

  isSubmitting.value = true
  formErrors.value = {}
  try {
    await $api('/withdrawals', {
      method: 'POST',
      body: {
        'organizer_id': form.organizerId,
        'requester_phone': form.requesterPhone,
        amount: form.amount,
        'payment_method': form.paymentMethod,
      },
    })
    isFormDialogOpen.value = false
    notify('Demande de retrait créée.')
    fetchWithdrawals()
    refreshOwnBalance()
  } catch (error) {
    const data = error?.data ?? error?._data
    if (data?.errors) formErrors.value = data.errors
    else notifyApiError(error, 'Impossible de créer la demande.')
  } finally {
    isSubmitting.value = false
  }
}

/* ─── Traiter ───────────────────────────────────────────────────────────────── */
const openProcessDialog = item => {
  processingWithdrawal.value = item

  // Premier statut atteignable : approuver depuis « en attente », payer depuis
  // « approuvé ». Le rejet reste un choix explicite.
  processForm.status = item.nextStatuses?.[0]?.value ?? ''
  processForm.notes = item.notes ?? ''
  processForm.payoutReference = item.payoutReference ?? ''
  refProcessForm.value?.resetValidation()
  isProcessDialogOpen.value = true
}

const confirmProcess = async () => {
  const { valid } = await refProcessForm.value?.validate() ?? { valid: true }
  if (!valid) return

  isSubmitting.value = true
  try {
    await $api(`/withdrawals/${processingWithdrawal.value.id}/process`, {
      method: 'POST',
      body: {
        status: processForm.status,
        notes: processForm.notes || null,
        'payout_reference': isMarkingPaid.value ? processForm.payoutReference : null,
      },
    })
    isProcessDialogOpen.value = false
    notify('Retrait traité.')
    fetchWithdrawals()
    refreshOwnBalance()
  } catch (error) {
    notifyApiError(error, 'Impossible de traiter la demande.')
  } finally {
    isSubmitting.value = false
  }
}

/* ─── Supprimer ─────────────────────────────────────────────────────────────── */
const openDeleteDialog = item => {
  deletingWithdrawal.value = item
  isDeleteDialogOpen.value = true
}

const confirmDelete = async () => {
  isSubmitting.value = true
  try {
    await $api(`/withdrawals/${deletingWithdrawal.value.id}`, { method: 'DELETE' })
    isDeleteDialogOpen.value = false
    notify('Demande supprimée.')
    fetchWithdrawals()
    refreshOwnBalance()
  } catch (error) {
    notifyApiError(error, 'Impossible de supprimer la demande.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <!--
      ─── Solde disponible ───────────────────────────────────────────────────

      En tête, et à part des totaux par statut : ceux-là disent ce qui a déjà été
      demandé, celui-ci ce qu'il reste à demander. C'est le chiffre pour lequel
      on ouvre cet écran, et il ne se lisait que dans le formulaire — donc après
      avoir décidé d'un montant.
    -->
    <VCard
      v-if="isScopedToOwnOrganizer"
      class="mb-6"
    >
      <VCardText class="d-flex align-center gap-4">
        <VAvatar
          color="primary"
          variant="tonal"
          rounded
          size="42"
        >
          <VIcon icon="tabler-wallet" />
        </VAvatar>

        <div>
          <div class="text-body-2 text-medium-emphasis">
            Solde disponible
          </div>
          <div class="text-h5">
            {{ balance ? formatPrice(available) : (isBalanceLoading ? '…' : '—') }}
          </div>
          <div
            v-if="balance"
            class="text-caption text-medium-emphasis"
          >
            Revenu net {{ formatPrice(balance.netRevenue) }} ·
            déjà retiré {{ formatPrice(balance.totalWithdrawn) }} ·
            en attente {{ formatPrice(balance.pendingWithdrawn) }}
          </div>
        </div>
      </VCardText>
    </VCard>

    <!-- ─── Totaux par statut ────────────────────────────────────────────────── -->
    <VRow class="mb-2">
      <VCol
        v-for="card in statCards"
        :key="card.key"
        cols="12"
        sm="6"
        md="3"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-4">
            <VAvatar
              :color="card.color"
              variant="tonal"
              rounded
              size="42"
            >
              <VIcon :icon="card.icon" />
            </VAvatar>
            <div>
              <div class="text-body-2 text-medium-emphasis">
                {{ card.label }}
              </div>
              <div class="text-h6">
                {{ card.count }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ formatPrice(card.total) }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <!--
          « Gestion des retraits » est le titre de qui les traite ; celui qui les
          demande est sur son propre relevé.
        -->
        <span class="text-h6">
          {{ canChooseOrganizer ? 'Gestion des Retraits' : 'Mes retraits' }}
        </span>
        <VBtn
          color="primary"
          prepend-icon="tabler-plus"
          @click="openCreateDialog"
        >
          {{ canChooseOrganizer ? 'Ajouter une demande' : 'Demander un retrait' }}
        </VBtn>
      </VCardTitle>

      <VDivider />

      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="6"
          >
            <VTextField
              v-model="search"
              label="Rechercher"
              placeholder="Organisateur ou numéro du demandeur…"
              prepend-inner-icon="tabler-search"
              density="compact"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <VSelect
              v-model="statusFilter"
              :items="statusOptions"
              item-title="title"
              item-value="value"
              label="Statut"
              placeholder="Tous"
              density="compact"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <VSelect
              v-model="methodFilter"
              :items="paymentMethodOptions"
              item-title="title"
              item-value="value"
              label="Méthode"
              placeholder="Toutes"
              density="compact"
              clearable
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="withdrawals"
        :items-length="totalWithdrawals"
        :items-per-page="15"
        :page="currentPage"
        :loading="isFetching"
        no-data-text="Aucune demande de retrait"
        class="text-no-wrap"
        @update:options="onTableOptions"
      >
        <!-- Organisateur -->
        <template #item.organizer="{ item }">
          <span class="font-weight-medium">{{ item.organizer?.companyName ?? '-' }}</span>
        </template>

        <!-- Telephone -->
        <template #item.requesterPhone="{ item }">
          {{ item.requesterPhone ?? '-' }}
        </template>

        <!-- Montant : puce à la couleur du statut, comme sur les paiements. -->
        <template #item.amount="{ item }">
          <VChip
            :color="statusColor(item.status)"
            size="small"
            variant="tonal"
            class="font-weight-medium"
          >
            {{ formatPrice(item.amount) }}
          </VChip>
        </template>

        <!-- Méthode : le libellé, pas « flooz » en minuscules. -->
        <template #item.paymentMethod="{ item }">
          {{ item.paymentMethodLabel ?? item.paymentMethod ?? '-' }}
        </template>

        <!-- Statut -->
        <template #item.status="{ item }">
          <VChip
            :color="statusColor(item.status)"
            size="small"
            variant="tonal"
          >
            {{ item.statusLabel ?? item.status }}
          </VChip>
        </template>

        <!-- Demandé le -->
        <template #item.createdAt="{ item }">
          {{ formatDateFr(item.createdAt) }}
        </template>

        <!-- Traité : par qui, quand, et le motif s'il y en a un. -->
        <template #item.processed="{ item }">
          <template v-if="item.processedAt">
            <div class="text-body-2">
              {{ item.processedBy ?? 'Administration' }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ formatDateFr(item.processedAt) }}
            </div>
            <div
              v-if="item.payoutReference"
              class="text-caption text-medium-emphasis"
              style="font-family: monospace"
            >
              {{ item.payoutReference }}
            </div>
            <VTooltip
              v-if="item.notes"
              :text="item.notes"
              location="top"
            >
              <template #activator="{ props }">
                <VIcon
                  v-bind="props"
                  icon="tabler-message-2"
                  size="16"
                  class="text-medium-emphasis"
                />
              </template>
            </VTooltip>
          </template>
          <span
            v-else
            class="text-medium-emphasis"
          >—</span>
        </template>

        <!-- Actions -->
        <template #item.actions="{ item }">
          <VTooltip
            v-if="canProcess(item)"
            text="Traiter"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="info"
                @click="openProcessDialog(item)"
              >
                <VIcon icon="tabler-checkbox" />
              </VBtn>
            </template>
          </VTooltip>

          <VTooltip
            v-if="canDelete(item)"
            text="Supprimer"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="error"
                @click="openDeleteDialog(item)"
              >
                <VIcon icon="tabler-trash" />
              </VBtn>
            </template>
          </VTooltip>

          <span
            v-if="!canProcess(item) && !canDelete(item)"
            class="text-medium-emphasis"
          >—</span>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- ─── Dialog Créer ─────────────────────────────────────────────────────── -->
    <VDialog
      v-model="isFormDialogOpen"
      max-width="640"
      scrollable
    >
      <VCard title="Ajouter une demande de retrait">
        <VCardText class="pt-4">
          <VForm ref="refForm">
            <VRow>
              <VCol
                v-if="!isScopedToOwnOrganizer"
                cols="12"
              >
                <VSelect
                  v-model="form.organizerId"
                  :items="organizers"
                  item-title="companyName"
                  item-value="id"
                  label="Organisateur"
                  :rules="[requiredField('Organisateur')]"
                  :error-messages="formErrors.organizer_id"
                />
              </VCol>

              <!-- Le solde, avant de saisir un montant. -->
              <VCol
                v-if="form.organizerId"
                cols="12"
              >
                <VAlert
                  v-if="isBalanceLoading"
                  type="info"
                  variant="tonal"
                  density="compact"
                >
                  Calcul du solde…
                </VAlert>
                <VAlert
                  v-else-if="balance"
                  :type="available > 0 ? 'success' : 'warning'"
                  variant="tonal"
                  density="compact"
                >
                  <div class="font-weight-medium">
                    Solde disponible : {{ formatPrice(available) }}
                  </div>
                  <div class="text-caption">
                    Revenu net {{ formatPrice(balance.netRevenue) }} ·
                    déjà retiré {{ formatPrice(balance.totalWithdrawn) }} ·
                    en attente {{ formatPrice(balance.pendingWithdrawn) }}
                  </div>
                </VAlert>
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.requesterPhone"
                  type="tel"
                  label="Numéro du demandeur"
                  placeholder="+22890112233"
                  :rules="[requiredField('Numéro du demandeur')]"
                  :error-messages="formErrors.requester_phone"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model.number="form.amount"
                  type="number"
                  min="1"
                  :max="balance ? available : undefined"
                  label="Montant (FCFA)"
                  :hint="balance ? `Maximum ${formatPrice(available)}` : ''"
                  persistent-hint
                  :rules="[
                    requiredField('Montant (FCFA)'),
                    v => (v > 0) || 'Le montant doit être au moins 1.',
                    () => !exceedsBalance || `Le solde disponible est de ${formatPrice(available)}.`,
                  ]"
                  :error-messages="formErrors.amount"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="form.paymentMethod"
                  :items="paymentMethodOptions"
                  item-title="title"
                  item-value="value"
                  label="Méthode de paiement"
                  placeholder="Choisir Flooz ou Mix by Yas"
                  :rules="[requiredField('Méthode de paiement')]"
                  :error-messages="formErrors.payment_method"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isFormDialogOpen = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="primary"
            :loading="isSubmitting"
            :disabled="exceedsBalance"
            @click="saveWithdrawal"
          >
            Créer la demande
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Traiter ──────────────────────────────────────────────────── -->
    <VDialog
      v-model="isProcessDialogOpen"
      max-width="480"
    >
      <VCard title="Traiter la demande de retrait">
        <VCardText class="pt-4">
          <!-- La destination du virement, en évidence : c'est ce numéro que
               l'organisateur a renseigné, et c'est sur lui que l'argent doit
               partir. Le lire au moment de décider évite de payer le bon montant
               au mauvais compte. -->
          <VAlert
            type="info"
            variant="tonal"
            density="compact"
            class="mb-4"
          >
            <div class="font-weight-medium">
              {{ formatPrice(processingWithdrawal?.amount) }}
              → {{ processingWithdrawal?.requesterPhone }}
            </div>
            <div class="text-caption">
              {{ processingWithdrawal?.paymentMethodLabel }} ·
              {{ processingWithdrawal?.organizer?.companyName }}
            </div>
          </VAlert>

          <VForm ref="refProcessForm">
            <!-- Uniquement les statuts atteignables depuis l'état courant. -->
            <VSelect
              v-model="processForm.status"
              :items="processingWithdrawal?.nextStatuses ?? []"
              item-title="label"
              item-value="value"
              label="Nouveau statut"
              :rules="[requiredField('Nouveau statut')]"
            />

            <VTextField
              v-if="isMarkingPaid"
              v-model="processForm.payoutReference"
              label="Référence du transfert"
              placeholder="Identifiant rendu par Flooz / Mix by Yas"
              class="mt-4"
              :rules="[requiredField('Référence du transfert')]"
              persistent-hint
              hint="Preuve du virement : à présenter si l'organisateur dit n'avoir rien reçu."
            />

            <VTextarea
              v-model="processForm.notes"
              label="Motif ou remarque"
              placeholder="Raison du refus, précision interne…"
              rows="2"
              class="mt-4"
              persistent-hint
              hint="Conservé avec la demande, et lisible par l'organisateur."
            />
          </VForm>
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isProcessDialogOpen = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="primary"
            :loading="isSubmitting"
            @click="confirmProcess"
          >
            Valider
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Suppression ───────────────────────────────────────────────── -->
    <VDialog
      v-model="isDeleteDialogOpen"
      max-width="400"
    >
      <VCard title="Supprimer la demande de retrait">
        <VCardText class="pt-4">
          <p class="text-body-2">
            Êtes-vous sûr de vouloir supprimer la demande de
            <strong>{{ deletingWithdrawal?.organizer?.companyName }}</strong>
            ({{ formatPrice(deletingWithdrawal?.amount) }}) ?
            Cette action est irréversible.
          </p>
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isDeleteDialogOpen = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="error"
            :loading="isSubmitting"
            @click="confirmDelete"
          >
            Supprimer
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
