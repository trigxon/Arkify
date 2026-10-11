package com.example.arkify.model

data class Artist(
    val id: String = "",
    val name: String = "Unknown Artist",
    val imageUrl: String? = null
)

data class Track(
    val id: String,
    val title: String,
    val artist: Artist,
    val albumImageUrl: String = "",
    val duration: Long = 0L, // seconds
    val audioUrl: String? = null,
    val provider: String = "youtube",
    val sourceId: String = "",
    val album: String? = null,
    val isExplicit: Boolean = false
)

data class Album(
    val id: String,
    val browseId: String,
    val title: String,
    val artist: String,
    val coverImageUrl: String = "",
    val year: String? = null,
    val trackCount: Int = 0
)

data class RemotePlaylist(
    val id: String,
    val browseId: String,
    val name: String,
    val description: String = "",
    val creator: String = "Arkify",
    val coverImageUrl: String = "",
    val trackCount: Int = 0
)

data class UserPlaylist(
    val id: String,
    val name: String,
    val description: String = "",
    val creator: String = "You",
    val coverImageUrl: String = "",
    val tracks: List<Track> = emptyList(),
    val createdAt: Long = System.currentTimeMillis()
)

data class Category(
    val id: String,
    val name: String,
    val colorHex: String,
    val query: String
)

enum class SearchFilter(val label: String) {
    ALL("All"),
    SONGS("Songs"),
    ARTISTS("Artists"),
    ALBUMS("Albums"),
    PLAYLISTS("Playlists")
}

data class SearchResults(
    val query: String = "",
    val tracks: List<Track> = emptyList(),
    val artists: List<Artist> = emptyList(),
    val albums: List<Album> = emptyList(),
    val playlists: List<RemotePlaylist> = emptyList()
)

data class LyricLine(
    val timeSeconds: Double? = null,
    val text: String
)

data class Lyrics(
    val trackId: String,
    val lines: List<LyricLine>,
    val isSynced: Boolean = false,
    val source: String = "Arkify"
)

enum class RepeatMode {
    OFF,
    ALL,
    ONE
}

data class PlaybackState(
    val currentTrack: Track? = null,
    val isPlaying: Boolean = false,
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val repeatMode: RepeatMode = RepeatMode.OFF,
    val isShuffled: Boolean = false,
    val queue: List<Track> = emptyList(),
    val queueIndex: Int = -1,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val streamQuality: String = "High (160kbps)",
    val sleepTimerMinutesRemaining: Int? = null
)
