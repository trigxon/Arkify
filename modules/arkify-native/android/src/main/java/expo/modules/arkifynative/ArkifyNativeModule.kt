package expo.modules.arkifynative

import android.media.AudioManager
import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.os.Build
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.exceptions.AccountTerminatedException
import org.schabi.newpipe.extractor.exceptions.AgeRestrictedContentException
import org.schabi.newpipe.extractor.exceptions.ContentNotAvailableException
import org.schabi.newpipe.extractor.exceptions.ContentNotSupportedException
import org.schabi.newpipe.extractor.exceptions.ExtractionException
import org.schabi.newpipe.extractor.exceptions.GeographicRestrictionException
import org.schabi.newpipe.extractor.exceptions.PaidContentException
import org.schabi.newpipe.extractor.exceptions.PrivateContentException
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import org.schabi.newpipe.extractor.exceptions.SignInConfirmNotBotException
import org.schabi.newpipe.extractor.exceptions.YoutubeMusicPremiumContentException
import org.schabi.newpipe.extractor.localization.ContentCountry
import org.schabi.newpipe.extractor.localization.Localization
import org.schabi.newpipe.extractor.stream.AudioStream
import org.schabi.newpipe.extractor.stream.DeliveryMethod
import org.schabi.newpipe.extractor.stream.StreamInfo
import org.schabi.newpipe.extractor.stream.StreamType
import java.io.IOException

/**
 * Arkify's Android-only native surface.
 *
 * Exposed to JavaScript: a platform probe, a single stream-resolution call,
 * and the audio effects surface (equalizer + bass boost). The NewPipe
 * Extractor API itself is deliberately NOT bridged -- JS receives a small
 * normalized record and nothing else.
 *
 * Every failure is returned as a structured `{ ok: false, reason, message }`
 * value rather than thrown, so a failed extraction can never take down the
 * React Native runtime.
 */
class ArkifyNativeModule : Module() {

  private companion object {
    /** Guards one-time NewPipe.init across concurrent resolves. */
    val initLock = Any()

    @Volatile
    var initialized = false

    /**
     * Session 0 is the global output mix. Attaching effects there shapes the
     * app's own playback without needing expo-audio's internal session id.
     */
    const val OUTPUT_SESSION = 0
  }

  /** Lazily created effects. Created on first use, released with the module. */
  private var equalizer: Equalizer? = null
  private var bassBoost: BassBoost? = null
  private val fxLock = Any()

  override fun definition() = ModuleDefinition {
    Name("ArkifyNative")

    OnDestroy {
      synchronized(fxLock) {
        runCatching { equalizer?.enabled = false }
        runCatching { equalizer?.release() }
        runCatching { bassBoost?.enabled = false }
        runCatching { bassBoost?.release() }
        equalizer = null
        bassBoost = null
      }
    }

    Function("getPlatformInfo") {
      return@Function mapOf(
        "platform" to "android",
        "native" to true,
        "androidSdkInt" to Build.VERSION.SDK_INT
      )
    }

    // AsyncFunction runs off the JS thread, which is required here: extraction
    // performs several blocking network round-trips.
    AsyncFunction("resolveYouTubeStream") { videoId: String ->
      resolveYouTubeStream(videoId)
    }

    // ---- Audio effects (equalizer + bass boost) ---------------------------

    Function("getAudioFxInfo") {
      val eq = ensureEqualizer() ?: return@Function mapOf("supported" to false)
      val bands = eq.numberOfBands.toInt()
      val range = eq.bandLevelRange
      return@Function mapOf(
        "supported" to true,
        "bandCount" to bands,
        "minLevel" to range[0],
        "maxLevel" to range[1],
        "centerFreqs" to (0 until bands).map { eq.getCenterFreq(it.toShort()) },
        "enabled" to eq.enabled
      )
    }

    /**
     * Apply a full equalizer shape in one call.
     * `levels` are milli-Bel per band, within [minLevel, maxLevel].
     */
    Function("setEqualizerLevels") { levels: List<Double> ->
      val eq = ensureEqualizer()
        ?: return@Function mapOf("ok" to false, "message" to "Equalizer unavailable")
      try {
        val bandCount = eq.numberOfBands.toInt()
        for (i in 0 until minOf(bandCount, levels.size)) {
          eq.setBandLevel(i.toShort(), levels[i].toInt().toShort())
        }
        mapOf("ok" to true)
      } catch (e: Exception) {
        mapOf("ok" to false, "message" to (e.message ?: "setEqualizerLevels failed"))
      }
    }

    Function("setEqualizerEnabled") { enabled: Boolean ->
      val eq = ensureEqualizer()
        ?: return@Function mapOf("ok" to false, "message" to "Equalizer unavailable")
      try {
        eq.enabled = enabled
        mapOf("ok" to true)
      } catch (e: Exception) {
        mapOf("ok" to false, "message" to (e.message ?: "setEqualizerEnabled failed"))
      }
    }

    /** strength: 0..1000 (maps to per-mille bass boost). */
    Function("setBassBoost") { strength: Double ->
      val boost = ensureBassBoost()
        ?: return@Function mapOf("ok" to false, "message" to "BassBoost unavailable")
      try {
        // BassBoost exposes setStrength() but no matching getter, so Kotlin
        // cannot synthesise a `.strength` property -- call the setter directly.
        boost.setStrength(strength.toInt().coerceIn(0, 1000).toShort())
        boost.enabled = strength > 0
        mapOf("ok" to true)
      } catch (e: Exception) {
        mapOf("ok" to false, "message" to (e.message ?: "setBassBoost failed"))
      }
    }
  }

