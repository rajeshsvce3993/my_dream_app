import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = '4000';
const DEFAULT_PREFIX = '/api/v1';

const LOOPBACK = new Set(['127.0.0.1', 'localhost']);

function metroLanHost(): string | undefined {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    (Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
      .manifest2?.extra?.expoClient?.hostUri,
  ];
  for (const uri of candidates) {
    if (!uri) continue;
    const host = uri.split(':')[0];
    if (host && !LOOPBACK.has(host)) return host;
  }
  return undefined;
}

function autoHostEnabled(): boolean {
  const flag = process.env.EXPO_PUBLIC_API_AUTO_HOST?.trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'no') return false;
  if (flag === '1' || flag === 'true' || flag === 'yes') return true;
  return __DEV__;
}

function resolveHost(configuredHost: string): string {
  if (!autoHostEnabled() || !LOOPBACK.has(configuredHost)) return configuredHost;
  if (Platform.OS === 'web') return configuredHost;
  const manualLan = process.env.EXPO_PUBLIC_API_LAN_HOST?.trim();
  if (manualLan) return manualLan;
  const lan = metroLanHost();
  if (lan) return lan;
  if (Platform.OS === 'android' && !Constants.isDevice) return '10.0.2.2';
  return configuredHost;
}

export function getApiBaseUrl(): string {
  const full = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (full) return full.replace(/\/+$/, '');
  const configuredHost = process.env.EXPO_PUBLIC_API_HOST?.trim() || DEFAULT_HOST;
  const host = resolveHost(configuredHost);
  const port = process.env.EXPO_PUBLIC_API_PORT?.trim() || DEFAULT_PORT;
  const prefixRaw = process.env.EXPO_PUBLIC_API_PREFIX?.trim() || DEFAULT_PREFIX;
  const prefix = prefixRaw.startsWith('/') ? prefixRaw : `/${prefixRaw}`;
  return `http://${host}:${port}${prefix}`;
}
