<script setup>
import { $api } from '@/utils/api'

// Notifications are scoped to the current user by the backend
// (`$request->user()->notifications()`), so an organizer only ever sees their
// own notifications here.
const notifications = ref([])

const typeColor = type => ({
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
}[type] ?? 'primary')

const formatTime = iso => {
  if (!iso) return ''

  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const mapNotification = n => ({
  id: n.id,
  title: n.data?.title ?? 'Notification',
  subtitle: n.data?.message ?? '',
  time: formatTime(n.created_at),
  isSeen: !!n.read_at,
  color: typeColor(n.data?.type),
  icon: 'tabler-bell',
})

const fetchNotifications = async () => {
  const accessToken = useCookie('accessToken')
  if (!accessToken.value) return

  try {
    const res = await $api('/notifications')
    const list = Array.isArray(res?.data) ? res.data : []
    notifications.value = list.map(mapNotification)
  } catch {
    // silent — the bell just stays empty
  }
}

onMounted(fetchNotifications)

const markRead = async notificationIds => {
  await Promise.all(notificationIds.map(async id => {
    try {
      await $api(`/notifications/${id}/markasread`, { method: 'POST' })
    } catch {
      // ignore individual failures
    }
  }))
  notifications.value.forEach(item => {
    if (notificationIds.includes(item.id))
      item.isSeen = true
  })
}

// The backend only exposes "mark as read"; unread is a local-only toggle.
const markUnRead = notificationIds => {
  notifications.value.forEach(item => {
    if (notificationIds.includes(item.id))
      item.isSeen = false
  })
}

const removeNotification = async notificationId => {
  try {
    await $api(`/notifications/${notificationId}`, { method: 'DELETE' })
  } catch {
    // organizers can't delete server-side — just dismiss locally
  }
  notifications.value = notifications.value.filter(item => item.id !== notificationId)
}

const handleNotificationClick = notification => {
  if (!notification.isSeen)
    markRead([notification.id])
}
</script>

<template>
  <Notifications
    :notifications="notifications"
    @remove="removeNotification"
    @read="markRead"
    @unread="markUnRead"
    @click:notification="handleNotificationClick"
  />
</template>