  private fun ensureEqualizer(): Equalizer? = synchronized(fxLock) {
    if (equalizer == null) {
      equalizer = try {
        Equalizer(0, OUTPUT_SESSION)
      } catch (e: Exception) {
        null // device refuses global-session effects
      }
    }
    equalizer
  }

  private fun ensureBassBoost(): BassBoost? = synchronized(fxLock) {
    if (bassBoost == null) {
      bassBoost = try {
        BassBoost(0, OUTPUT_SESSION)
      } catch (e: Exception) {
        null
      }
    }
    bassBoost
  }

  private fun ensureInitialized() {
    if (initialized) return
    synchronized(initLock) {
      if (initialized) return
      NewPipe.init(
        ArkifyNativeDownloader(),
        Localization("en", "US"),
        ContentCountry("US")
      )
      initialized = true
    }
  }

  private fun resolveYouTubeStream(videoId: String): Map<String, Any?> {
    if (videoId.isBlank()) {
      return failure("invalid_id", "No video id supplied")
    }

    return try {
      ensureInitialized()

      val url = "https://www.youtube.com/watch?v=$videoId"
      val info = StreamInfo.getInfo(ServiceList.YouTube, url)

      when (info.streamType) {
        StreamType.LIVE_STREAM,
        StreamType.AUDIO_LIVE_STREAM ->
          return failure("live_stream", "Live streams are not supported yet")
        StreamType.NONE ->
          return failure("unsupported", "No playable stream for this item")
        else -> Unit
      }

      val best = bestProgressiveAudio(info.audioStreams)
        ?: return failure(
          "no_audio_stream",
          "No progressive audio stream available for this track"
        )

      mapOf(
        "ok" to true,
        "url" to best.content,
        "mimeType" to best.format?.mimeType,
        "bitrate" to best.averageBitrate,
        "durationSeconds" to info.duration,
        "title" to info.name,
        "uploader" to info.uploaderName,
        "streamType" to info.streamType.name,
        "extractor" to "NewPipeExtractor/v0.26.5",
        // googlevideo ties a stream URL to the client that asked for it, so the
        // player has to fetch it with the same User-Agent or it gets a 403.
        "userAgent" to ArkifyNativeDownloader.USER_AGENT
      )
    } catch (e: Throwable) {
      classify(e)
    }
  }

  /**
   * expo-audio plays progressive HTTP sources. DASH/HLS entries would resolve
   * fine here but fail at playback, so they are filtered out rather than
   * handed to the player.
   */
  private fun bestProgressiveAudio(streams: List<AudioStream>?): AudioStream? =
    streams
      ?.filter { it.deliveryMethod == DeliveryMethod.PROGRESSIVE_HTTP }
      ?.filter { it.isUrl && !it.content.isNullOrBlank() }
      ?.maxByOrNull { it.averageBitrate }

  /**
   * Map extractor and transport failures onto a small closed set of reasons the
   * TypeScript layer converts into Arkify's existing AppError kinds.
   *
   * The original message is always carried through -- nothing is swallowed.
   */
  private fun classify(e: Throwable): Map<String, Any?> {
    val message = e.message ?: e.javaClass.simpleName

    val reason = when (e) {
      is GeographicRestrictionException -> "geo_restricted"
      is AgeRestrictedContentException -> "age_restricted"
      is PaidContentException,
      is YoutubeMusicPremiumContentException -> "paid_content"
      is PrivateContentException -> "private_content"
      is AccountTerminatedException -> "unavailable"
      is SignInConfirmNotBotException -> "sign_in_required"
      is ReCaptchaException -> "rate_limited"
      is ContentNotSupportedException -> "unsupported"
      is ContentNotAvailableException -> "unavailable"
      is ExtractionException -> "extraction_failed"
      is IOException -> "network"
      else -> "unknown"
    }

    return failure(reason, message, e.javaClass.name)
  }

  private fun failure(reason: String, message: String, exception: String? = null) =
    mapOf(
      "ok" to false,
      "reason" to reason,
      "message" to message,
      "exception" to exception
    )
}
