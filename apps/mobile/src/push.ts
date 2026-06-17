import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api, type DevicePlatform } from './api';

// Foreground notifications still show a banner/alert.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function platform(): DevicePlatform {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  return 'WEB';
}

/**
 * Requests permission and resolves an Expo push token, or null if unavailable
 * (e.g. simulator, denied permission, or missing EAS projectId). Failures are
 * swallowed so the app keeps working without push.
 */
export async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return data;
  } catch {
    return null;
  }
}

/**
 * Registers this device's push token with the API while signed in, and wires up
 * foreground notification listeners. Best-effort: never throws into the UI.
 */
export function usePushNotifications(enabled: boolean): void {
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const token = await getPushToken();
      if (cancelled || !token) return;
      tokenRef.current = token;
      try {
        await api.registerDevice(platform(), token);
      } catch {
        /* ignore — push is non-critical */
      }
    })();

    const received = Notifications.addNotificationReceivedListener(() => undefined);
    const response = Notifications.addNotificationResponseReceivedListener(() => undefined);

    return () => {
      cancelled = true;
      received.remove();
      response.remove();
    };
  }, [enabled]);
}
