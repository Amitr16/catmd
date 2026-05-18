// Minimal Node loader for fixture tests (audit 2026-05-14 round 9).
// Stubs out React-Native-only modules (expo-*, react-native, @react-
// native-async-storage) so we can import .ts source files that
// transitively depend on them. Only used by scripts/test-*.mjs.
//
// Strategy: when a specifier looks like an RN/Expo module, return an
// empty-object module instead of resolving. Tests that don't actually
// USE the native functionality won't notice.

const NATIVE_PREFIXES = [
  'expo-',
  '@expo/',
  'expo/',
  '@react-native-',
  'react-native',
  'react-native/',
  'react-native-',
  '@react-navigation/',
  'phosphor-react-native',
];

/** Per-spec cache so we issue the same stub URL each time. */
const STUB_DATA_URL =
  'data:text/javascript;base64,' +
  // eslint-disable-next-line no-undef -- Buffer is a Node global
  Buffer.from(
    `export default {};
export const __isStub = true;
const handler = { get: () => () => ({}) };
export const Platform = new Proxy({ OS: 'web' }, handler);
export const StyleSheet = { create: (s) => s };
export const View = () => null;
export const Text = () => null;
export const ActivityIndicator = () => null;
export const Pressable = () => null;
export const ScrollView = () => null;
export const TextInput = () => null;
export const Image = () => null;
export const Alert = { alert: () => {} };
export const Linking = { openURL: async () => {}, canOpenURL: async () => false };
export const Share = { share: async () => ({}) };
export const Dimensions = { get: () => ({ width: 360, height: 800 }) };
export const Animated = new Proxy({}, handler);
export const AsyncStorage = { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };
export const FileSystem = { readAsStringAsync: async () => '', EncodingType: { Base64: 'base64' } };
export const EncodingType = { Base64: 'base64' };
export function readAsStringAsync() { return Promise.resolve(''); }
export function useEffect() {}
export function useState(v) { return [v, () => {}]; }
export function useMemo(fn) { return fn(); }
export function useRef(v) { return { current: v }; }
export function useCallback(fn) { return fn; }`,
  ).toString('base64');

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export function resolve(specifier, context, nextResolve) {
  if (NATIVE_PREFIXES.some((p) => specifier.startsWith(p))) {
    return {
      url: STUB_DATA_URL,
      shortCircuit: true,
      format: 'module',
    };
  }

  // Pre-resolve extensionless relative TS imports BEFORE calling
  // nextResolve (which throws asynchronously inside the worker
  // thread; the try/catch can't catch that). Node's strip-types
  // handles file CONTENT but not extensionless resolution.
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    // Skip if already has a recognised extension
    const hasExt = /\.[a-z0-9]+$/i.test(specifier.split('/').pop() ?? '');
    if (!hasExt) {
      const parentURL = context.parentURL ?? pathToFileURL(process.cwd() + '/').href;
      const parentPath = fileURLToPath(parentURL);
      const parentDir = path.dirname(parentPath);
      const base = path.resolve(parentDir, specifier);
      for (const ext of ['.ts', '.tsx', '.mts', '.js', '.mjs']) {
        const candidate = base + ext;
        if (existsSync(candidate)) {
          return {
            url: pathToFileURL(candidate).href,
            shortCircuit: true,
            format: 'module',
          };
        }
      }
      for (const ext of ['/index.ts', '/index.tsx']) {
        const candidate = base + ext;
        if (existsSync(candidate)) {
          return {
            url: pathToFileURL(candidate).href,
            shortCircuit: true,
            format: 'module',
          };
        }
      }
    }
  }

  return nextResolve(specifier, context);
}
