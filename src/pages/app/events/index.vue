<script setup>
import { notify, notifyApiError } from '@/utils/toast'
import { useCurrentOrganizer } from '@/composables/useCurrentOrganizer'

/*
 * Les clés du formulaire recopient volontairement celles de l'API, en
 * snake_case : le payload part tel quel, et traduire dans les deux sens
 * ajouterait une table de correspondance à tenir à jour pour rien.
 */
/* eslint-disable camelcase */

import { formatDateFr } from '@/utils/dateFormat'

definePage({
  meta: {
    action: 'read',
    subject: 'events',
  },
})

import { $api, toMediaUrl } from '@/utils/api'

const router = useRouter()

const currentPage = ref(1)
const statusFilter = ref(null)
const categoryFilter = ref(null)
const organizerFilter = ref(null)

const isFormDialogOpen = ref(false)
const isCancelDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)

const editingEvent = ref(null)
const cancellingEvent = ref(null)
const deletingEvent = ref(null)

const isSubmitting = ref(false)
const formRef = ref()
const formErrors = ref({})

const bannerFile = ref(null)
const bannerPreview = ref(null)
const bannerInputRef = ref(null)
const slugEdited = ref(false)

const form = reactive({
  organizer_id: '',
  category_id: '',
  venue_id: null,
  title: '',
  slug: '',
  description: '',
  start_date: '',
  end_date: '',
  max_attendees: '',
  status: 'draft',
  event_type: 'physical',
  online_url: '',
  refund_allowed: true,
  refund_days_before: 0,

  // Vides = « hérite des réglages de la plateforme ». Voir CHECKIN_KEYS plus bas
  // pour la raison pour laquelle ces deux-là sont transmis même vides.
  checkin_open_hours_before: '',
  checkin_close_hours_after: '',
})

const eventTypeOptions = [
  { title: 'Physique', value: 'physical' },
  { title: 'En ligne', value: 'online' },
]

const headers = [
  { title: 'Événement', key: 'event' },
  { title: 'Catégorie', key: 'category', sortable: false },
  { title: 'Statut', key: 'status' },
  { title: 'Dates', key: 'dates', sortable: false },

  // Ce n'est ni le nombre de billets vendus ni le stock : c'est le nombre de
  // tarifs de l'événement (VIP, Standard, Étudiant…). Le libellé le dit, sinon
  // « 3 » se lit comme trois billets. Les ventes sont dans l'onglet Statistiques
  // de l'événement, et dans Billets vendus.
  { title: 'Types de billets', key: 'tickets' },
  { title: 'Actions', key: 'actions', sortable: false },
]

/**
 * Le filtre voit les quatre statuts — c'est par lui qu'on obtient la liste des
 * événements annulés ou terminés.
 */
const statusOptions = [
  { title: 'Brouillon', value: 'draft' },
  { title: 'Publié', value: 'published' },
  { title: 'Annulé', value: 'cancelled' },
  { title: 'Terminé', value: 'finished' },
]

/**
 * Le formulaire, lui, n'en propose que deux.
 *
 * « Annulé » s'obtient par l'action Annuler, qui prévient les acheteurs et libère
 * le stock — le choisir dans une liste déroulante changerait le statut sans rien
 * de tout cela. « Terminé » est une conséquence du calendrier, pas une décision :
 * un événement se termine parce que sa date de fin est passée.
 */
const STATUS_FORM_BASE = [
  { title: 'Brouillon', value: 'draft' },
  { title: 'Publié', value: 'published' },
]

/**
 * Les deux statuts modifiables, plus celui de l'événement en cours d'édition
 * s'il n'en fait pas partie.
 *
 * Sans cet ajout, ouvrir un événement annulé affichait « cancelled » brut : le
 * select n'a pas d'option correspondante et retombe sur la valeur. L'option est
 * désactivée — on la lit, on n'y revient pas.
 */
const statusFormOptions = computed(() => {
  const current = form.status

  if (!current || STATUS_FORM_BASE.some(option => option.value === current)) {
    return STATUS_FORM_BASE
  }

  return [
    ...STATUS_FORM_BASE,
    {
      title: statusOptions.find(option => option.value === current)?.title ?? current,
      value: current,
      props: { disabled: true },
    },
  ]
})

