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
 * Choix du nouveau mot de passe, depuis le lien reçu par mail.
 *
 * Mise en page reprise de `reset-password-v1` du thème, comme l'écran de
 * connexion et celui du mot de passe oublié : les trois pages s'enchaînent, elles
 * partagent la carte centrée et les deux formes colorées.
 *
 * `public: true` et non `unauthenticatedOnly` : quelqu'un dont la session traîne
 * encore doit pouvoir ouvrir son lien sans être renvoyé au tableau de bord.
 *
 * Le jeton et l'adresse viennent de l'URL — c'est le mail qui les porte, ils ne
 * se saisissent pas. Sans eux la page ne peut rien faire, d'où l'avertissement
 * plutôt qu'un formulaire qui échouerait à l'envoi.
 */
const route = useRoute()
const router = useRouter()

const form = ref({
  newPassword: '',
  confirmPassword: '',
})

const isPasswordVisible = ref(false)
const isConfirmPasswordVisible = ref(false)

const refForm = ref()
const isSubmitting = ref(false)
const errors = ref({ password: undefined })

const token = computed(() => String(route.query.token ?? ''))
const email = computed(() => String(route.query.email ?? ''))
const hasLink = computed(() => Boolean(token.value && email.value))

const onSubmit = async () => {
  const { valid } = await refForm.value?.validate() ?? { valid: true }
  if (!valid || !hasLink.value) return

  isSubmitting.value = true
  errors.value = { password: undefined }
  try {
    await $api('/auth/reset-password', {
      method: 'POST',
      body: {
        email: email.value,
        token: token.value,
        password: form.value.newPassword,
        password_confirmation: form.value.confirmPassword,
      },
    })
    notify('Mot de passe modifié. Vous pouvez vous connecter.')
    router.replace({ name: 'template-login' })
  } catch (error) {
    const data = error?.data ?? error?._data
    if (data?.errors?.password) errors.value.password = data.errors.password
    else notifyApiError(error, 'Lien invalide ou expiré. Demandez-en un nouveau.')
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

      <!-- 👉 Auth Card -->
      <VCard
        class="auth-card"
        max-width="460"
        :class="$vuetify.display.smAndUp ? 'pa-6' : 'pa-2'"
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
            Nouveau mot de passe
          </h4>
          <p class="mb-0">
            Choisissez un mot de passe différent de vos précédents.
          </p>
        </VCardText>

        <VCardText>
          <VForm
            ref="refForm"
            @submit.prevent="onSubmit"
          >
            <VRow>
              <VCol
                v-if="!hasLink"
                cols="12"
              >
                <VAlert
                  type="warning"
                  variant="tonal"
                  density="compact"
                >
                  Ce lien est incomplet. Ouvrez celui reçu par mail, ou demandez-en un
                  nouveau depuis « Mot de passe oublié ».
                </VAlert>
              </VCol>

              <!-- password -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.newPassword"
                  autofocus
                  label="Nouveau mot de passe"
                  placeholder="············"
                  :type="isPasswordVisible ? 'text' : 'password'"
                  :append-inner-icon="isPasswordVisible ? 'tabler-eye-off' : 'tabler-eye'"
                  :rules="[requiredValidator, passwordValidator]"
                  :error-messages="errors.password"
                  @click:append-inner="isPasswordVisible = !isPasswordVisible"
                />
              </VCol>

              <!-- Confirm Password -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.confirmPassword"
                  label="Confirmer le mot de passe"
                  placeholder="············"
                  :type="isConfirmPasswordVisible ? 'text' : 'password'"
                  :append-inner-icon="isConfirmPasswordVisible ? 'tabler-eye-off' : 'tabler-eye'"
                  :rules="[
                    requiredValidator,
                    confirmedValidator(form.confirmPassword, form.newPassword),
                  ]"
                  @click:append-inner="isConfirmPasswordVisible = !isConfirmPasswordVisible"
                />
              </VCol>

              <!-- reset password -->
              <VCol cols="12">
                <VBtn
                  block
                  type="submit"
                  :loading="isSubmitting"
                  :disabled="!hasLink"
                >
                  Enregistrer le mot de passe
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
