package com.example.arkify.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DownloadDone
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.arkify.model.PlaybackState
import com.example.arkify.model.Track
import com.example.arkify.model.UserPlaylist
import com.example.arkify.ui.components.TrackRow
import com.example.arkify.ui.theme.NocturneBackground
import com.example.arkify.ui.theme.NocturneCyan
import com.example.arkify.ui.theme.NocturneSurfaceCard
import com.example.arkify.ui.theme.NocturneSurfaceElevated
import com.example.arkify.ui.theme.TextDark
import com.example.arkify.ui.theme.TextMuted
import com.example.arkify.ui.theme.TextPrimary
import com.example.arkify.ui.theme.TextSecondary

enum class LibraryTab(val label: String) {
    ALL("All"),
    PLAYLISTS("Playlists"),
    LIKED("Liked"),
    DOWNLOADS("Downloads"),
    HISTORY("History")
}

@Composable
fun LibraryScreen(
    likedTracks: List<Track>,
    downloadedTracks: List<Track>,
    historyTracks: List<Track>,
    playlists: List<UserPlaylist>,
    playbackState: PlaybackState,
    onPlayTrack: (Track, List<Track>) -> Unit,
    onLikeToggle: (Track) -> Unit,
    onPlaylistClick: (UserPlaylist) -> Unit,
    onCreatePlaylist: () -> Unit,
    onClearHistory: () -> Unit,
    onAddToPlaylist: (Track) -> Unit,
    onDownload: (Track) -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedTab by remember { mutableStateOf(LibraryTab.ALL) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(NocturneBackground)
            .testTag("library_screen"),
        contentPadding = PaddingValues(bottom = 120.dp)
    ) {
        // Top Header
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Your Library",
                    color = TextPrimary,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold
                )

                IconButton(
                    onClick = onCreatePlaylist,
                    modifier = Modifier
                        .testTag("create_playlist_button")
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(NocturneSurfaceElevated)
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "New Playlist",
                        tint = NocturneCyan
                    )
                }
            }
        }

        // Filter Tabs
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                LibraryTab.values().forEach { tab ->
                    FilterChip(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab },
                        label = { Text(tab.label) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = NocturneCyan,
                            selectedLabelColor = NocturneBackground,
                            containerColor = NocturneSurfaceElevated,
                            labelColor = TextSecondary
                        ),
                        border = null
                    )
                }
            }
            Spacer(modifier = Modifier.height(14.dp))
        }

        // Liked Songs Hero Tile (if tab is ALL or LIKED)
        if (selectedTab == LibraryTab.ALL || selectedTab == LibraryTab.LIKED) {
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 6.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .testTag("liked_songs_card")
                        .clickable {
                            if (likedTracks.isNotEmpty()) {
                                onPlayTrack(likedTracks.first(), likedTracks)
                            }
                        },
                    colors = CardDefaults.cardColors(containerColor = NocturneSurfaceElevated)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                Brush.horizontalGradient(
                                    listOf(Color(0xFF1E3A37), NocturneSurfaceElevated)
                                )
                            )
                            .padding(20.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(56.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(NocturneCyan),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Favorite,
                                    contentDescription = null,
                                    tint = TextDark,
                                    modifier = Modifier.size(28.dp)
                                )
                            }

                            Spacer(modifier = Modifier.width(16.dp))

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Liked Songs",
                                    color = TextPrimary,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "${likedTracks.size} tracks saved",
                                    color = NocturneCyan,
                                    fontSize = 13.sp
                                )
                            }

                            if (likedTracks.isNotEmpty()) {
                                Surface(
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clip(CircleShape),
                                    color = NocturneCyan
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.PlayArrow,
                                        contentDescription = "Play Liked",
                                        tint = TextDark,
                                        modifier = Modifier.padding(8.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Downloaded Songs Card (if tab is ALL or DOWNLOADS)
        if (selectedTab == LibraryTab.ALL || selectedTab == LibraryTab.DOWNLOADS) {
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 6.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .testTag("downloaded_songs_card")
                        .clickable {
                            if (downloadedTracks.isNotEmpty()) {
                                onPlayTrack(downloadedTracks.first(), downloadedTracks)
                            }
                        },
                    colors = CardDefaults.cardColors(containerColor = NocturneSurfaceElevated)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color(0xFF1E2827)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.DownloadDone,
                                contentDescription = null,
                                tint = NocturneCyan,
                                modifier = Modifier.size(28.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(16.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Downloaded Music",
                                color = TextPrimary,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${downloadedTracks.size} offline tracks",
                                color = TextSecondary,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }
        }

        // Playlists
        if (selectedTab == LibraryTab.ALL || selectedTab == LibraryTab.PLAYLISTS) {
            item {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Playlists",
                    color = TextPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                )
            }

            if (playlists.isEmpty()) {
                item {
                    Text(
                        text = "No custom playlists yet. Tap '+' to create one.",
                        color = TextMuted,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                    )
                }
            } else {
                items(playlists) { playlist ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 8.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(NocturneSurfaceElevated)
                            .clickable { onPlaylistClick(playlist) }
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        AsyncImage(
                            model = playlist.coverImageUrl,
                            contentDescription = playlist.name,
                            modifier = Modifier
                                .size(50.dp)
                                .clip(RoundedCornerShape(10.dp)),
                            contentScale = ContentScale.Crop
                        )

                        Spacer(modifier = Modifier.width(14.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = playlist.name,
                                color = TextPrimary,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "Playlist • ${playlist.creator}",
                                color = TextSecondary,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }
        }

        // History
        if (selectedTab == LibraryTab.HISTORY) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Listening History",
                        color = TextPrimary,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                    if (historyTracks.isNotEmpty()) {
                        TextButton(onClick = onClearHistory) {
                            Text("Clear", color = NocturneCyan)
                        }
                    }
                }
            }

            if (historyTracks.isEmpty()) {
                item {
                    Text(
                        text = "History is empty",
                        color = TextMuted,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp)
                    )
                }
            } else {
                items(historyTracks) { track ->
                    val isCurrent = playbackState.currentTrack?.id == track.id
                    val isLiked = likedTracks.any { it.id == track.id }
                    TrackRow(
                        track = track,
                        isPlaying = isCurrent && playbackState.isPlaying,
                        isCurrent = isCurrent,
                        isLiked = isLiked,
                        onTrackClick = { onPlayTrack(track, historyTracks) },
                        onLikeToggle = { onLikeToggle(track) },
                        onAddToPlaylist = { onAddToPlaylist(track) },
                        onDownload = { onDownload(track) },
                        modifier = Modifier.padding(horizontal = 8.dp)
                    )
                }
            }
        }
    }
}