// ─── Visionneuse d'affiche ───────────────────────────────────────────────────
const lightbox = reactive({ open: false, src: null, title: null })

/**
 * Ouvre l'image en grand. On passe la version pleine taille, jamais la vignette :
 * agrandir un 40 px donnerait une bouillie de pixels.
 */
const showImage = (src, title) => {
  if (!src) return

  lightbox.src = toMediaUrl(src)
  lightbox.title = title
  lightbox.open = true
}

/** Onglets de statut au-dessus du tableau, pour atteindre chaque liste d'un clic. */
const statusTabs = [
  { title: 'Tous', value: null, icon: 'tabler-list' },
  { title: 'Brouillons', value: 'draft', icon: 'tabler-pencil' },
  { title: 'Publiés', value: 'published', icon: 'tabler-broadcast' },
  { title: 'Annulés', value: 'cancelled', icon: 'tabler-calendar-x' },
  { title: 'Terminés', value: 'finished', icon: 'tabler-flag-check' },
]

// ─── Dropdown data ─────────────────────────────────────────────────────────
const { data: organizersData } = useApi('/organizers')
const organizerOptions = computed(() => organizersData.value?.data ?? [])

const { data: categoriesData } = useApi('/categories')
const categoryOptions = computed(() => categoriesData.value?.data ?? [])

const { data: venuesData } = useApi('/venues')
const venueOptions = computed(() => venuesData.value?.data ?? [])

// ─── List fetch (reactive URL — server pagination + filters) ────────────────
const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(currentPage.value) })
  if (statusFilter.value) params.set('status', statusFilter.value)
  if (categoryFilter.value) params.set('category_id', categoryFilter.value)
  if (organizerFilter.value) params.set('organizer_id', organizerFilter.value)

  return `/events?${params.toString()}`
})

watch([statusFilter, categoryFilter, organizerFilter], () => { currentPage.value = 1 })

const { data: eventsData, isFetching, execute: fetchEvents } = useApi(apiUrl)

// Live refresh when an event is created / updated elsewhere.
useRealtimeRefresh('events', () => fetchEvents())

const events = computed(() => eventsData.value?.data ?? [])
const totalEvents = computed(() => eventsData.value?.meta?.total ?? 0)

