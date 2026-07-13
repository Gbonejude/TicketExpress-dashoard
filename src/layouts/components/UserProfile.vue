<script setup>
import { PerfectScrollbar } from 'vue3-perfect-scrollbar'
import { $api } from '@/utils/api'

const router = useRouter()
const ability = useAbility()

const userData = useCookie('userData')
const avatarRef = ref(null)

const isLogoutDialogVisible = ref(false)
const isLoggingOut = ref(false)

const logout = async () => {
  isLoggingOut.value = true

  // Best-effort server-side token revocation; we log out locally regardless.
  try {
    await $api('/auth/logout', { method: 'POST' })
  } catch {
    // ignore — token may already be invalid/expired
  }

  useCookie('accessToken').value = null
  userData.value = null
  useCookie('userAbilityRules').value = null
  ability.update([])
  isLoggingOut.value = false
  isLogoutDialogVisible.value = false
  await router.push({ name: 'template-login' })
}

const userProfileList = [
  { type: 'divider' },
  {
    type: 'navItem',
    icon: 'tabler-user',
    title: 'Mon profil',
    to: {
      name: 'account',
      query: { tab: 'profile' },
    },
  },
  {
    type: 'navItem',
    icon: 'tabler-settings',
    title: 'Paramètres',
    to: {
      name: 'account',
      query: { tab: 'settings' },
    },
  },
]
</script>

<template>
  <div v-if="userData">
    <VAvatar
      ref="avatarRef"
      size="38"
      class="cursor-pointer"
      color="primary"
      variant="tonal"
    >
      <VIcon icon="tabler-user" />
    </VAvatar>

    <VMenu
      :activator="avatarRef"
      width="240"
      location="bottom end"
      offset="12px"
    >
      <VList>
        <VListItem>
          <div class="d-flex gap-2 align-center">
            <VAvatar
              color="primary"
              variant="tonal"
            >
              <VIcon icon="tabler-user" />
            </VAvatar>
            <div>
              <h6 class="text-h6 font-weight-medium">
                {{ userData.fullName ?? userData.full_name }}
              </h6>
              <VListItemSubtitle class="text-disabled">
                {{ userData.email }}
              </VListItemSubtitle>
            </div>
          </div>
        </VListItem>

        <PerfectScrollbar :options="{ wheelPropagation: false }">
          <template
            v-for="item in userProfileList"
            :key="item.title"
          >
            <VListItem
              v-if="item.type === 'navItem'"
              :to="item.to"
            >
              <template #prepend>
                <VIcon
                  :icon="item.icon"
                  size="22"
                />
              </template>
              <VListItemTitle>{{ item.title }}</VListItemTitle>
            </VListItem>

            <VDivider
              v-else
              class="my-2"
            />
          </template>

          <div class="px-4 py-2">
            <VBtn
              block
              size="small"
              color="error"
              append-icon="tabler-logout"
              @click="isLogoutDialogVisible = true"
            >
              Déconnexion
            </VBtn>
          </div>
        </PerfectScrollbar>
      </VList>
    </VMenu>

    <!-- 👉 Confirmation de déconnexion -->
    <VDialog
      v-model="isLogoutDialogVisible"
      max-width="420"
      persistent
    >
      <VCard>
        <VCardItem class="text-center pt-6">
          <VAvatar
            color="error"
            variant="tonal"
            size="72"
            class="mx-auto mb-2"
          >
            <VIcon
              icon="tabler-logout"
              size="36"
            />
          </VAvatar>
          <VCardTitle class="text-h5">
            Déconnexion
          </VCardTitle>
        </VCardItem>

        <VCardText class="text-center text-body-1">
          Êtes-vous sûr de vouloir vous déconnecter ?
        </VCardText>

        <VCardActions class="justify-center pb-6 pt-2 gap-3">
          <VBtn
            variant="tonal"
            color="secondary"
            :disabled="isLoggingOut"
            @click="isLogoutDialogVisible = false"
          >
            Annuler
          </VBtn>
          <VBtn
            color="error"
            variant="elevated"
            :loading="isLoggingOut"
            @click="logout"
          >
            Se déconnecter
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
