<script setup>
import navItems from '@/navigation/vertical'
import { themeConfig } from '@themeConfig'

// Components
import Footer from '@/layouts/components/Footer.vue'
import NavBarNotifications from '@/layouts/components/NavBarNotifications.vue'
import NavSearchBar from '@/layouts/components/NavSearchBar.vue'
import NavbarThemeSwitcher from '@/layouts/components/NavbarThemeSwitcher.vue'
import UserProfile from '@/layouts/components/UserProfile.vue'
import NavBarI18n from '@core/components/I18n.vue'

// @layouts plugin
import { VerticalNavLayout } from '@layouts'
import { setupRealtime } from '@/composables/realtime'

// ─── Real-time (Pusher) global toasts for organizers & events ───────────────
const rtSnackbar = ref(false)
const rtText = ref('')
const rtColor = ref('primary')

const rtMessages = {
  organizers: {
    created: p => `Nouvel organisateur : ${p.label ?? ''}`.trim(),
    updated: p => `Organisateur mis à jour : ${p.label ?? ''}`.trim(),
    deleted: () => 'Un organisateur a été supprimé.',
  },
  events: {
    created: p => `Nouvel événement : ${p.label ?? ''}`.trim(),
    updated: p => `Événement mis à jour : ${p.label ?? ''}`.trim(),
    deleted: () => 'Un événement a été supprimé.',
  },
}

const notifyRealtime = (channel, payload) => {
  const build = rtMessages[channel]?.[payload?.action]
  rtText.value = build ? build(payload) : 'Mise à jour en temps réel.'
  rtColor.value = channel === 'organizers' ? 'primary' : 'info'
  rtSnackbar.value = true
}

onMounted(() => {
  const accessToken = useCookie('accessToken')
  if (accessToken.value)
    setupRealtime(notifyRealtime)
})
</script>

<template>
  <VerticalNavLayout :nav-items="navItems">
    <!-- 👉 navbar -->
    <template #navbar="{ toggleVerticalOverlayNavActive }">
      <div class="d-flex h-100 align-center">
        <IconBtn
          id="vertical-nav-toggle-btn"
          class="ms-n3 d-lg-none"
          @click="toggleVerticalOverlayNavActive(true)"
        >
          <VIcon
            size="26"
            icon="tabler-menu-2"
          />
        </IconBtn>

        <NavSearchBar class="ms-lg-n3" />

        <VSpacer />

        <NavBarI18n
          v-if="themeConfig.app.i18n.enable && themeConfig.app.i18n.langConfig?.length"
          :languages="themeConfig.app.i18n.langConfig"
        />
        <NavbarThemeSwitcher />
        <NavBarNotifications class="me-1" />
        <UserProfile />
      </div>
    </template>

    <!-- 👉 Pages -->
    <slot />

    <!-- 👉 Footer -->
    <template #footer>
      <Footer />
    </template>

    <!-- 👉 Customizer -->
    <TheCustomizer />

    <!-- 👉 Real-time toast (organizers & events), visible on any page -->
    <VSnackbar
      v-model="rtSnackbar"
      :color="rtColor"
      location="top end"
      :timeout="5000"
      max-width="400"
    >
      <VIcon
        icon="tabler-bell-ringing"
        class="me-2"
      />
      {{ rtText }}
    </VSnackbar>
  </VerticalNavLayout>
</template>