const onTableOptions = ({ page }) => {
  if (page && page !== currentPage.value) currentPage.value = page
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const statusColor = status => ({
  draft: 'secondary',
  published: 'success',
  cancelled: 'error',
  finished: 'info',
})[status] ?? 'secondary'

const slugify = str => (str ?? '')
  .toString()
  .toLowerCase()
  .trim()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toDatetimeLocal = d => (d?.datetime ? d.datetime.replace(' ', 'T').slice(0, 16) : '')

watch(() => form.title, val => {
  if (editingEvent.value || slugEdited.value) return
  form.slug = slugify(val)
})

// ─── Compte connecté ───────────────────────────────────────────────────────
/**
 * Un organisateur connecté crée ses propres événements : lui parler de
 * « l'organisateur » à la troisième personne le ferait chercher qui c'est, et
 * lui faire choisir dans une liste ce qu'il est déjà n'a pas de sens.
 */
const {
  isOrganizerUser,
  organizer: currentOrganizer,
  canChooseOrganizer,
  isScopedToOwnOrganizer: hideOrganizerSelect,
} = useCurrentOrganizer()

// ─── Form lifecycle ────────────────────────────────────────────────────────
const resetForm = () => {
  // Pré-rempli pour un organisateur : le champ ne lui est pas montré, mais
  // l'API l'exige.
  form.organizer_id = hideOrganizerSelect.value ? currentOrganizer.value.id : ''
  form.category_id = ''
  form.venue_id = null
  form.title = ''
  form.slug = ''
  form.description = ''
  form.start_date = ''
  form.end_date = ''
  form.max_attendees = ''
  form.status = 'draft'
  form.event_type = 'physical'
  form.online_url = ''
  form.refund_allowed = true
  form.refund_days_before = 0
  form.checkin_open_hours_before = ''
  form.checkin_close_hours_after = ''
  bannerFile.value = null
  bannerPreview.value = null
  slugEdited.value = false
  formErrors.value = {}
  editingEvent.value = null
  formRef.value?.resetValidation?.()
}

// Même plafond que la règle `image|max:2048` du backend, mais vérifié ici pour
// que l'utilisateur sache tout de suite pourquoi son affiche est refusée —
// avant, un dépassement partait jusqu'à l'API et revenait en 422 muet, la
// modification « ne passait pas » sans un mot d'explication.
const MAX_BANNER_BYTES = 2 * 1024 * 1024

const onBannerSelected = event => {
  const file = event.target.files[0]

  // Réinitialise l'input pour pouvoir re-sélectionner le même fichier après
  // une erreur (sinon `change` ne se redéclenche pas sur un choix identique).
  event.target.value = ''
  if (!file) return

  if (!file.type.startsWith('image/')) {
    formErrors.value = { ...formErrors.value, banner: ['Le fichier doit être une image (JPG ou PNG).'] }

    return
  }

  if (file.size > MAX_BANNER_BYTES) {
    formErrors.value = { ...formErrors.value, banner: ['L’image ne doit pas dépasser 2 Mo.'] }

    return
  }

  formErrors.value = { ...formErrors.value, banner: undefined }
  bannerFile.value = file
  bannerPreview.value = URL.createObjectURL(file)
}

const resetBanner = () => {
  bannerFile.value = null
  bannerPreview.value = null
}

const openCreateDialog = () => {
  resetForm()
  isFormDialogOpen.value = true
}

const openEditDialog = event => {
  resetForm()
  editingEvent.value = event
  form.organizer_id = event.organizerId ?? ''
  form.category_id = event.categoryId ?? ''
  form.venue_id = event.venueId ?? null
  form.title = event.title ?? ''
  form.slug = event.slug ?? ''
  form.description = event.description ?? ''
  form.start_date = toDatetimeLocal(event.startDate)
  form.end_date = toDatetimeLocal(event.endDate)
  form.max_attendees = event.maxAttendees ?? ''
  form.status = event.status ?? 'draft'
  form.event_type = event.eventType ?? 'physical'
  form.online_url = event.onlineUrl ?? ''
  form.refund_allowed = event.refundAllowed ?? true
  form.refund_days_before = event.refundDaysBefore ?? 0

  // `?? ''` et non `?? 0` : null veut dire « hérite », zéro voudrait dire « le
  // portique n'ouvre pas une minute avant l'heure ».
  form.checkin_open_hours_before = event.checkinOpenHoursBefore ?? ''
  form.checkin_close_hours_after = event.checkinCloseHoursAfter ?? ''
  bannerFile.value = null
  bannerPreview.value = toMediaUrl(event.bannerThumbnail || event.banner) ?? null
  slugEdited.value = true
  isFormDialogOpen.value = true
}

const openCancelDialog = event => {
  cancellingEvent.value = event
  isCancelDialogOpen.value = true
}

const openDeleteDialog = event => {
  deletingEvent.value = event
  isDeleteDialogOpen.value = true
}

/**
 * Valeur d'usine des marges de contrôle d'accès, en heures.
 *
 * Recopiée de `config/ticketexpress.php` côté serveur, uniquement pour dire à
 * quoi un champ vide va retomber. C'est le serveur qui tranche.
 */
const FACTORY_CHECKIN_HOURS = 4

const selectedOrganizer = computed(() =>
  organizerOptions.value.find(o => o.id === form.organizer_id)
  ?? (currentOrganizer.value?.id === form.organizer_id ? currentOrganizer.value : null))

/**
 * Ce dont l'événement hérite quand le champ reste vide : la façon de faire de
 * l'organisateur, ou la valeur d'usine s'il n'a rien réglé. Montrer le nombre
 * plutôt que « suit le réglage » évite d'aller le chercher ailleurs.
 */
const inheritedHours = key =>
  selectedOrganizer.value?.[key] ?? FACTORY_CHECKIN_HOURS

const inheritedHint = (key, side) => isOrganizerUser.value
  ? `Vos réglages : ${inheritedHours(key)} h ${side}`
  : `Réglages de l'organisateur : ${inheritedHours(key)} h ${side}`

const inheritedOpenHint = computed(() => inheritedHint('checkinOpenHoursBefore', 'avant'))
const inheritedCloseHint = computed(() => inheritedHint('checkinCloseHoursAfter', 'après'))

/**
 * Ce que donnent les marges saisies, en horaires.
 *
 * Un organisateur pense « les portes ouvrent à 18 h », pas « quatre heures
 * avant ». On stocke la marge — elle suit l'événement si on en décale la date,
 * là où un horaire absolu se désynchronise en silence — mais on lui montre
 * l'heure pendant qu'il saisit.
 */
const gateTime = (dateField, hours, direction) => {
  if (hours === '' || hours === null || !form[dateField]) return null

  const base = new Date(form[dateField])

  if (Number.isNaN(base.getTime())) return null

  base.setMinutes(base.getMinutes() + direction * Math.round(Number(hours) * 60))

  return base.toLocaleString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const gateOpensAt = computed(() => gateTime('start_date', form.checkin_open_hours_before, -1))
const gateClosesAt = computed(() => gateTime('end_date', form.checkin_close_hours_after, 1))

// ─── Payload builders ──────────────────────────────────────────────────────
const meaningfulEntries = () =>
  Object.entries(form).filter(([, v]) => v !== '' && v !== null && v !== undefined)

/**
 * Champs qu'il faut transmettre même vides.
 *
 * `meaningfulEntries` élague les valeurs vides, ce qui convient à la création.
 * Mais à la modification, une clé absente laisse la valeur en base intacte :
 * l'organisateur ne pourrait jamais *retirer* une surcharge une fois posée. Ces
 * deux-là partent donc toujours, à vide quand le champ l'est — l'API le lit
 * comme null, c'est-à-dire « hérite de la plateforme ».
 */
const CHECKIN_KEYS = ['checkin_open_hours_before', 'checkin_close_hours_after']

const buildPayload = () => ({
  ...Object.fromEntries(meaningfulEntries()),
  ...Object.fromEntries(CHECKIN_KEYS.map(key => [key, form[key] === '' ? null : Number(form[key])])),
})

const buildFormData = () => {
  const fd = new FormData()

  meaningfulEntries().forEach(([key, val]) => {
    // Un booléen ne se transporte pas tel quel en multipart : `String(true)`
    // donne « true », que la règle `boolean` de Laravel refuse — elle n'accepte
    // que 1/0. Sans ce cas, toute édition AVEC image partait avec
    // `refund_allowed=true` et échouait en 422. En JSON (sans image), la valeur
    // reste un vrai booléen et le problème ne se posait pas.
    fd.append(key, typeof val === 'boolean' ? (val ? '1' : '0') : String(val))
  })

  // Une chaîne vide, faute de pouvoir transporter null en multipart. Le
  // middleware ConvertEmptyStringsToNull de Laravel la retraduit en null.
  CHECKIN_KEYS.forEach(key => { if (!fd.has(key)) fd.append(key, '') })

  if (bannerFile.value) fd.append('banner', bannerFile.value)

  return fd
}

// ─── Mutations ─────────────────────────────────────────────────────────────
const saveEvent = async () => {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  isSubmitting.value = true
  formErrors.value = {}
  try {
    if (editingEvent.value) {
      if (bannerFile.value) {
        const fd = buildFormData()

        fd.append('_method', 'PUT')
        await $api(`/events/${editingEvent.value.id}`, { method: 'POST', body: fd })
      } else {
        await $api(`/events/${editingEvent.value.id}`, { method: 'PUT', body: buildPayload() })
      }
    } else if (bannerFile.value) {
      await $api('/events', { method: 'POST', body: buildFormData() })
    } else {
      await $api('/events', { method: 'POST', body: buildPayload() })
    }
    isFormDialogOpen.value = false
    notify(editingEvent.value ? 'Événement mis à jour.' : 'Événement créé.')
    fetchEvents()
  } catch (err) {
    const errors = err?.data?.errors ?? err?._data?.errors

    formErrors.value = errors ?? {}
    if (!errors) notifyApiError(err, "Impossible d'enregistrer l'événement.")
  } finally {
    isSubmitting.value = false
  }
}

const togglePublish = async event => {
  const action = event.status === 'published' ? 'unpublish' : 'publish'

  isSubmitting.value = true
  try {
    await $api(`/events/${event.id}/${action}`, { method: 'POST' })
    notify(action === 'publish' ? 'Événement publié.' : 'Événement dépublié.')
    fetchEvents()
  } catch (error) {
    notifyApiError(error, "Impossible de changer l'état de l'événement.")
  } finally {
    isSubmitting.value = false
  }
}

const confirmCancel = async () => {
  isSubmitting.value = true
  try {
    await $api(`/events/${cancellingEvent.value.id}/cancel`, { method: 'POST' })
    isCancelDialogOpen.value = false
    notify('Événement annulé.', 'warning')
    fetchEvents()
  } catch (error) {
    notifyApiError(error, "Impossible d'annuler l'événement.")
  } finally {
    isSubmitting.value = false
  }
}

const confirmDelete = async () => {
  isSubmitting.value = true
  try {
    await $api(`/events/${deletingEvent.value.id}`, { method: 'DELETE' })
    isDeleteDialogOpen.value = false
    notify('Événement supprimé.')
    fetchEvents()
  } catch (error) {
    notifyApiError(error, "Impossible de supprimer l'événement.")
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">Gestion des Événements</span>
        <VBtn
          v-if="$can('create', 'events')"
          color="primary"
          prepend-icon="tabler-plus"
          @click="openCreateDialog"
        >
          Ajouter un événement
        </VBtn>
      </VCardTitle>

      <VDivider />

      <!--
        Les listes par statut, dont « Annulés », à un clic. Elles pilotent le
        même filtre que le select en dessous : une seule source de vérité. 
      -->
      <div class="px-4 pt-3 d-flex flex-wrap gap-2">
        <VChip
          v-for="tab in statusTabs"
          :key="tab.title"
          :color="statusFilter === tab.value ? 'primary' : undefined"
          :variant="statusFilter === tab.value ? 'flat' : 'tonal'"
          size="small"
          :prepend-icon="tab.icon"
          @click="statusFilter = tab.value"
        >
          {{ tab.title }}
        </VChip>
      </div>

      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="4"
          >
            <VSelect
              v-model="statusFilter"
              :items="statusOptions"
              item-title="title"
              item-value="value"
              label="Statut"
              placeholder="Tous les statuts"
              density="compact"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            md="4"
          >
            <VSelect
              v-model="categoryFilter"
              :items="categoryOptions"
              item-title="name"
              item-value="id"
              label="Catégorie"
              placeholder="Toutes les catégories"
              density="compact"
              clearable
            />
          </VCol>
          <!--
            Filtrer par organisateur n'a de sens que pour qui en administre
            plusieurs. La liste restait offerte à l'organisateur connecté, qui
            pouvait y désigner un confrère : l'API le ramenait à ses propres
            événements, et le filtre passait pour cassé.
          -->
          <VCol
            v-if="canChooseOrganizer"
            cols="12"
            md="4"
          >
            <VSelect
              v-model="organizerFilter"
              :items="organizerOptions"
              item-title="companyName"
              item-value="id"
              label="Organisateur"
              placeholder="Tous les organisateurs"
              density="compact"
              clearable
            />
          </VCol>
        </VRow>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="events"
        :items-length="totalEvents"
        :items-per-page="15"
        :page="currentPage"
        :loading="isFetching"
        no-data-text="Aucun événement"
        class="text-no-wrap"
        @update:options="onTableOptions"
      >
        <!-- Événement -->
        <template #item.event="{ item }">
          <div class="d-flex align-center gap-3">
            <VAvatar
              rounded
              size="40"
              color="primary"
              variant="tonal"
              :class="{ 'cursor-pointer': item.banner || item.bannerThumbnail }"
              @click="showImage(item.banner || item.bannerThumbnail, item.title)"
            >
              <VImg
                v-if="item.bannerThumbnail || item.banner"
                :src="toMediaUrl(item.bannerThumbnail || item.banner)"
                cover
              />
              <VIcon
                v-else
                icon="tabler-calendar-event"
              />
            </VAvatar>
            <div>
              <div class="font-weight-medium">
                {{ item.title ?? '-' }}
              </div>
              <div class="text-caption text-medium-emphasis d-flex align-center gap-1">
                <VChip
                  size="x-small"
                  :color="item.eventType === 'online' ? 'info' : 'secondary'"
                  variant="tonal"
                  :prepend-icon="item.eventType === 'online' ? 'tabler-broadcast' : 'tabler-map-pin'"
                >
                  {{ item.eventTypeLabel ?? 'Physique' }}
                </VChip>
              </div>
            </div>
          </div>
        </template>

        <!-- Catégorie -->
        <template #item.category="{ item }">
          <span v-if="item.category?.name">
            {{ item.category.name }}
          </span>
          <span
            v-else
            class="text-medium-emphasis"
          >-</span>
        </template>

        <!-- Statut -->
        <template #item.status="{ item }">
          <span
            :class="{
              'text-secondary': statusColor(item.status) === 'secondary',
              'text-success': statusColor(item.status) === 'success',
              'text-error': statusColor(item.status) === 'error',
              'text-info': statusColor(item.status) === 'info'
            }"
          >
            {{ item.statusLabel ?? item.status }}
          </span>
        </template>

        <!-- Dates -->
        <template #item.dates="{ item }">
          <div class="text-body-2">
            {{ formatDateFr(item.startDate) }}
          </div>
          <div class="text-caption text-medium-emphasis">
            → {{ formatDateFr(item.endDate) }}
          </div>
        </template>

        <!-- Billets -->
        <template #item.tickets="{ item }">
          {{ item.ticketTypesCount ?? 0 }}
        </template>

        <!-- Actions -->
        <template #item.actions="{ item }">
          <VTooltip
            text="Gérer"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="default"
                @click="router.push(`/events/${item.id}`)"
              >
                <VIcon icon="tabler-settings" />
              </VBtn>
            </template>
          </VTooltip>

          <VTooltip
            text="Gérer la billetterie"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="primary"
                @click="router.push(`/events/${item.id}?tab=ticket-types`)"
              >
                <VIcon icon="tabler-ticket" />
              </VBtn>
            </template>
          </VTooltip>

          <VTooltip
            v-if="item.status === 'draft'"
            text="Publier"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="success"
                @click="togglePublish(item)"
              >
                <VIcon icon="tabler-upload" />
              </VBtn>
            </template>
          </VTooltip>

          <VTooltip
            v-else-if="item.status === 'published'"
            text="Dépublier"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="warning"
                @click="togglePublish(item)"
              >
                <VIcon icon="tabler-download" />
              </VBtn>
            </template>
          </VTooltip>

          <VTooltip
            v-if="item.status !== 'cancelled'"
            text="Annuler"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="error"
                @click="openCancelDialog(item)"
              >
                <VIcon icon="tabler-ban" />
              </VBtn>
            </template>
          </VTooltip>

          <VTooltip
            v-if="$can('update', 'events')"
            text="Modifier"
            location="top"
          >
            <template #activator="{ props }">
              <VBtn
                v-bind="props"
                icon
                variant="text"
                size="small"
                color="primary"
                @click="openEditDialog(item)"
              >
                <VIcon icon="tabler-edit" />
              </VBtn>
            </template>
          </VTooltip>

          <VTooltip
            v-if="$can('delete', 'events')"
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
        </template>
      </VDataTableServer>
    </VCard>

    <!-- ─── Dialog Créer / Modifier ─────────────────────────────────────────── -->
    <VDialog
      v-model="isFormDialogOpen"
      max-width="640"
      scrollable
    >
      <VCard :title="editingEvent ? 'Modifier l\'événement' : 'Ajouter un événement'">
        <VCardText class="pt-4">
          <VForm
            ref="formRef"
            @submit.prevent="saveEvent"
          >
            <VRow>
              <!-- Bannière -->
              <VCol
                cols="12"
                class="d-flex align-center gap-6"
              >
                <!--
                  La vignette de 88 px ne permet pas de vérifier une affiche :
                  un clic l'ouvre en grand, avant comme après import. 
                -->
                <VAvatar
                  rounded
                  size="88"
                  color="primary"
                  variant="tonal"
                  :class="{ 'cursor-pointer': bannerPreview }"
                  @click="bannerPreview && showImage(bannerPreview, form.title || 'Bannière')"
                >
                  <VImg
                    v-if="bannerPreview"
                    :src="bannerPreview"
                    cover
                  />
                  <VIcon
                    v-else
                    icon="tabler-photo"
                    size="40"
                  />
                </VAvatar>

                <div class="d-flex flex-column gap-3">
                  <div class="d-flex flex-wrap gap-3">
                    <VBtn
                      size="small"
                      prepend-icon="tabler-cloud-upload"
                      @click="bannerInputRef?.click()"
                    >
                      Importer une bannière
                    </VBtn>
                    <VBtn
                      v-if="bannerPreview"
                      size="small"
                      color="secondary"
                      variant="tonal"
                      prepend-icon="tabler-refresh"
                      @click="resetBanner"
                    >
                      Réinitialiser
                    </VBtn>
                  </div>
                  <p class="text-body-2 text-medium-emphasis mb-0">
                    JPG ou PNG · Max 2 Mo
                  </p>

                  <!-- Erreur de bannière (taille/type côté client, ou 422 de l'API). -->
                  <p
                    v-if="formErrors.banner"
                    class="text-error text-body-2 mb-0"
                  >
                    {{ Array.isArray(formErrors.banner) ? formErrors.banner[0] : formErrors.banner }}
                  </p>
                </div>

                <input
                  ref="bannerInputRef"
                  type="file"
                  accept="image/*"
                  class="d-none"
                  @change="onBannerSelected"
                >
              </VCol>

              <!--
                Masqué pour un organisateur connecté : il ne peut créer que pour
                lui-même, et `organizer_id` est déjà pré-rempli. Le champ reste
                pour l'administration, qui crée au nom d'autrui.
              -->
              <VCol
                v-if="!hideOrganizerSelect"
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="form.organizer_id"
                  :items="organizerOptions"
                  item-title="companyName"
                  item-value="id"
                  label="Organisateur"
                  :rules="[requiredField('Organisateur')]"
                  :error-messages="formErrors.organizer_id"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="form.category_id"
                  :items="categoryOptions"
                  item-title="name"
                  item-value="id"
                  label="Catégorie"
                  :rules="[requiredField('Catégorie')]"
                  :error-messages="formErrors.category_id"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="form.event_type"
                  :items="eventTypeOptions"
                  item-title="title"
                  item-value="value"
                  label="Type d'événement"
                  :error-messages="formErrors.event_type"
                />
              </VCol>
              <VCol
                v-if="form.event_type === 'physical'"
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="form.venue_id"
                  :items="venueOptions"
                  item-title="name"
                  item-value="id"
                  label="Lieu (optionnel)"
                  clearable
                  :error-messages="formErrors.venue_id"
                />
              </VCol>
              <VCol
                v-else
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.online_url"
                  label="Lien de l'événement en ligne"
                  placeholder="https://…"
                  :rules="[requiredField('Lien de l\'événement en ligne'), urlValidator]"
                  :error-messages="formErrors.online_url"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VSelect
                  v-model="form.status"
                  :items="statusFormOptions"
                  item-title="title"
                  item-value="value"
                  label="Statut"
                  :error-messages="formErrors.status"
                />
              </VCol>
              <VCol cols="12">
                <VTextField
                  v-model="form.title"
                  label="Titre"
                  counter="255"
                  :rules="[requiredField('Titre')]"
                  :error-messages="formErrors.title"
                />
              </VCol>
              <VCol cols="12">
                <VTextField
                  v-model="form.slug"
                  label="Slug"
                  counter="255"
                  :rules="[requiredField('Slug')]"
                  :error-messages="formErrors.slug"
                  @input="slugEdited = true"
                />
              </VCol>
              <VCol cols="12">
                <VTextarea
                  v-model="form.description"
                  label="Description"
                  rows="3"
                  :rules="[requiredField('Description')]"
                  :error-messages="formErrors.description"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.start_date"
                  label="Date de début"
                  type="datetime-local"
                  :rules="[requiredField('Date de début')]"
                  :error-messages="formErrors.start_date"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.end_date"
                  label="Date de fin"
                  type="datetime-local"
                  :rules="[requiredField('Date de fin')]"
                  :error-messages="formErrors.end_date"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.max_attendees"
                  label="Capacité max. (optionnel)"
                  type="number"
                  min="1"
                  :error-messages="formErrors.max_attendees"
                />
              </VCol>

              <!-- Politique de remboursement -->
              <VCol cols="12">
                <VDivider class="mb-2" />
                <div class="text-subtitle-2 font-weight-medium mb-1">
                  Remboursement / annulation
                </div>
              </VCol>
              <VCol
                cols="12"
                md="6"
                class="d-flex align-center"
              >
                <VSwitch
                  v-model="form.refund_allowed"
                  color="primary"
                  :label="form.refund_allowed ? 'Remboursement autorisé' : 'Remboursement non autorisé'"
                  hide-details
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model.number="form.refund_days_before"
                  type="number"
                  min="0"
                  label="Remboursable jusqu'à … jours avant l'événement"
                  suffix="jours"
                  :disabled="!form.refund_allowed"
                  hint="0 = jusqu'au jour de l'événement"
                  persistent-hint
                  :error-messages="formErrors.refund_days_before"
                />
              </VCol>

              <!-- Contrôle d'accès -->
              <VCol cols="12">
                <VDivider class="mb-2" />
                <div class="text-subtitle-2 font-weight-medium mb-1">
                  Contrôle d'accès
                </div>
                <div class="text-caption text-medium-emphasis">
                  À ne remplir que si cet événement fait exception.
                </div>
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.checkin_open_hours_before"
                  type="number"
                  min="0"
                  max="168"
                  step="0.5"
                  label="Ouverture avant le début"
                  suffix="h"
                  :placeholder="String(inheritedHours('checkinOpenHoursBefore'))"
                  persistent-placeholder
                  :hint="gateOpensAt ? `Ouvre le ${gateOpensAt}` : inheritedOpenHint"
                  persistent-hint
                  :error-messages="formErrors.checkin_open_hours_before"
                />
              </VCol>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.checkin_close_hours_after"
                  type="number"
                  min="0"
                  max="168"
                  step="0.5"
                  label="Fermeture après la fin"
                  suffix="h"
                  :placeholder="String(inheritedHours('checkinCloseHoursAfter'))"
                  persistent-placeholder
                  :hint="gateClosesAt ? `Ferme le ${gateClosesAt}` : inheritedCloseHint"
                  persistent-hint
                  :error-messages="formErrors.checkin_close_hours_after"
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
            @click="saveEvent"
          >
            {{ editingEvent ? 'Enregistrer les modifications' : 'Créer l\'événement' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Annulation ────────────────────────────────────────────────── -->
    <VDialog
      v-model="isCancelDialogOpen"
      max-width="400"
    >
      <VCard title="Annuler l'événement">
        <VCardText class="pt-4">
          <p class="text-body-2">
            Êtes-vous sûr de vouloir annuler
            <strong>{{ cancellingEvent?.title }}</strong> ?
            L'événement passera au statut « Annulé ».
          </p>
        </VCardText>

        <VCardActions class="justify-end pa-4">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="isCancelDialogOpen = false"
          >
            Retour
          </VBtn>
          <VBtn
            color="error"
            :loading="isSubmitting"
            @click="confirmCancel"
          >
            Annuler l'événement
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- ─── Dialog Suppression ───────────────────────────────────────────────── -->
    <VDialog
      v-model="isDeleteDialogOpen"
      max-width="400"
    >
      <VCard title="Supprimer l'événement">
        <VCardText class="pt-4">
          <p class="text-body-2">
            Êtes-vous sûr de vouloir supprimer
            <strong>{{ deletingEvent?.title }}</strong> ?
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

    <ImageLightbox
      v-model="lightbox.open"
      :src="lightbox.src"
      :title="lightbox.title"
    />
  </div>
</template>
