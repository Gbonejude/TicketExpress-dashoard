<script setup>
import QrScanner from 'qr-scanner'

import { $api } from '@/utils/api'

/**
 * Contrôle d'accès d'un événement : on lit un code, on répond « entrez » ou
 * « refusé, et voici pourquoi ».
 *
 * Trois façons de lire un billet, parce qu'un portique n'a pas toujours le même
 * matériel :
 *  - **la caméra**, qui décode le QR du billet et valide sans rien taper ;
 *  - une photo du QR, quand le poste n'a pas de caméra utilisable ;
 *  - le code au clavier — douchette USB (elle tape le code puis Entrée) ou
 *    saisie du numéro imprimé quand le QR est abîmé.
 *
 * Le QR du billet contient exactement `ticket.qr_code`, la même chaîne que le
 * numéro accepté par l'API : la caméra n'a donc rien à interpréter, elle poste ce
 * qu'elle lit.
 *
 * Le verdict occupe tout le haut du panneau, en couleur : à un portique on
 * regarde l'écran une demi-seconde, le détail vient après. Il reste affiché
 * jusqu'à la lecture suivante — il ne s'efface pas tout seul.
 *
 * Accessible aux organisateurs, admins et super-admins ; l'API vérifie ensuite
 * que l'organisateur est bien celui de l'événement.
 */
const props = defineProps({
  eventId: { type: String, required: true },

  /** Total des billets émis / déjà scannés, tels que remontés par l'onglet Statistiques. */
  sold: { type: Number, default: null },
  scanned: { type: Number, default: null },
})

const emit = defineEmits(['validated'])

const code = ref('')
const isSubmitting = ref(false)
const outcome = ref(null)
const codeInput = ref()

const history = ref([])
const isHistoryLoading = ref(false)

/**
 * L'état du portique, renvoyé avec l'historique : ouvert, et sinon pourquoi.
 *
 * Affiché avant tout scan. Un agent qui arrive trois heures trop tôt doit le
 * lire sur l'écran, pas le découvrir en refoulant son premier porteur.
 */
const window_ = ref(null)

const isGateClosed = computed(() => window_.value?.isOpen === false)

// Les clés reprennent les valeurs de `result` renvoyées par l'API, d'où le
// snake_case.
const RESULT_STYLES = {
  'ok': { color: 'success', icon: 'tabler-circle-check', title: 'Entrée autorisée' },
  'already_used': { color: 'warning', icon: 'tabler-alert-triangle', title: 'Billet déjà utilisé' },
  'wrong_event': { color: 'warning', icon: 'tabler-calendar-x', title: 'Autre événement' },
  'outside_window': { color: 'warning', icon: 'tabler-clock-x', title: 'Portique fermé' },
  'not_valid': { color: 'error', icon: 'tabler-ban', title: 'Billet non valide' },
  'not_found': { color: 'error', icon: 'tabler-search-off', title: 'Billet introuvable' },
}

const style = computed(() => RESULT_STYLES[outcome.value?.result] ?? RESULT_STYLES.not_found)

const progress = computed(() => {
  if (!props.sold) return 0

  return Math.min(100, Math.round(((props.scanned ?? 0) / props.sold) * 100))
})

const loadHistory = async () => {
  isHistoryLoading.value = true
  try {
    const res = await $api(`/events/${props.eventId}/check-ins?limit=15`)

    history.value = res?.data?.checkIns ?? []
    window_.value = res?.data?.window ?? null
  } catch {
    history.value = []
  } finally {
    isHistoryLoading.value = false
  }
}

const focusInput = () => {
  // `nextTick` : le champ n'est réactivable qu'une fois le bouton sorti de son
  // état chargement, sinon le focus est repris par le rendu.
  nextTick(() => codeInput.value?.focus?.())
}

/**
 * @param {string|Event|null} scanned Code lu par la caméra. Le typeof est
 *   indispensable : appelée depuis `@click`/`@keyup`, la fonction reçoit
 *   l'événement DOM en premier argument, qu'il ne faut pas prendre pour un code.
 */
const submit = async (scanned = null) => {
  const value = (typeof scanned === 'string' ? scanned : code.value).trim()
  if (!value || isSubmitting.value) return

  isSubmitting.value = true
  try {
    const res = await $api(`/events/${props.eventId}/tickets/validate`, {
      method: 'POST',
      body: { code: value },
    })

    outcome.value = {
      result: res?.data?.result ?? 'ok',
      message: res?.message ?? 'Billet validé.',
      ticket: res?.data?.ticket ?? null,
    }
    emit('validated')
    loadHistory()
  } catch (error) {
    const data = error?.data ?? error?._data

    outcome.value = {
      result: data?.errors?.result ?? 'not_found',
      message: data?.message ?? 'Validation impossible.',
      ticket: data?.errors?.ticket ?? null,
    }
  } finally {
    isSubmitting.value = false
    code.value = ''
    focusInput()
  }
}

