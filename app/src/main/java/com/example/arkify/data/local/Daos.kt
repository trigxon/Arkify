package com.example.arkify.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface TrackDao {
    @Query("SELECT * FROM liked_tracks ORDER BY likedAt DESC")
    fun getLikedTracks(): Flow<List<LikedTrackEntity>>

    @Query("SELECT EXISTS(SELECT 1 FROM liked_tracks WHERE id = :id)")
    fun isTrackLiked(id: String): Flow<Boolean>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLikedTrack(track: LikedTrackEntity)

    @Query("DELETE FROM liked_tracks WHERE id = :id")
    suspend fun deleteLikedTrack(id: String)

    @Query("SELECT * FROM history_tracks ORDER BY playedAt DESC LIMIT 50")
    fun getHistoryTracks(): Flow<List<HistoryTrackEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertHistoryTrack(track: HistoryTrackEntity)

    @Query("DELETE FROM history_tracks")
    suspend fun clearHistory()

    @Query("SELECT * FROM downloaded_tracks ORDER BY downloadedAt DESC")
    fun getDownloadedTracks(): Flow<List<DownloadedTrackEntity>>

    @Query("SELECT EXISTS(SELECT 1 FROM downloaded_tracks WHERE id = :id)")
    fun isTrackDownloaded(id: String): Flow<Boolean>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDownloadedTrack(track: DownloadedTrackEntity)

    @Query("DELETE FROM downloaded_tracks WHERE id = :id")
    suspend fun deleteDownloadedTrack(id: String)
}

@Dao
interface PlaylistDao {
    @Query("SELECT * FROM playlists ORDER BY createdAt DESC")
    fun getPlaylists(): Flow<List<PlaylistEntity>>

    @Query("SELECT * FROM playlists WHERE id = :id")
    suspend fun getPlaylistById(id: String): PlaylistEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylist(playlist: PlaylistEntity)

    @Query("DELETE FROM playlists WHERE id = :id")
    suspend fun deletePlaylist(id: String)

    @Query("SELECT * FROM playlist_tracks WHERE playlistId = :playlistId ORDER BY orderIndex ASC")
    fun getTracksForPlaylist(playlistId: String): Flow<List<PlaylistTrackEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylistTrack(track: PlaylistTrackEntity)

    @Query("DELETE FROM playlist_tracks WHERE playlistId = :playlistId AND trackId = :trackId")
    suspend fun removeTrackFromPlaylist(playlistId: String, trackId: String)

    @Query("DELETE FROM playlist_tracks WHERE playlistId = :playlistId")
    suspend fun clearPlaylistTracks(playlistId: String)
}
