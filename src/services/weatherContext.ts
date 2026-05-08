/**
 * Weather Context — ambient environmental signal for the cat's voice.
 *
 * Why this exists: when the cat references the world, real weather
 * lands harder than fabricated weather. "It's snowing today — I am
 * not pleased" hits different from "the cup is closer to the edge."
 *
 * The cat's chat / diary prompt now gets a single one-line environmental
 * fact when weather data is available — this fact is added to the
 * factRetrieval pool with the `world_environment` tier so questions
 * about weather/today/outside surface it.
 *
 * Source: Open-Meteo (free, no API key, fair-use license). We pull
 * once per day per device location, cache locally, and serve from
 * cache for subsequent reads. If location permission isn't granted
 * we silently skip — the cat just doesn't reference weather.
 *
 * Design choices:
 *   - Cache TTL: 6 hours. Snow at 9am + sun at 4pm is a real story.
 *   - Round coordinates to 0.1° (~10 km) — privacy + cache hit rate.
 *   - One narrative line, not a JSON blob — the model uses it directly.
 */
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'catmd-weather-cache-v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * The structured weather snapshot. Stored in AsyncStorage and rendered
 * into the chat prompt as a single line via `renderWeatherForPrompt`.
 */
export type WeatherSnapshot = {
  /** Coarse location label, e.g. "outside" — never specific city/coords. */
  location_label: string;
  /** Narrative line for the prompt: "snow today, -2°C". */
  narrative: string;
  /** WMO code from Open-Meteo (0=clear, 51-67=rain, 71-77=snow, etc.) */
  weather_code: number;
  temp_c: number;
  apparent_c: number | null;
  /** Sunrise / sunset times for "morning light" / "evening" framing. */
  sunrise_iso?: string;
  sunset_iso?: string;
  /** When this snapshot was taken. */
  fetched_at: string;
};

/**
 * Map a WMO weather code to a short narrative phrase. Matches the
 * Open-Meteo `weather_code` taxonomy. We collapse fine gradations
 * (light rain vs drizzle) into the 6 buckets the cat would notice.
 */
function narrativeFromCode(code: number): string {
  if (code === 0) return 'clear sky';
  if (code <= 3) return 'partly cloudy';
  if (code === 45 || code === 48) return 'foggy';
  if (code >= 51 && code <= 67) return 'raining';
  if (code >= 71 && code <= 77) return 'snowing';
  if (code >= 80 && code <= 82) return 'rain showers';
  if (code >= 85 && code <= 86) return 'snow showers';
  if (code >= 95) return 'thunderstorm';
  return 'mixed weather';
}

/**
 * Compose the prompt-ready narrative line. e.g.
 *   "snowing outside today (about -2°C, feels colder)"
 */
function buildNarrative(opts: {
  weather_code: number;
  temp_c: number;
  apparent_c: number | null;
}): string {
  const cond = narrativeFromCode(opts.weather_code);
  const temp = `${Math.round(opts.temp_c)}°C`;
  const feel =
    opts.apparent_c != null && Math.abs(opts.apparent_c - opts.temp_c) >= 2
      ? opts.apparent_c < opts.temp_c
        ? ', feels colder'
        : ', feels warmer'
      : '';
  return `${cond} outside today (${temp}${feel})`;
}

type CachedSnapshot = WeatherSnapshot & { cached_at: number };

async function readCache(): Promise<CachedSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSnapshot;
    if (Date.now() - parsed.cached_at > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(snap: WeatherSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...snap, cached_at: Date.now() } as CachedSnapshot),
    );
  } catch {
    // ignore — cache is best-effort
  }
}

/**
 * Fetch fresh weather for the current device location. Returns null on
 * any failure (permission denied, no GPS, network down, parse error).
 * Callers should treat null as "weather unavailable; carry on without it."
 */
async function fetchCurrentWeather(): Promise<WeatherSnapshot | null> {
  try {
    // Permission gate — never auto-prompt; expects caller to have already
    // requested. Returns null if not granted.
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return null;

    const loc = await Location.getLastKnownPositionAsync({
      maxAge: 60 * 60 * 1000, // accept up to 1hr-old cached fix
    });
    if (!loc) return null;

    // Round to 0.1° for privacy + cache-hit rate
    const lat = Math.round(loc.coords.latitude * 10) / 10;
    const lon = Math.round(loc.coords.longitude * 10) / 10;

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code` +
      `&daily=sunrise,sunset` +
      `&timezone=auto`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json() as {
      current?: {
        temperature_2m?: number;
        apparent_temperature?: number;
        weather_code?: number;
      };
      daily?: {
        sunrise?: string[];
        sunset?: string[];
      };
    };
    if (!data.current || data.current.temperature_2m == null) return null;

    const code = data.current.weather_code ?? 0;
    const temp = data.current.temperature_2m;
    const apparent = data.current.apparent_temperature ?? null;

    const snapshot: WeatherSnapshot = {
      location_label: 'outside',
      narrative: buildNarrative({
        weather_code: code,
        temp_c: temp,
        apparent_c: apparent,
      }),
      weather_code: code,
      temp_c: temp,
      apparent_c: apparent,
      sunrise_iso: data.daily?.sunrise?.[0],
      sunset_iso: data.daily?.sunset?.[0],
      fetched_at: new Date().toISOString(),
    };

    void writeCache(snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

/**
 * Public read — returns the most-recent snapshot (cache or fresh fetch).
 *
 * Idempotent + cheap — chat prompt assembly calls this on every reply.
 * Cache hit: synchronous return. Cache miss: triggers a background
 * fetch that won't block this call (callers see null this turn, snapshot
 * next turn). The first cold call on app start will return null.
 */
export async function getWeatherSnapshot(): Promise<WeatherSnapshot | null> {
  const cached = await readCache();
  if (cached) {
    return {
      location_label: cached.location_label,
      narrative: cached.narrative,
      weather_code: cached.weather_code,
      temp_c: cached.temp_c,
      apparent_c: cached.apparent_c,
      sunrise_iso: cached.sunrise_iso,
      sunset_iso: cached.sunset_iso,
      fetched_at: cached.fetched_at,
    };
  }
  return fetchCurrentWeather();
}

/**
 * Synchronous render helper for the chat prompt. Returns either a
 * formatted line OR null if no snapshot is available.
 */
export function renderWeatherForPrompt(snap: WeatherSnapshot | null): string | null {
  if (!snap) return null;
  return snap.narrative;
}

/**
 * Trigger a background refresh — call from app boot or when the user
 * explicitly opens chat. Doesn't block. Cache hit short-circuits.
 */
export function triggerWeatherRefresh(): void {
  void (async () => {
    const cached = await readCache();
    if (cached) return; // fresh enough
    await fetchCurrentWeather();
  })();
}