const formatTime = iso => {
  if (!iso) return '—'

  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/* ─── Caméra ────────────────────────────────────────────────────────────────
 * La lecture continue : `qr-scanner` décode plusieurs fois par seconde et
 * renverrait donc le même billet en boucle tant qu'il reste devant l'objectif.
 * D'où la garde `lastScan` — un même code n'est reposté qu'après SCAN_COOLDOWN,
 * et un code différent passe immédiatement.
 * ------------------------------------------------------------------------- */
const SCAN_COOLDOWN = 3000

const video = ref()
const fileInput = ref()
const isCameraOn = ref(false)
const cameraError = ref('')
const hasCamera = ref(true)

let scanner = null
let lastScan = { code: '', at: 0 }

const onDecoded = result => {
  const value = (result?.data ?? '').trim()
  if (!value) return

  const now = Date.now()

  if (value === lastScan.code && now - lastScan.at < SCAN_COOLDOWN) return

  lastScan = { code: value, at: now }
  submit(value)
}

const stopCamera = () => {
  scanner?.stop()
  scanner?.destroy()
  scanner = null
  isCameraOn.value = false
}

const startCamera = async () => {
  cameraError.value = ''

  try {
    // Vérifié avant d'ouvrir : sur un poste sans webcam, autant le dire plutôt
    // que de laisser une zone vidéo noire.
    hasCamera.value = await QrScanner.hasCamera()

    if (!hasCamera.value) {
      cameraError.value = "Aucune caméra détectée sur ce poste. Utilisez la photo d'un QR ou saisissez le code."

      return
    }

    isCameraOn.value = true
    await nextTick()

    scanner = new QrScanner(video.value, onDecoded, {
      // La caméra arrière est celle qu'on pointe vers un billet.
      preferredCamera: 'environment',
      highlightScanRegion: true,
      highlightCodeOutline: true,
      maxScansPerSecond: 5,
    })

    await scanner.start()
  } catch (error) {
    stopCamera()

    // Le cas courant : permission refusée, ou page servie sans HTTPS (l'accès
    // caméra n'est autorisé que sur origine sûre — localhost compris).
    cameraError.value = error?.name === 'NotAllowedError'
      ? "Accès à la caméra refusé. Autorisez-le dans le navigateur, puis réessayez."
      : "Caméra indisponible. Vérifiez qu'aucune autre application ne l'utilise, et que la page est servie en HTTPS ou depuis localhost."
  }
}

const toggleCamera = () => (isCameraOn.value ? stopCamera() : startCamera())

/** Repli sans caméra : décoder le QR depuis une photo ou une capture. */
const onFilePicked = async event => {
  const file = event.target.files?.[0]
  if (!file) return

  cameraError.value = ''
  try {
    const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true })

    submit(result?.data ?? '')
  } catch {
    cameraError.value = 'Aucun QR code lisible sur cette image.'
  } finally {
    // Remis à zéro pour que réimporter le même fichier déclenche à nouveau.
    event.target.value = ''
  }
}

onMounted(() => {
  loadHistory()
  focusInput()
})

// La caméra continuerait de tourner en quittant l'onglet.
onBeforeUnmount(stopCamera)
</script>

