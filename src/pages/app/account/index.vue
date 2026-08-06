<script setup>
definePage({
  meta: {
    action: 'read',
    subject: 'Auth',
  },
})

const route = useRoute()
const userData = useCookie('userData')

const activeTab = computed(() => (route.query.tab === 'settings' ? 'settings' : 'profile'))

const roleLabels = {
  'super-admin': 'Super administrateur',
  'admin': 'Administrateur',
  'organizer-manager': 'Organisateur',
  'participant': 'Participant',
}

const user = computed(() => userData.value ?? {})
const roleLabel = computed(() => roleLabels[user.value.role] ?? user.value.role ?? '—')

const infoRows = computed(() => [
  { icon: 'tabler-user', label: 'Nom complet', value: user.value.fullName || `${user.value.firstName ?? ''} ${user.value.lastName ?? ''}`.trim() || '—' },
  { icon: 'tabler-mail', label: 'Email', value: user.value.email ?? '—' },
  { icon: 'tabler-phone', label: 'Téléphone', value: user.value.phone ?? '—' },
  { icon: 'tabler-shield-lock', label: 'Rôle', value: roleLabel.value },
])
</script>

<template>
  <div>
    <VCard>
      <VTabs :model-value="activeTab">
        <VTab
          value="profile"
          :to="{ query: { tab: 'profile' } }"
        >
          <VIcon
            start
            icon="tabler-user"
          />
          Profil
        </VTab>
        <VTab
          value="settings"
          :to="{ query: { tab: 'settings' } }"
        >
          <VIcon
            start
            icon="tabler-settings"
          />
          Paramètres
        </VTab>
      </VTabs>

      <VDivider />

      <VWindow :model-value="activeTab">
        <!-- Profil -->
        <VWindowItem value="profile">
          <VCardText>
            <div class="d-flex align-center gap-4 mb-6">
              <VAvatar
                size="72"
                color="primary"
                variant="tonal"
              >
                <VIcon
                  icon="tabler-user"
                  size="40"
                />
              </VAvatar>
              <div>
                <h2 class="text-h5 font-weight-medium">
                  {{ user.fullName ?? 'Mon compte' }}
                </h2>
                <VChip
                  color="primary"
                  size="small"
                  variant="tonal"
                >
                  {{ roleLabel }}
                </VChip>
              </div>
            </div>

            <VList lines="two">
              <VListItem
                v-for="row in infoRows"
                :key="row.label"
              >
                <template #prepend>
                  <VAvatar
                    variant="tonal"
                    color="secondary"
                    rounded
                  >
                    <VIcon :icon="row.icon" />
                  </VAvatar>
                </template>
                <VListItemTitle class="text-medium-emphasis text-caption">
                  {{ row.label }}
                </VListItemTitle>
                <VListItemSubtitle class="text-body-1 text-high-emphasis">
                  {{ row.value }}
                </VListItemSubtitle>
              </VListItem>
            </VList>
          </VCardText>
        </VWindowItem>

        <!-- Paramètres -->
        <VWindowItem value="settings">
          <VCardText>
            <VAlert
              type="info"
              variant="tonal"
              class="mb-0"
            >
              La gestion des paramètres du compte sera bientôt disponible.
            </VAlert>
          </VCardText>
        </VWindowItem>
      </VWindow>
    </VCard>
  </div>
</template>
