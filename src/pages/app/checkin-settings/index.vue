<script setup>
import { notify } from '@/utils/toast'

definePage({
  meta: {
    action: 'read',
    subject: 'organizer-profile',
  },
})

import { $api } from '@/utils/api'

/**
 * Contrôle d'accès — les réglages de l'organisateur connecté.
 *
 * Ces heures ne sont pas un paramètre de plateforme : c'est l'organisateur qui
 * tient le portique, et lui seul sait qu'il ouvre deux heures avant un concert
 * ou dès l'aube pour une formation. Elles s'appliquent à tous ses événements ;
 * un événement particulier peut les contredire à sa création.
 *
 * L'API n'expose ici que ces deux champs. Le nom, le logo et surtout le statut
 * du profil relèvent de l'administration — les mettre sur cet écran laisserait
 * un organisateur s'approuver lui-même.
 */
const FACTORY_HOURS = 4

const isLoading = ref(true)
const isSubmitting = ref(false)
const hasProfile = ref(true)
const refForm = ref()

const openHoursBefore = ref('')
const closeHoursAfter = ref('')

const loadProfile = async () => {
  isLoading.value = true
  try {
    const res = await $api('/organizers/me')

    // `?? ''` et non `?? 4` : vide veut dire « je n'ai rien réglé », et
    // l'afficher rempli laisserait croire à un choix qui n'a pas été fait.
    openHoursBefore.value = res?.data?.checkinOpenHoursBefore ?? ''
    closeHoursAfter.value = res?.data?.checkinCloseHoursAfter ?? ''
  } catch (err) {
    if (err?.response?.status === 404 || err?.data?.message?.includes('organisateur')) {
      hasProfile.value = false
    } else {
      notify(err?.data?.message ?? 'Impossible de charger vos réglages.', 'error')
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(loadProfile)

const save = async () => {
  const { valid } = await refForm.value?.validate() ?? { valid: true }
  if (!valid) return

  isSubmitting.value = true
  try {
    const res = await $api('/organizers/me', {
      method: 'PUT',

      // Les clés du corps de requête sont celles de l'API, en snake_case.
      // Envoyées même vides — c'est ainsi qu'on revient à la valeur par défaut.
      /* eslint-disable camelcase */
      body: {
        checkin_open_hours_before: openHoursBefore.value === '' ? null : Number(openHoursBefore.value),
        checkin_close_hours_after: closeHoursAfter.value === '' ? null : Number(closeHoursAfter.value),
      },
      /* eslint-enable camelcase */
    })

    openHoursBefore.value = res?.data?.checkinOpenHoursBefore ?? ''
    closeHoursAfter.value = res?.data?.checkinCloseHoursAfter ?? ''
    notify('Contrôle d\'accès mis à jour.')
  } catch (err) {
    notify(err?.data?.message ?? 'Impossible d\'enregistrer vos réglages.', 'error')
  } finally {
    isSubmitting.value = false
  }
}

/**
 * Les marges rendues sur un exemple concret — un concert de 20 h à 23 h. Un
 * nombre d'heures se lit mal ; un horaire de portique se lit tout de suite. Le
 * modulo ramène dans la journée les marges qui franchissent minuit.
 */
const clockHour = hour => `${((Math.round(hour) % 24) + 24) % 24} h`

const effectiveOpen = computed(() => Number(openHoursBefore.value === '' ? FACTORY_HOURS : openHoursBefore.value) || 0)
const effectiveClose = computed(() => Number(closeHoursAfter.value === '' ? FACTORY_HOURS : closeHoursAfter.value) || 0)

const exampleOpensAt = computed(() => clockHour(20 - effectiveOpen.value))
const exampleClosesAt = computed(() => clockHour(23 + effectiveClose.value))

const hoursRules = [
  v => v === '' || v === null || Number(v) >= 0 || 'Doit être positif',
  v => v === '' || v === null || Number(v) <= 168 || 'Ne peut pas dépasser 168 h (7 jours)',
]
</script>

<template>
  <div>
    <VCard>
      <VCardItem>
        <VCardTitle>Contrôle d'accès</VCardTitle>
        <VCardSubtitle>
          Quand les billets de vos événements peuvent être validés à l'entrée.
        </VCardSubtitle>
      </VCardItem>

      <VDivider />

      <VCardText v-if="!hasProfile">
        <VAlert
          type="info"
          variant="tonal"
        >
          Aucun profil organisateur n'est rattaché à ce compte. Ces réglages
          concernent les organisateurs qui tiennent l'entrée de leurs événements.
        </VAlert>
      </VCardText>

      <VCardText v-else>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Ces heures s'appliquent à tous vos événements. En dehors de cette période,
          l'entrée est refusée — c'est ce qui évite qu'un billet de demain soit
          consommé aujourd'hui, son porteur se retrouvant refoulé le jour dit.
          Un événement particulier peut s'en écarter à sa création.
        </p>

        <VForm
          ref="refForm"
          @submit.prevent="save"
        >
          <VRow>
            <VCol
              cols="12"
              md="4"
            >
              <VTextField
                v-model="openHoursBefore"
                type="number"
                min="0"
                max="168"
                step="0.5"
                label="Ouverture avant le début"
                suffix="h"
                :placeholder="String(FACTORY_HOURS)"
                persistent-placeholder
                hint="Vide = 4 h, la valeur par défaut"
                persistent-hint
                :loading="isLoading"
                :rules="hoursRules"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
            >
              <VTextField
                v-model="closeHoursAfter"
                type="number"
                min="0"
                max="168"
                step="0.5"
                label="Fermeture après la fin"
                suffix="h"
                :placeholder="String(FACTORY_HOURS)"
                persistent-placeholder
                hint="Vide = 4 h, la valeur par défaut"
                persistent-hint
                :loading="isLoading"
                :rules="hoursRules"
              />
            </VCol>
            <VCol
              cols="12"
              md="4"
              class="d-flex align-center"
            >
              <VAlert
                type="info"
                variant="tonal"
                density="compact"
                class="mb-0"
              >
                Un concert de 20 h à 23 h se contrôle de
                <strong>{{ exampleOpensAt }}</strong> à
                <strong>{{ exampleClosesAt }}</strong>.
                Les billets non présentés passent ensuite en « expiré ».
              </VAlert>
            </VCol>
          </VRow>

          <div class="mt-6">
            <VBtn
              type="submit"
              :loading="isSubmitting"
              prepend-icon="tabler-device-floppy"
            >
              Enregistrer
            </VBtn>
          </div>
        </VForm>
      </VCardText>
    </VCard>
  </div>
</template>
