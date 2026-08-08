<script setup>
import { $api, toMediaUrl } from '@/utils/api'
import { notify, notifyApiError } from '@/utils/toast'

definePage({
  meta: {
    action: 'read',
    subject: 'Auth',
  },
})

/*
 * Les clés des formulaires recopient celles de l'API, en snake_case : le payload
 * part tel quel.
 */
/* eslint-disable camelcase */

/**
 * Mon compte.
 *
 * L'écran ne faisait qu'afficher ce que le cookie de session portait déjà, et un
 * second onglet promettait des « paramètres » qui n'ont jamais existé. Il sert
 * maintenant à ce pour quoi on l'ouvre : sa photo, ses informations, son mot de
 * passe.
 *
 * Le rôle reste en lecture seule, et hors du formulaire : il ne se donne pas
 * soi-même. L'API l'ignore de toute façon — `PUT /me` n'accepte pas ce champ.
 */
const userData = useCookie('userData')

const roleLabels = {
  'super-admin': 'Super administrateur',
  'admin': 'Administrateur',
  'organizer-manager': 'Organisateur',
  'participant': 'Participant',
}

const user = computed(() => userData.value ?? {})
const roleLabel = computed(() => roleLabels[user.value.role] ?? user.value.role ?? '—')

/* ─── Informations ──────────────────────────────────────────────────────────── */
const refForm = ref()
const isSaving = ref(false)
const formErrors = ref({})

const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
})

const photoFile = ref(null)
const photoPreview = ref(null)
const photoInputRef = ref(null)

/** La photo enregistrée, ou l'aperçu local tant qu'elle n'est pas partie. */
const photoUrl = computed(() =>
  photoPreview.value
  ?? (user.value.thumbnail || user.value.image
    ? toMediaUrl(user.value.thumbnail || user.value.image)
    : null))

/**
 * Le formulaire suit la session.
 *
 * `immediate`, parce que le cookie est là dès le montage ; et le suivi continue
 * parce que `/me` répond après coup au démarrage de l'application — sans quoi
 * les champs resteraient vides le temps de cet aller-retour.
 */
watch(userData, value => {
  form.first_name = value?.firstName ?? ''
  form.last_name = value?.lastName ?? ''
  form.email = value?.email ?? ''
  form.phone = value?.phone ?? ''
}, { immediate: true })

const onPhotoSelected = event => {
  const file = event.target.files[0]
  if (!file) return

  photoFile.value = file
  photoPreview.value = URL.createObjectURL(file)
}

const save = async () => {
  const { valid } = await refForm.value?.validate() ?? { valid: true }
  if (!valid) return

  isSaving.value = true
  formErrors.value = {}
  try {
    let res

    if (photoFile.value) {
      // POST + `_method=PUT` : un navigateur n'envoie pas de multipart en PUT.
      const body = new FormData()

      Object.entries(form).forEach(([key, value]) => body.append(key, value ?? ''))
      body.append('image', photoFile.value)
      body.append('_method', 'PUT')

      res = await $api('/me', { method: 'POST', body })
    } else {
      res = await $api('/me', { method: 'PUT', body: { ...form } })
    }

    // La session est remise à jour sur place : le nom et la photo de la barre du
    // haut viennent de ce cookie, et ils annonceraient les anciens jusqu'au
    // prochain rechargement.
    if (res?.data) userData.value = res.data

    photoFile.value = null
    photoPreview.value = null
    notify('Profil mis à jour.')
  } catch (error) {
    const data = error?.data ?? error?._data
    if (data?.errors) formErrors.value = data.errors
    else notifyApiError(error, 'Impossible d\'enregistrer le profil.')
  } finally {
    isSaving.value = false
  }
}

/* ─── Mot de passe ──────────────────────────────────────────────────────────── */
const refPasswordForm = ref()
const isSavingPassword = ref(false)
const passwordErrors = ref({})

const isCurrentVisible = ref(false)
const isNewVisible = ref(false)

const passwordForm = reactive({
  current_password: '',
  password: '',
  password_confirmation: '',
})

const savePassword = async () => {
  const { valid } = await refPasswordForm.value?.validate() ?? { valid: true }
  if (!valid) return

  isSavingPassword.value = true
  passwordErrors.value = {}
  try {
    await $api('/me/password', { method: 'PUT', body: { ...passwordForm } })

    passwordForm.current_password = ''
    passwordForm.password = ''
    passwordForm.password_confirmation = ''
    refPasswordForm.value?.resetValidation()
    notify('Mot de passe modifié.')
  } catch (error) {
    const data = error?.data ?? error?._data
    if (data?.errors) passwordErrors.value = data.errors
    else notifyApiError(error, 'Impossible de changer le mot de passe.')
  } finally {
    isSavingPassword.value = false
  }
}
</script>

