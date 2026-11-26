import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";

const subscriptions = new Map();
const CHANGE_DEBOUNCE_MS = 180;

function publishStatus(entry, status) {
  entry.status = status;
  for (const subscriber of entry.subscribers) {
    subscriber.onStatus(status);
  }
}

function notify(entry, event) {
  for (const subscriber of entry.subscribers) {
    subscriber.onEvent(event);
  }
}

function createSubscription(scopeKey) {
  const entry = {
    subscribers: new Set(),
    status: "connecting",
    hasConnected: false,
    wasDisconnected: false,
    channel: null,
  };
  const channelName = `sync-${scopeKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  entry.channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "microsha_sync_events",
        filter: `scope_key=eq.${scopeKey}`,
      },
      (payload) => {
        if (payload?.new?.scope_key === scopeKey) {
          notify(entry, { type: "change", event: payload.new });
        }
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        const reconnected = entry.hasConnected && entry.wasDisconnected;
        entry.hasConnected = true;
        entry.wasDisconnected = false;
        publishStatus(entry, "connected");
        if (reconnected) notify(entry, { type: "reconnected" });
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        entry.wasDisconnected = true;
        publishStatus(entry, "error");
        return;
      }

      if (status === "CLOSED") {
        entry.wasDisconnected = true;
        publishStatus(entry, "disconnected");
      }
    });

  return entry;
}

function subscribeToModule(groupId, module, subscriber) {
  const scopeKey = `${groupId}:${module}`;
  let entry = subscriptions.get(scopeKey);
  if (!entry) {
    entry = createSubscription(scopeKey);
    subscriptions.set(scopeKey, entry);
  }

  entry.subscribers.add(subscriber);
  subscriber.onStatus(entry.status);

  return () => {
    entry.subscribers.delete(subscriber);
    if (entry.subscribers.size === 0) {
      subscriptions.delete(scopeKey);
      void supabase.removeChannel(entry.channel);
    }
  };
}

export function useRealtimeSync({ groupId, modules, onChange }) {
  const onChangeRef = useRef(onChange);
  const [status, setStatus] = useState("connecting");
  const [syncing, setSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [changed, setChanged] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const moduleKey = Array.isArray(modules) ? modules.join("|") : "";

  onChangeRef.current = onChange;

  useEffect(() => {
    const moduleList = moduleKey ? moduleKey.split("|") : [];
    if (!groupId || moduleList.length === 0) {
      setStatus("disconnected");
      return undefined;
    }

    let active = true;
    const timers = { debounce: null, changed: null };
    const subscribers = moduleList.map(() => ({
      onEvent: null,
      onStatus: null,
    }));

    const pendingEvents = [];
    let pending = false;
    let running = false;
    const requestSync = (event) => {
      pending = true;
      if (event) pendingEvents.push(event);
      if (timers.debounce) {
        window.clearTimeout(timers.debounce);
      }
      timers.debounce = window.setTimeout(async () => {
        if (running || !pending) return;
        running = true;
        setSyncing(true);
        setSyncError(false);
        try {
          while (pending && active) {
            pending = false;
            const events = pendingEvents.splice(0, pendingEvents.length);
            await onChangeRef.current?.(events);
            if (!active) return;
            setLastUpdated(new Date());
            setChanged(true);
            if (timers.changed) {
              window.clearTimeout(timers.changed);
            }
            timers.changed = window.setTimeout(
              () => setChanged(false),
              2200
            );
          }
        } catch {
          if (active) setSyncError(true);
        } finally {
          running = false;
          if (active) setSyncing(false);
        }
      }, CHANGE_DEBOUNCE_MS);
    };

    const subscriptionHandles = moduleList.map((module, index) => {
      const subscriber = subscribers[index];
      subscriber.onEvent = (event) => {
        if (event.type === "reconnected") requestSync(event);
        else if (event.event?.module === module) requestSync(event.event);
      };
      subscriber.onStatus = () => {
        if (!active) return;
        const states = subscribers.map((item) => item.status || "connecting");
        const nextStatus = !window.navigator.onLine
          ? "offline"
          : states.includes("error")
            ? "error"
            : states.every((item) => item === "connected")
              ? "connected"
              : "connecting";
        setStatus(nextStatus);
      };
      const originalOnStatus = subscriber.onStatus;
      subscriber.onStatus = (nextStatus) => {
        subscriber.status = nextStatus;
        originalOnStatus();
      };
      return subscribeToModule(groupId, module, subscriber);
    });

    const handleOffline = () => setStatus("offline");
    const handleOnline = () => {
      setStatus("connecting");
      requestSync({ type: "reconnected" });
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    if (!window.navigator.onLine) setStatus("offline");

    return () => {
      active = false;
      subscriptionHandles.forEach((unsubscribe) => unsubscribe());
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (timers.debounce) window.clearTimeout(timers.debounce);
      if (timers.changed) window.clearTimeout(timers.changed);
    };
  }, [groupId, moduleKey]);

  const markUpdated = useCallback(() => setLastUpdated(new Date()), []);

  return {
    status,
    syncing,
    lastUpdated,
    changed,
    syncError,
    markUpdated,
  };
}
