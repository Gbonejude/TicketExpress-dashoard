<script setup>
import { notify } from '@/utils/toast'

definePage({
  meta: {
    action: 'read',
    subject: 'administrators',
  },
})

import { $api } from '@/utils/api'

const isLoading = ref(true)
const isSubmitting = ref(false)
const refForm = ref()

const commissionPercent = ref(5)

const loadSettings = async () => {
  isLoading.value = true
  try {
    const res = await $api('/settings')
    commissionPercent.value = res?.data?.commissionPercent ?? 5
  } catch (err) {
    notify(err?.data?.message ?? 'Impossible de charger les paramètres.', 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(loadSettings)

const saveSettings = async () => {
  const { valid } = await refForm.value?.validate() ?? { valid: true }
  if (!valid) return

  isSubmitting.value = true
  try {
    const res = await $api('/settings', {
      method: 'PUT',
      body: { commission_rate: Number(commissionPercent.value) / 100 },
    })
    commissionPercent.value = res?.data?.commissionPercent ?? commissionPercent.value
    notify('Paramètres enregistrés.')
  } catch (err) {
    notify(err?.data?.message ?? "Impossible d'enregistrer les paramètres.", 'error')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardItem>
        <VCardTitle>Paramètres de la plateforme</VCardTitle>
        <VCardSubtitle>Réglages globaux réservés au super administrateur.</VCardSubtitle>
      </VCardItem>

      <VDivider />

      <VCardText>
        <VForm
          ref="refForm"
          @submit.prevent="saveSettings"
        >
          <h3 class="text-h6 mb-1">
            Commission
          </h3>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Part prélevée par TicketExpress sur chaque billet vendu. L'organisateur perçoit le reste.
          </p>

          <VRow>
            <VCol
              cols="12"
              md="4"
            >
              <VTextField
                v-model.number="commissionPercent"
                type="number"
                min="0"
                max="100"
                step="0.5"
                label="Commission (%)"
                suffix="%"
                :loading="isLoading"
                :rules="[
                  v => (v !== '' && v !== null) || 'Requis',
                  v => Number(v) >= 0 || 'Doit être positif',
                  v => Number(v) <= 100 || 'Ne peut pas dépasser 100%',
                ]"
              />
            </VCol>
            <VCol
              cols="12"
              md="8"
              class="d-flex align-center"
            >
              <VAlert
                type="info"
                variant="tonal"
                density="compact"
                class="mb-0"
              >
                Exemple : sur un billet à 10 000 FCFA, TicketExpress prélève
                <strong>{{ new Intl.NumberFormat('fr-FR').format(Math.round(10000 * (Number(commissionPercent) || 0) / 100)) }} FCFA</strong>,
                l'organisateur reçoit
                <strong>{{ new Intl.NumberFormat('fr-FR').format(10000 - Math.round(10000 * (Number(commissionPercent) || 0) / 100)) }} FCFA</strong>.
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
