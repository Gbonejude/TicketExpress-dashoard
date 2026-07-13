<script setup>
import { useTheme } from 'vuetify'
import ScrollToTop from '@core/components/ScrollToTop.vue'
import initCore from '@core/initCore'
import {
  initConfigStore,
  useConfigStore,
} from '@core/stores/config'
import { hexToRgb } from '@core/utils/colorConverter'
import { $api } from '@/utils/api'

const { global } = useTheme()
const ability = useAbility()

// ℹ️ Sync current theme with initial loader theme
initCore()
initConfigStore()

const configStore = useConfigStore()

// 👉 Refresh the session on boot: re-fetch the current user and their ability
// rules so permission changes made on the back-office propagate without a
// re-login, and stale/expired tokens self-heal.
const syncSession = async () => {
  const accessToken = useCookie('accessToken')
  if (!accessToken.value)
    return

  try {
    const res = await $api('/me')
    const data = res?.data
    if (!data)
      return

    if (data.user)
      useCookie('userData').value = data.user

    if (data.userAbilityRules) {
      useCookie('userAbilityRules').value = data.userAbilityRules
      ability.update(data.userAbilityRules)
    }
  } catch (err) {
    if (err?.response?.status === 401) {
      useCookie('accessToken').value = null
      useCookie('userData').value = null
      useCookie('userAbilityRules').value = null
      ability.update([])
    }
  }
}

onMounted(syncSession)
</script>

<template>
  <VLocaleProvider :rtl="configStore.isAppRTL">
    <!-- ℹ️ This is required to set the background color of active nav link based on currently active global theme's primary -->
    <VApp :style="`--v-global-theme-primary: ${hexToRgb(global.current.value.colors.primary)}`">
      <RouterView />
      <ScrollToTop />
    </VApp>
  </VLocaleProvider>
</template>
