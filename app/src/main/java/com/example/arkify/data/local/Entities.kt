package com.example.arkify.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.example.arkify.model.Artist
import com.example.arkify.model.Track

@Entity(tableName = "liked_tracks")
data class LikedTrackEntity(
    @PrimaryKey val id: String,
    val title: String,
    val artistName: String,
    val artistId: String,
    val albumImageUrl: String,
    val duration: Long,
    val audioUrl: String?,
    val sourceId: String,
    val likedAt: Long = System.currentTimeMillis()
) {
    fun toTrack(): Track = Track(
        id = id,
        title = title,
        artist = Artist(id = artistId, name = artistName),
        albumImageUrl = albumImageUrl,
        duration = duration,
        audioUrl = audioUrl,
        sourceId = sourceId
    )

    companion object {
        fun fromTrack(track: Track): LikedTrackEntity = LikedTrackEntity(
            id = track.id,
            title = track.title,
            artistName = track.artist.name,
            artistId = track.artist.id,
            albumImageUrl = track.albumImageUrl,
            duration = track.duration,
            audioUrl = track.audioUrl,
            sourceId = track.sourceId
        )
    }
}

@Entity(tableName = "history_tracks")
data class HistoryTrackEntity(
    @PrimaryKey val id: String,
    val title: String,
    val artistName: String,
    val artistId: String,
    val albumImageUrl: String,
    val duration: Long,
    val audioUrl: String?,
    val sourceId: String,
    val playedAt: Long = System.currentTimeMillis()
) {
    fun toTrack(): Track = Track(
        id = id,
        title = title,
        artist = Artist(id = artistId, name = artistName),
        albumImageUrl = albumImageUrl,
        duration = duration,
        audioUrl = audioUrl,
        sourceId = sourceId
    )

    companion object {
        fun fromTrack(track: Track): HistoryTrackEntity = HistoryTrackEntity(
            id = track.id,
            title = track.title,
            artistName = track.artist.name,
            artistId = track.artist.id,
            albumImageUrl = track.albumImageUrl,
            duration = track.duration,
            audioUrl = track.audioUrl,
            sourceId = track.sourceId,
            playedAt = System.currentTimeMillis()
        )
    }
}

@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey val id: String,
    val name: String,
    val description: String = "",
    val creator: String = "You",
    val coverImageUrl: String = "",
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "playlist_tracks",
    primaryKeys = ["playlistId", "trackId"]
)
data class PlaylistTrackEntity(
    val playlistId: String,
    val trackId: String,
    val title: String,
    val artistName: String,
    val artistId: String,
    val albumImageUrl: String,
    val duration: Long,
    val audioUrl: String?,
    val sourceId: String,
    val orderIndex: Int = 0,
    val addedAt: Long = System.currentTimeMillis()
) {
    fun toTrack(): Track = Track(
        id = trackId,
        title = title,
        artist = Artist(id = artistId, name = artistName),
        albumImageUrl = albumImageUrl,
        duration = duration,
        audioUrl = audioUrl,
        sourceId = sourceId
    )

    companion object {
        fun fromTrack(playlistId: String, track: Track, orderIndex: Int): PlaylistTrackEntity = PlaylistTrackEntity(
            playlistId = playlistId,
            trackId = track.id,
            title = track.title,
            artistName = track.artist.name,
            artistId = track.artist.id,
            albumImageUrl = track.albumImageUrl,
            duration = track.duration,
            audioUrl = track.audioUrl,
            sourceId = track.sourceId,
            orderIndex = orderIndex
        )
    }
}

@Entity(tableName = "downloaded_tracks")
data class DownloadedTrackEntity(
    @PrimaryKey val id: String,
    val title: String,
    val artistName: String,
    val artistId: String,
    val albumImageUrl: String,
    val duration: Long,
    val localFilePath: String,
    val sourceId: String,
    val fileSize: Long = 0L,
    val downloadedAt: Long = System.currentTimeMillis()
) {
    fun toTrack(): Track = Track(
        id = id,
        title = title,
        artist = Artist(id = artistId, name = artistName),
        albumImageUrl = albumImageUrl,
        duration = duration,
        audioUrl = localFilePath,
        sourceId = sourceId
    )

    companion object {
        fun fromTrack(track: Track, localFilePath: String, fileSize: Long): DownloadedTrackEntity = DownloadedTrackEntity(
            id = track.id,
            title = track.title,
            artistName = track.artist.name,
            artistId = track.artist.id,
            albumImageUrl = track.albumImageUrl,
            duration = track.duration,
            localFilePath = localFilePath,
            sourceId = track.sourceId,
            fileSize = fileSize
        )
    }
}
