import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../lib/api';
import { useArcade } from './arcade';
export const useMessages = defineStore('messages', () => {
  const unread = ref(0),
    pending = ref(0),
    notification = ref(null);
  let generation = 0,
    latest = 0,
    sessionSeen = new Set();
  async function announce(events, userId, current, sequence) {
    if (!events?.length || document.visibilityState !== 'visible') return;
    const key = 'spokemon-mail-alerts:' + userId;
    const check = () => {
      if (current !== generation || sequence !== latest || useArcade().user?.id !== userId || document.visibilityState !== 'visible') return;
      let ids = [];
      try {
        const stored = JSON.parse(localStorage.getItem(key) ?? '[]');
        if (Array.isArray(stored)) ids = stored.filter(id => typeof id === 'string');
      } catch {}
      const seen = new Set([...ids, ...sessionSeen]),
        fresh = events.filter(e => typeof e.id === 'string' && !seen.has(e.id));
      if (!fresh.length) return;
      for (const e of fresh) {
        seen.add(e.id);
        sessionSeen.add(e.id);
      }
      try {
        localStorage.setItem(key, JSON.stringify([...seen].slice(-5000)));
      } catch {}
      notification.value = {
        count: (notification.value?.count ?? 0) + fresh.length,
        kind: fresh[0].kind
      };
    };
    if (navigator.locks?.request) await navigator.locks.request(key, check);else check();
  }
  async function refresh() {
    const userId = useArcade().user?.id;
    if (!userId) return;
    const current = generation,
      sequence = ++latest;
    try {
      const result = await api('/messages/summary');
      if (current === generation && sequence === latest && useArcade().user?.id === userId) {
        unread.value = result.unread;
        pending.value = result.pending;
        if (result.events?.length === 0) notification.value = null;
        await announce(result.events, userId, current, sequence);
      }
    } catch {/* Badge or notification failures must not interrupt gameplay. */}
  }
  function dismiss() {
    notification.value = null;
  }
  function reset() {
    generation++;
    unread.value = 0;
    pending.value = 0;
    notification.value = null;
    sessionSeen = new Set();
  }
  return {
    unread,
    pending,
    notification,
    refresh,
    dismiss,
    reset
  };
});