<template>
  <VRow>
    <!-- ─── Informations ──────────────────────────────────────────────────── -->
    <VCol cols="12">
      <VCard title="Mon profil">
        <VDivider />

        <VCardText>
          <div class="d-flex flex-wrap align-center gap-6 mb-6">
            <VAvatar
              size="88"
              color="primary"
              variant="tonal"
            >
              <VImg
                v-if="photoUrl"
                :src="photoUrl"
                cover
              />
              <VIcon
                v-else
                icon="tabler-user"
                size="44"
              />
            </VAvatar>

            <div>
              <h2 class="text-h5 font-weight-medium mb-1">
                {{ user.fullName ?? 'Mon compte' }}
              </h2>
              <!-- Le rôle se lit, ne se choisit pas. -->
              <VChip
                color="primary"
                size="small"
                variant="tonal"
                class="mb-3"
              >
                {{ roleLabel }}
              </VChip>

              <div class="d-flex flex-wrap align-center gap-3">
                <VBtn
                  size="small"
                  prepend-icon="tabler-camera"
                  @click="photoInputRef?.click()"
                >
                  {{ photoUrl ? 'Changer la photo' : 'Ajouter une photo' }}
                </VBtn>
                <span class="text-body-2 text-medium-emphasis">
                  JPG, PNG ou WebP · 2 Mo maximum
                </span>
              </div>

              <!--
                La photo n'est envoyée qu'avec le reste : un enregistrement, un
                seul appel, et l'aperçu laisse le temps de se raviser.
              -->
              <p
                v-if="photoFile"
                class="text-caption text-warning mb-0 mt-2"
              >
                Nouvelle photo choisie — enregistrez pour l'appliquer.
              </p>
              <p
                v-if="formErrors.image"
                class="text-caption text-error mb-0 mt-2"
              >
                {{ Array.isArray(formErrors.image) ? formErrors.image[0] : formErrors.image }}
              </p>

              <input
                ref="photoInputRef"
                type="file"
                accept="image/png, image/jpeg, image/gif, image/webp"
                class="d-none"
                @change="onPhotoSelected"
              >
            </div>
          </div>

          <VForm ref="refForm">
            <VRow>
              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.first_name"
                  label="Prénom"
                  :rules="[requiredField('Prénom')]"
                  :error-messages="formErrors.first_name"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.last_name"
                  label="Nom"
                  :rules="[requiredField('Nom')]"
                  :error-messages="formErrors.last_name"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.email"
                  type="email"
                  label="Adresse e-mail"
                  :rules="[requiredField('Adresse e-mail'), emailValidator]"
                  :error-messages="formErrors.email"
                />
              </VCol>

              <VCol
                cols="12"
                md="6"
              >
                <VTextField
                  v-model="form.phone"
                  type="tel"
                  label="Téléphone"
                  placeholder="90112233"
                  :error-messages="formErrors.phone"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>

        <VCardActions class="justify-end pa-4 pt-0">
          <VBtn
            color="primary"
            :loading="isSaving"
            @click="save"
          >
            Enregistrer
          </VBtn>
        </VCardActions>
      </VCard>
    </VCol>

    <!-- ─── Mot de passe ──────────────────────────────────────────────────── -->
    <VCol cols="12">
      <VCard title="Changer mon mot de passe">
        <VDivider />

        <VCardText>
          <!--
            Pas de rappel des règles au-dessus des champs : l'API les renvoie en
            clair si le mot de passe ne convient pas, et sous le champ concerné.
            Le mot de passe actuel, lui, est exigé — un poste laissé ouvert ne
            doit pas suffire à verrouiller le compte de son propriétaire.
          -->
          <VForm ref="refPasswordForm">
            <VRow>
              <VCol
                cols="12"
                md="4"
              >
                <VTextField
                  v-model="passwordForm.current_password"
                  :type="isCurrentVisible ? 'text' : 'password'"
                  :append-inner-icon="isCurrentVisible ? 'tabler-eye-off' : 'tabler-eye'"
                  label="Mot de passe actuel"
                  autocomplete="current-password"
                  :rules="[requiredField('Mot de passe actuel')]"
                  :error-messages="passwordErrors.current_password"
                  @click:append-inner="isCurrentVisible = !isCurrentVisible"
                />
              </VCol>

              <VCol
                cols="12"
                md="4"
              >
                <VTextField
                  v-model="passwordForm.password"
                  :type="isNewVisible ? 'text' : 'password'"
                  :append-inner-icon="isNewVisible ? 'tabler-eye-off' : 'tabler-eye'"
                  label="Nouveau mot de passe"
                  autocomplete="new-password"
                  :rules="[requiredField('Nouveau mot de passe')]"
                  :error-messages="passwordErrors.password"
                  @click:append-inner="isNewVisible = !isNewVisible"
                />
              </VCol>

              <VCol
                cols="12"
                md="4"
              >
                <VTextField
                  v-model="passwordForm.password_confirmation"
                  :type="isNewVisible ? 'text' : 'password'"
                  label="Confirmer le nouveau mot de passe"
                  autocomplete="new-password"
                  :rules="[
                    requiredField('Confirmation'),
                    v => v === passwordForm.password || 'La confirmation ne correspond pas.',
                  ]"
                />
              </VCol>
            </VRow>
          </VForm>
        </VCardText>

        <VCardActions class="justify-end pa-4 pt-0">
          <VBtn
            color="primary"
            :loading="isSavingPassword"
            @click="savePassword"
          >
            Changer le mot de passe
          </VBtn>
        </VCardActions>
      </VCard>
    </VCol>
  </VRow>
</template>
