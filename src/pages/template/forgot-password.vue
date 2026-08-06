<script setup>
import { $api } from '@/utils/api'
import { notify, notifyApiError } from '@/utils/toast'
import authV1BottomShape from '@images/svg/auth-v1-bottom-shape.svg?raw'
import authV1TopShape from '@images/svg/auth-v1-top-shape.svg?raw'
import { VNodeRenderer } from '@layouts/components/VNodeRenderer'
import { themeConfig } from '@themeConfig'

definePage({
  meta: {
    layout: 'blank',
    public: true,
  },
})

/**
 * Mot de passe oublié.
 *
 * Mise en page reprise de `forgot-password-v1` du thème : carte centrée entre les
 * deux formes colorées. C'est celle de notre écran de connexion — les deux pages
 * s'enchaînent, elles doivent se ressembler.
 *
 * Le formulaire du thème était décoratif (`@submit.prevent="() => {}"`) : il ne
 * partait nulle part. Il appelle maintenant `auth/forgot-password`, la route qui
 * envoie le lien — indispensable depuis qu'un compte créé au back-office reçoit
 * un mot de passe généré qu'il doit pouvoir renouveler lui-même.
 *
 * La réponse ne dit jamais si l'adresse existe : ce serait indiquer à un inconnu
 * quels comptes sont ouverts.
 */
const form = ref({ email: '' })

const refForm = ref()
const isSubmitting = ref(false)
const isSent = ref(false)
const errors = ref({ email: undefined })

const onSubmit = async () => {
  const { valid } = await refForm.value?.validate() ?? { valid: true }
  if (!valid) return

  isSubmitting.value = true
  errors.value = { email: undefined }
  try {
    await $api('/auth/forgot-password', {
      method: 'POST',
      body: { email: form.value.email },
    })
    isSent.value = true
    notify('Si un compte existe pour cette adresse, un lien vient de lui être envoyé.')
  } catch (error) {
    const data = error?.data ?? error?._data
    if (data?.errors?.email) errors.value.email = data.errors.email
    else notifyApiError(error, "Impossible d'envoyer le lien pour le moment.")
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="auth-wrapper d-flex align-center justify-center pa-4">
    <div class="position-relative my-sm-16">
      <!-- 👉 Top shape -->
      <VNodeRenderer
        :nodes="h('div', { innerHTML: authV1TopShape })"
        class="text-primary auth-v1-top-shape d-none d-sm-block"
      />

      <!-- 👉 Bottom shape -->
      <VNodeRenderer
        :nodes="h('div', { innerHTML: authV1BottomShape })"
        class="text-primary auth-v1-bottom-shape d-none d-sm-block"
      />

      <!-- 👉 Auth card -->
      <VCard
        class="auth-card"
        max-width="460"
        :class="$vuetify.display.smAndUp ? 'pa-6' : 'pa-0'"
      >
        <VCardItem class="justify-center">
          <VCardTitle>
            <RouterLink to="/">
              <div class="app-logo">
                <VNodeRenderer :nodes="themeConfig.app.logo" />
                <h1 class="app-logo-title">
                  {{ themeConfig.app.title }}
                </h1>
              </div>
            </RouterLink>
          </VCardTitle>
        </VCardItem>

        <VCardText>
          <h4 class="text-h4 mb-1">
            Mot de passe oublié ? 🔒
          </h4>
          <p class="mb-0">
            Indiquez votre adresse : nous vous envoyons un lien pour en choisir un nouveau.
          </p>
        </VCardText>

        <VCardText>
          <VForm
            ref="refForm"
            @submit.prevent="onSubmit"
          >
            <VRow>
              <VCol
                v-if="isSent"
                cols="12"
              >
                <VAlert
                  type="success"
                  variant="tonal"
                  density="compact"
                >
                  Lien envoyé. Vérifiez votre boîte de réception, et vos indésirables.
                </VAlert>
              </VCol>

              <!-- email -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.email"
                  autofocus
                  label="Email"
                  type="email"
                  placeholder="vous@exemple.tg"
                  :rules="[requiredValidator, emailValidator]"
                  :error-messages="errors.email"
                />
              </VCol>

              <!-- reset password -->
              <VCol cols="12">
                <VBtn
                  block
                  type="submit"
                  :loading="isSubmitting"
                >
                  Envoyer le lien
                </VBtn>
              </VCol>

              <!-- back to login -->
              <VCol cols="12">
                <RouterLink
                  class="d-flex align-center justify-center"
                  :to="{ name: 'template-login' }"
                >
                  <VIcon
                    icon="tabler-chevron-left"
                    size="20"
                    class="me-1 flip-in-rtl"
                  />
                  <span>Retour à la connexion</span>
                </RouterLink>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </div>
  </div>
</template>

<style lang="scss">
@use "@core/scss/template/pages/page-auth";
</style>
