package com.example.arkify.playback

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.PowerManager
import com.example.arkify.data.remote.MusicApiService
import com.example.arkify.data.repository.MusicRepository
import com.example.arkify.model.PlaybackState
import com.example.arkify.model.RepeatMode
import com.example.arkify.model.Track
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MusicPlayerManager(
    private val context: Context,
    private val repository: MusicRepository,
    private val apiService: MusicApiService
) {
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private var mediaPlayer: MediaPlayer? = null
    private var progressJob: Job? = null
    private var sleepTimerJob: Job? = null

    private val _playbackState = MutableStateFlow(PlaybackState())
    val playbackState: StateFlow<PlaybackState> = _playbackState.asStateFlow()

    private var originalQueue: List<Track> = emptyList()

    init {
        initMediaPlayer()
    }

    private fun initMediaPlayer() {
        mediaPlayer?.release()
        mediaPlayer = MediaPlayer().apply {
            setWakeMode(context, PowerManager.PARTIAL_WAKE_LOCK)
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .build()
            )
            setOnPreparedListener { mp ->
                mp.start()
                _playbackState.update {
                    it.copy(
                        isPlaying = true,
                        isLoading = false,
                        durationMs = mp.duration.toLong(),
                        errorMessage = null
                    )
                }
                startProgressTracker()
            }
            setOnCompletionListener {
                handleTrackCompletion()
            }
            setOnErrorListener { _, what, extra ->
                _playbackState.update {
                    it.copy(
                        isPlaying = false,
                        isLoading = false,
                        errorMessage = "Playback error ($what, $extra)"
                    )
                }
                stopProgressTracker()
                true
            }
        }
    }

    fun playTrack(track: Track, newQueue: List<Track>? = null) {
        scope.launch {
            if (newQueue != null) {
                originalQueue = newQueue
                val queueToUse = if (_playbackState.value.isShuffled) {
                    val rest = newQueue.filter { it.id != track.id }.shuffled()
                    listOf(track) + rest
                } else {
                    newQueue
                }
                val index = queueToUse.indexOfFirst { it.id == track.id }.coerceAtLeast(0)
                _playbackState.update {
                    it.copy(
                        queue = queueToUse,
                        queueIndex = index,
                        currentTrack = track,
                        isLoading = true,
                        errorMessage = null
                    )
                }
            } else {
                val currentQueue = _playbackState.value.queue
                val index = currentQueue.indexOfFirst { it.id == track.id }
                val updatedQueue = if (index >= 0) currentQueue else currentQueue + track
                val newIndex = if (index >= 0) index else updatedQueue.lastIndex
                _playbackState.update {
                    it.copy(
                        queue = updatedQueue,
                        queueIndex = newIndex,
                        currentTrack = track,
                        isLoading = true,
                        errorMessage = null
                    )
                }
            }

            // Save to history in Room DB
            repository.addToHistory(track)

            loadAndPlayAudio(track)
        }
    }

    private suspend fun loadAndPlayAudio(track: Track) {
        try {
            val audioUrl = if (!track.audioUrl.isNullOrBlank()) {
                track.audioUrl
            } else {
                apiService.resolveAudioStream(track)
            }

            withContext(Dispatchers.Main) {
                mediaPlayer?.reset()
                mediaPlayer?.setDataSource(audioUrl)
                mediaPlayer?.prepareAsync()
            }
        } catch (e: Exception) {
            _playbackState.update {
                it.copy(
                    isLoading = false,
                    isPlaying = false,
                    errorMessage = e.message ?: "Failed to load audio"
                )
            }
        }
    }

    fun togglePlayPause() {
        val player = mediaPlayer ?: return
        val currentTrack = _playbackState.value.currentTrack

        if (currentTrack == null && _playbackState.value.queue.isNotEmpty()) {
            playTrack(_playbackState.value.queue.first())
            return
        }

        if (player.isPlaying) {
            player.pause()
            _playbackState.update { it.copy(isPlaying = false) }
            stopProgressTracker()
        } else {
            player.start()
            _playbackState.update { it.copy(isPlaying = true) }
            startProgressTracker()
        }
    }

    fun skipNext() {
        val state = _playbackState.value
        if (state.queue.isEmpty()) return

        val nextIndex = if (state.queueIndex + 1 < state.queue.size) {
            state.queueIndex + 1
        } else {
            if (state.repeatMode == RepeatMode.ALL) 0 else return
        }

        val nextTrack = state.queue[nextIndex]
        _playbackState.update {
            it.copy(
                queueIndex = nextIndex,
                currentTrack = nextTrack,
                isLoading = true,
                errorMessage = null
            )
        }
        scope.launch {
            repository.addToHistory(nextTrack)
            loadAndPlayAudio(nextTrack)
        }
    }

    fun skipPrevious() {
        val state = _playbackState.value
        if (state.queue.isEmpty()) return

        // If played more than 3 seconds, seek to beginning of current track
        val player = mediaPlayer
        if (player != null && player.currentPosition > 3000) {
            seekTo(0)
            return
        }

        val prevIndex = if (state.queueIndex - 1 >= 0) {
            state.queueIndex - 1
        } else {
            if (state.repeatMode == RepeatMode.ALL) state.queue.lastIndex else 0
        }

        val prevTrack = state.queue[prevIndex]
        _playbackState.update {
            it.copy(
                queueIndex = prevIndex,
                currentTrack = prevTrack,
                isLoading = true,
                errorMessage = null
            )
        }
        scope.launch {
            repository.addToHistory(prevTrack)
            loadAndPlayAudio(prevTrack)
        }
    }

    fun seekTo(positionMs: Long) {
        mediaPlayer?.seekTo(positionMs.toInt())
        _playbackState.update { it.copy(positionMs = positionMs) }
    }

    fun toggleShuffle() {
        val state = _playbackState.value
        val newShuffle = !state.isShuffled
        val currentTrack = state.currentTrack

        if (newShuffle) {
            val otherTracks = state.queue.filter { it.id != currentTrack?.id }.shuffled()
            val newQueue = if (currentTrack != null) listOf(currentTrack) + otherTracks else otherTracks
            _playbackState.update {
                it.copy(isShuffled = true, queue = newQueue, queueIndex = 0)
            }
        } else {
            val index = originalQueue.indexOfFirst { it.id == currentTrack?.id }.coerceAtLeast(0)
            _playbackState.update {
                it.copy(isShuffled = false, queue = originalQueue, queueIndex = index)
            }
        }
    }

    fun cycleRepeatMode() {
        _playbackState.update {
            val nextMode = when (it.repeatMode) {
                RepeatMode.OFF -> RepeatMode.ALL
                RepeatMode.ALL -> RepeatMode.ONE
                RepeatMode.ONE -> RepeatMode.OFF
            }
            it.copy(repeatMode = nextMode)
        }
    }

    fun setSleepTimer(minutes: Int) {
        sleepTimerJob?.cancel()
        if (minutes <= 0) {
            _playbackState.update { it.copy(sleepTimerMinutesRemaining = null) }
            return
        }

        _playbackState.update { it.copy(sleepTimerMinutesRemaining = minutes) }

        sleepTimerJob = scope.launch {
            var remaining = minutes
            while (remaining > 0 && isActive) {
                delay(60_000L)
                remaining--
                _playbackState.update { it.copy(sleepTimerMinutesRemaining = if (remaining > 0) remaining else null) }
            }
            // Stop playback on expiration
            mediaPlayer?.pause()
            _playbackState.update { it.copy(isPlaying = false, sleepTimerMinutesRemaining = null) }
            stopProgressTracker()
        }
    }

    fun addToQueue(track: Track) {
        _playbackState.update {
            it.copy(queue = it.queue + track)
        }
    }

    fun removeFromQueue(trackId: String) {
        _playbackState.update {
            val updated = it.queue.filter { trk -> trk.id != trackId }
            it.copy(queue = updated)
        }
    }

    fun clearQueue() {
        _playbackState.update {
            val current = it.currentTrack
            it.copy(
                queue = if (current != null) listOf(current) else emptyList(),
                queueIndex = if (current != null) 0 else -1
            )
        }
    }

    private fun handleTrackCompletion() {
        val state = _playbackState.value
        when (state.repeatMode) {
            RepeatMode.ONE -> {
                seekTo(0)
                mediaPlayer?.start()
                _playbackState.update { it.copy(isPlaying = true) }
            }
            RepeatMode.ALL -> {
                skipNext()
            }
            RepeatMode.OFF -> {
                if (state.queueIndex + 1 < state.queue.size) {
                    skipNext()
                } else {
                    _playbackState.update { it.copy(isPlaying = false, positionMs = 0) }
                    stopProgressTracker()
                }
            }
        }
    }

    private fun startProgressTracker() {
        progressJob?.cancel()
        progressJob = scope.launch {
            while (isActive) {
                mediaPlayer?.let { player ->
                    if (player.isPlaying) {
                        _playbackState.update {
                            it.copy(
                                positionMs = player.currentPosition.toLong(),
                                durationMs = player.duration.toLong()
                            )
                        }
                    }
                }
                delay(400L)
            }
        }
    }

    private fun stopProgressTracker() {
        progressJob?.cancel()
        progressJob = null
    }

    fun release() {
        stopProgressTracker()
        sleepTimerJob?.cancel()
        mediaPlayer?.release()
        mediaPlayer = null
    }
}
