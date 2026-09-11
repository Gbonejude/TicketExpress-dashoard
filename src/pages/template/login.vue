<script setup>
import { VForm } from 'vuetify/components/VForm'
import authV1BottomShape from '@images/svg/auth-v1-bottom-shape.svg?raw'
import authV1TopShape from '@images/svg/auth-v1-top-shape.svg?raw'
import { VNodeRenderer } from '@layouts/components/VNodeRenderer'
import { themeConfig } from '@themeConfig'

definePage({
  meta: {
    layout: 'blank',
    unauthenticatedOnly: true,
  },
})

const isPasswordVisible = ref(false)
const route = useRoute()
const router = useRouter()
const ability = useAbility()

const errors = ref({
  email: undefined,
  password: undefined,
})

// Erreur générale du formulaire (ex. « E-mail ou mot de passe incorrect. »),
// affichée en haut plutôt que collée sous le champ e-mail : le message ne
// désigne aucun champ en particulier, il désigne la tentative.
const formError = ref('')

const refVForm = ref()

const credentials = ref({
  email: '',
  password: '',
})

const login = async () => {
  errors.value = { email: undefined, password: undefined }
  formError.value = ''

  try {
    const res = await $api('/auth/admin/login', {
      method: 'POST',
      body: {
        email: credentials.value.email,
        password: credentials.value.password,
      },
      onResponseError({ response }) {
        const data = response._data

        // Erreurs de validation par champ vs message général : « identifiants
        // incorrects » n'est pas une erreur du champ e-mail, elle va en haut.
        if (data?.errors) {
          errors.value = data.errors
        } else if (data?.message) {
          formError.value = data.message
        }
      },
    })

    const { accessToken, userData, userAbilityRules } = res.data

    useCookie('userAbilityRules').value = userAbilityRules
    ability.update(userAbilityRules)
    useCookie('userData').value = userData
    useCookie('accessToken').value = accessToken
    await nextTick(() => {
      router.replace(route.query.to ? String(route.query.to) : '/')
    })
  } catch (err) {
    console.error(err)
  }
}

const onSubmit = () => {
  refVForm.value?.validate().then(({ valid: isValid }) => {
    if (isValid)
      login()
  })
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
            Bienvenue sur <span class="text-capitalize">{{ themeConfig.app.title }}</span> ! 
          </h4>
          <p class="mb-0">
            Connectez-vous à votre compte pour continuer
          </p>
        </VCardText>

        <VCardText>
          <VForm
            ref="refVForm"
            @submit.prevent="onSubmit"
          >
            <VRow>
              <!-- erreur générale (identifiants incorrects, etc.) -->
              <VCol
                v-if="formError"
                cols="12"
                class="pb-0 text-center"
              >
                <span
                  class="text-error text-body-2"
                  role="alert"
                >
                  {{ formError }}
                </span>
              </VCol>

              <!-- email -->
              <VCol cols="12">
                <AppTextField
                  v-model="credentials.email"
                  autofocus
                  label="Email"
                  type="email"
                  placeholder="johndoe@email.com"
                  :rules="[requiredField('Email'), emailValidator]"
                  :error-messages="errors.email"
                />
              </VCol>

              <!-- password -->
              <VCol cols="12">
                <AppTextField
                  v-model="credentials.password"
                  label="Mot de passe"
                  placeholder="············"
                  :rules="[requiredField('Mot de passe')]"
                  :type="isPasswordVisible ? 'text' : 'password'"
                  :error-messages="errors.password"
                  :append-inner-icon="isPasswordVisible ? 'tabler-eye-off' : 'tabler-eye'"
                  @click:append-inner="isPasswordVisible = !isPasswordVisible"
                />

                <!--
                  Le mot de passe d'un compte créé depuis le back-office est
                  généré et envoyé par mail : ce lien est le seul chemin pour
                  le renouveler, il ne peut pas manquer de l'écran de
                  connexion. 
                -->
                <div class="d-flex justify-end mt-2">
                  <RouterLink
                    class="text-primary text-body-2"
                    :to="{ name: 'template-forgot-password' }"
                  >
                    Mot de passe oublié ?
                  </RouterLink>
                </div>

                <VBtn
                  block
                  type="submit"
                  class="mt-6"
                >
                  Se connecter
                </VBtn>
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
