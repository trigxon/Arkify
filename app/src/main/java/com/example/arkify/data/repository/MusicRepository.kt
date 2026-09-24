package com.example.arkify.data.repository

import android.content.Context
import com.example.arkify.data.Catalog
import com.example.arkify.data.local.AppDatabase
import com.example.arkify.data.local.DownloadedTrackEntity
import com.example.arkify.data.local.HistoryTrackEntity
import com.example.arkify.data.local.LikedTrackEntity
import com.example.arkify.data.local.PlaylistEntity
import com.example.arkify.data.local.PlaylistTrackEntity
import com.example.arkify.model.Track
import com.example.arkify.model.UserPlaylist
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.URL
import java.util.UUID

class MusicRepository(private val database: AppDatabase, private val context: Context) {
    private val trackDao = database.trackDao()
    private val playlistDao = database.playlistDao()

    val likedTracks: Flow<List<Track>> = trackDao.getLikedTracks()
        .map { list -> list.map { it.toTrack() } }

    val historyTracks: Flow<List<Track>> = trackDao.getHistoryTracks()
        .map { list -> list.map { it.toTrack() } }

    val downloadedTracks: Flow<List<Track>> = trackDao.getDownloadedTracks()
        .map { list -> list.map { it.toTrack() } }

    val playlists: Flow<List<UserPlaylist>> = playlistDao.getPlaylists()
        .map { entities ->
            entities.map { entity ->
                UserPlaylist(
                    id = entity.id,
                    name = entity.name,
                    description = entity.description,
                    creator = entity.creator,
                    coverImageUrl = entity.coverImageUrl,
                    createdAt = entity.createdAt
                )
            }
        }

    fun isTrackLiked(trackId: String): Flow<Boolean> = trackDao.isTrackLiked(trackId)

    fun isTrackDownloaded(trackId: String): Flow<Boolean> = trackDao.isTrackDownloaded(trackId)

    suspend fun toggleLike(track: Track) = withContext(Dispatchers.IO) {
        val isLiked = trackDao.isTrackLiked(track.id).first()
        if (isLiked) {
            trackDao.deleteLikedTrack(track.id)
        } else {
            trackDao.insertLikedTrack(LikedTrackEntity.fromTrack(track))
        }
    }

    suspend fun addToHistory(track: Track) = withContext(Dispatchers.IO) {
        trackDao.insertHistoryTrack(HistoryTrackEntity.fromTrack(track))
    }

    suspend fun clearHistory() = withContext(Dispatchers.IO) {
        trackDao.clearHistory()
    }

    suspend fun createPlaylist(name: String, description: String = ""): String = withContext(Dispatchers.IO) {
        val id = UUID.randomUUID().toString()
        val playlist = PlaylistEntity(
            id = id,
            name = name.ifBlank { "My Playlist" },
            description = description,
            coverImageUrl = Catalog.CURATED_FEATURED_TRACKS.random().albumImageUrl
        )
        playlistDao.insertPlaylist(playlist)
        id
    }

    suspend fun deletePlaylist(playlistId: String) = withContext(Dispatchers.IO) {
        playlistDao.clearPlaylistTracks(playlistId)
        playlistDao.deletePlaylist(playlistId)
    }

    fun getPlaylistTracks(playlistId: String): Flow<List<Track>> {
        return playlistDao.getTracksForPlaylist(playlistId)
            .map { list -> list.map { it.toTrack() } }
    }

    suspend fun addTrackToPlaylist(playlistId: String, track: Track) = withContext(Dispatchers.IO) {
        val entity = PlaylistTrackEntity.fromTrack(playlistId, track, System.currentTimeMillis().toInt())
        playlistDao.insertPlaylistTrack(entity)
    }

    suspend fun removeTrackFromPlaylist(playlistId: String, trackId: String) = withContext(Dispatchers.IO) {
        playlistDao.removeTrackFromPlaylist(playlistId, trackId)
    }

    suspend fun downloadTrack(track: Track): Result<Track> = withContext(Dispatchers.IO) {
        try {
            val audioUrl = track.audioUrl ?: return@withContext Result.failure(Exception("No audio URL"))
            val fileName = "download_${track.id.replace(Regex("[^a-zA-Z0-9_-]"), "_")}.mp3"
            val file = File(context.filesDir, fileName)

            val url = URL(audioUrl)
            url.openStream().use { input ->
                FileOutputStream(file).use { output ->
                    input.copyTo(output)
                }
            }

            val entity = DownloadedTrackEntity.fromTrack(track, file.absolutePath, file.length())
            trackDao.insertDownloadedTrack(entity)
            Result.success(entity.toTrack())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteDownload(trackId: String) = withContext(Dispatchers.IO) {
        trackDao.deleteDownloadedTrack(trackId)
    }
}