<template>
  <div class="pa-4">
    <VRow>
      <!-- ─── Lecture du code ─────────────────────────────────────────────── -->
      <VCol
        cols="12"
        md="7"
      >
        <VCard variant="outlined">
          <VCardText>
            <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-4">
              <div class="d-flex align-center gap-2">
                <VIcon
                  icon="tabler-qrcode"
                  size="22"
                />
                <span class="text-h6">Contrôle d'accès</span>
              </div>

              <div class="d-flex gap-2">
                <VBtn
                  :color="isCameraOn ? 'error' : 'primary'"
                  size="small"
                  :prepend-icon="isCameraOn ? 'tabler-camera-off' : 'tabler-camera'"
                  @click="toggleCamera"
                >
                  {{ isCameraOn ? 'Arrêter la caméra' : 'Scanner le QR code' }}
                </VBtn>

                <VTooltip
                  text="Lire un QR depuis une photo"
                  location="top"
                >
                  <template #activator="{ props: tip }">
                    <VBtn
                      v-bind="tip"
                      icon
                      variant="tonal"
                      color="secondary"
                      size="small"
                      @click="fileInput?.click()"
                    >
                      <VIcon icon="tabler-photo-scan" />
                    </VBtn>
                  </template>
                </VTooltip>

                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  class="d-none"
                  @change="onFilePicked"
                >
              </div>
            </div>

            <!--
              Portique fermé : dit avant le premier scan, pas après le premier
              refus. Le champ reste actif — c'est le serveur qui tranche, et un
              agent doit pouvoir vérifier un code même hors des heures.
            -->
            <VAlert
              v-if="isGateClosed"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-4"
              icon="tabler-clock-x"
            >
              {{ window_.reason }}
            </VAlert>

            <!--
              Caméra : montée seulement quand elle tourne, pour que le flux
              soit libéré dès qu'on l'arrête.
            -->
            <div
              v-if="isCameraOn"
              class="check-in__camera mb-4"
            >
              <video
                ref="video"
                class="check-in__video"
              />
              <div class="text-caption text-medium-emphasis mt-1">
                Présentez le QR code du billet devant la caméra — la validation part
                dès qu'il est lu.
              </div>
            </div>

            <VAlert
              v-if="cameraError"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-4"
            >
              {{ cameraError }}
            </VAlert>

            <VTextField
              ref="codeInput"
              v-model="code"
              label="Ou saisir le code du billet"
              placeholder="TKT-…"
              prepend-inner-icon="tabler-scan"
              autofocus
              :disabled="isSubmitting"
              @keyup.enter="submit"
            />

            <div class="d-flex gap-3 mt-4">
              <VBtn
                color="primary"
                :loading="isSubmitting"
                :disabled="!code.trim()"
                prepend-icon="tabler-check"
                @click="submit"
              >
                Valider le billet
              </VBtn>
              <VBtn
                variant="tonal"
                color="secondary"
                @click="code = ''; outcome = null; focusInput()"
              >
                Effacer
              </VBtn>
            </div>

            <!-- Verdict -->
            <VAlert
              v-if="outcome"
              :color="style.color"
              variant="tonal"
              :icon="style.icon"
              class="mt-5"
              prominent
            >
              <div class="text-h6 mb-1">
                {{ style.title }}
              </div>
              <div class="text-body-2">
                {{ outcome.message }}
              </div>

              <VDivider
                v-if="outcome.ticket"
                class="my-3"
              />

              <div
                v-if="outcome.ticket"
                class="text-body-2"
              >
                <div>
                  <strong>{{ outcome.ticket.attendeeName ?? 'Participant' }}</strong>
                </div>
                <div class="text-caption">
                  {{ outcome.ticket.ticketNumber }}
                  <span v-if="outcome.ticket.ticketType?.name">
                    · {{ outcome.ticket.ticketType.name }}
                  </span>
                </div>
              </div>
            </VAlert>

            <!-- Avancement du scan, quand les stats sont chargées. -->
            <div
              v-if="sold"
              class="mt-6"
            >
              <div class="d-flex justify-space-between text-body-2 mb-1">
                <span>Entrées enregistrées</span>
                <span class="font-weight-medium">{{ scanned ?? 0 }} / {{ sold }}</span>
              </div>
              <VProgressLinear
                :model-value="progress"
                color="success"
                height="8"
                rounded
              />
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- ─── Dernières entrées ───────────────────────────────────────────── -->
      <VCol
        cols="12"
        md="5"
      >
        <VCard variant="outlined">
          <VCardTitle class="d-flex align-center justify-space-between">
            <span class="text-body-1 font-weight-medium">Dernières entrées</span>
            <VBtn
              icon
              variant="text"
              size="small"
              :loading="isHistoryLoading"
              @click="loadHistory"
            >
              <VIcon icon="tabler-refresh" />
            </VBtn>
          </VCardTitle>

          <VDivider />

          <VList
            v-if="history.length"
            density="compact"
            max-height="420"
            class="overflow-y-auto"
          >
            <VListItem
              v-for="entry in history"
              :key="entry.id"
            >
              <template #prepend>
                <VAvatar
                  size="32"
                  color="success"
                  variant="tonal"
                >
                  <VIcon
                    icon="tabler-check"
                    size="18"
                  />
                </VAvatar>
              </template>

              <VListItemTitle class="text-body-2">
                {{ entry.attendeeName ?? entry.ticketNumber }}
              </VListItemTitle>
              <VListItemSubtitle class="text-caption">
                {{ entry.ticketNumber }}
                <span v-if="entry.ticketTypeName">· {{ entry.ticketTypeName }}</span>
              </VListItemSubtitle>

              <template #append>
                <div class="text-caption text-medium-emphasis text-end">
                  <div>{{ formatTime(entry.scannedAt) }}</div>
                  <div v-if="entry.scannedBy">
                    {{ entry.scannedBy }}
                  </div>
                </div>
              </template>
            </VListItem>
          </VList>

          <VCardText
            v-else
            class="text-body-2 text-medium-emphasis"
          >
            Aucune entrée enregistrée pour le moment.
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<style scoped>
/* Cadre de la caméra : hauteur bornée pour que la vidéo ne pousse pas le verdict
   sous la ligne de flottaison — c'est le verdict qu'on regarde, pas l'image. */
.check-in__camera {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  background-color: #000;
}

.check-in__video {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: cover;
}
</style>
