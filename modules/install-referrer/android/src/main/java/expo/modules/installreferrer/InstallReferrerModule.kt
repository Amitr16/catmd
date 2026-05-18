/*
 * Install Referrer — Expo module.
 *
 * Wraps Google's Play Install Referrer SDK so JS can fetch the
 * install-source URL set by the channel that initiated the install:
 *   - Google Play organic (utm_source=google-play-organic by convention)
 *   - Google Ads (utm_source=...&utm_campaign=...)
 *   - Direct ?referrer= links pointed at the Play Store
 *
 * The SDK opens a one-shot connection to a service in Google Play
 * Services, fetches the referrer payload, and disconnects. We mirror
 * that lifecycle on every call (no long-lived client) since callers
 * gate at the JS layer with an AsyncStorage flag — exactly one fetch
 * per install in practice.
 *
 * Failure paths return Promise rejections; JS-side `getReferrerDetails`
 * catches and returns null. Caller defaults `utm_source` to 'organic'.
 */
package expo.modules.installreferrer

import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class InstallReferrerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("InstallReferrer")

    AsyncFunction("getReferrerDetails") { promise: Promise ->
      val context = appContext.reactContext
        ?: return@AsyncFunction promise.reject(
          CodedException("ERR_NO_CONTEXT", "Application context unavailable", null)
        )

      val client = InstallReferrerClient.newBuilder(context).build()

      // Guard so the listener can't double-resolve if the service flaps
      // (disconnect + reconnect during the same call). The native SDK
      // is async with no built-in dedup.
      var settled = false

      client.startConnection(object : InstallReferrerStateListener {
        override fun onInstallReferrerSetupFinished(responseCode: Int) {
          if (settled) return
          settled = true
          try {
            when (responseCode) {
              InstallReferrerClient.InstallReferrerResponse.OK -> {
                val response = client.installReferrer
                val result = mapOf(
                  "referrerUrl" to (response.installReferrer ?: ""),
                  "referrerClickTimestamp" to response.referrerClickTimestampSeconds,
                  "installBeginTimestamp" to response.installBeginTimestampSeconds,
                  "googlePlayInstantParam" to response.googlePlayInstantParam,
                )
                promise.resolve(result)
              }
              InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED -> {
                promise.reject(
                  CodedException(
                    "ERR_FEATURE_NOT_SUPPORTED",
                    "Install referrer feature not supported on this device.",
                    null,
                  ),
                )
              }
              InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE -> {
                promise.reject(
                  CodedException(
                    "ERR_SERVICE_UNAVAILABLE",
                    "Play services unavailable — referrer cannot be fetched right now.",
                    null,
                  ),
                )
              }
              else -> {
                promise.reject(
                  CodedException(
                    "ERR_UNKNOWN_RESPONSE",
                    "Install referrer setup returned unexpected code: $responseCode",
                    null,
                  ),
                )
              }
            }
          } catch (e: Exception) {
            promise.reject(
              CodedException("ERR_EXCEPTION", e.message ?: "unknown exception", e),
            )
          } finally {
            // Always close — leaking the binding wastes a Play Services
            // socket and slows subsequent installs of other apps.
            try {
              client.endConnection()
            } catch (_: Exception) {
              // Ignore — we already resolved/rejected.
            }
          }
        }

        override fun onInstallReferrerServiceDisconnected() {
          // The service can drop mid-call. Pre-fix (audit P1-1 2026-05-16)
          // the JS-side `withTimeout` would unblock the JS promise after
          // 2s but the native side never resolved/rejected — leaking the
          // InstallReferrerClient binding (one Play Services socket per
          // unlucky install). Now: if we get disconnected before
          // `onInstallReferrerSetupFinished`, settle the promise as a
          // SERVICE_DISCONNECTED rejection AND endConnection() the client.
          // The `settled` flag prevents double-settling against the OK
          // path if the service reconnects + finishes after we've
          // already rejected.
          if (settled) return
          settled = true
          try {
            promise.reject(
              CodedException(
                "ERR_SERVICE_DISCONNECTED",
                "Install referrer service disconnected before setup completed.",
                null,
              ),
            )
          } finally {
            try {
              client.endConnection()
            } catch (_: Exception) {
              // Best-effort close.
            }
          }
        }
      })
    }
  }
}
