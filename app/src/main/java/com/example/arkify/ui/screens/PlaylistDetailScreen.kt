package com.example.arkify.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.arkify.model.PlaybackState
import com.example.arkify.model.Track
import com.example.arkify.model.UserPlaylist
import com.example.arkify.ui.components.TrackRow
import com.example.arkify.ui.theme.NocturneBackground
import com.example.arkify.ui.theme.NocturneCyan
import com.example.arkify.ui.theme.NocturneSurfaceElevated
import com.example.arkify.ui.theme.TextDark
import com.example.arkify.ui.theme.TextMuted
import com.example.arkify.ui.theme.TextPrimary
import com.example.arkify.ui.theme.TextSecondary

@Composable
fun PlaylistDetailScreen(
    playlist: UserPlaylist,
    tracks: List<Track>,
    playbackState: PlaybackState,
    likedTracks: List<Track>,
    onBack: () -> Unit,
    onPlayAll: (List<Track>) -> Unit,
    onShufflePlay: (List<Track>) -> Unit,
    onTrackClick: (Track) -> Unit,
    onLikeToggle: (Track) -> Unit,
    onRemoveTrack: (Track) -> Unit,
    onDeletePlaylist: () -> Unit,
    onDownload: (Track) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(NocturneBackground)
            .testTag("playlist_detail_screen"),
        contentPadding = PaddingValues(bottom = 120.dp)
    ) {
        // Back bar
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = TextPrimary
                    )
                }

                IconButton(onClick = onDeletePlaylist) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Delete Playlist",
                        tint = TextSecondary
                    )
                }
            }
        }

        // Playlist Header Art & Info
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(180.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(NocturneSurfaceElevated),
                    contentAlignment = Alignment.Center
                ) {
                    if (playlist.coverImageUrl.isNotBlank()) {
                        AsyncImage(
                            model = playlist.coverImageUrl,
                            contentDescription = playlist.name,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                Text(
                    text = playlist.name,
                    color = TextPrimary,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "${playlist.creator} • ${tracks.size} songs",
                    color = TextSecondary,
                    fontSize = 14.sp
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Action buttons
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Button(
                        onClick = { if (tracks.isNotEmpty()) onPlayAll(tracks) },
                        enabled = tracks.isNotEmpty(),
                        shape = CircleShape,
                        colors = ButtonDefaults.buttonColors(containerColor = NocturneCyan)
                    ) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = null,
                            tint = TextDark,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Play", color = TextDark, fontWeight = FontWeight.Bold)
                    }

                    OutlinedButton(
                        onClick = { if (tracks.isNotEmpty()) onShufflePlay(tracks) },
                        enabled = tracks.isNotEmpty(),
                        shape = CircleShape
                    ) {
                        Icon(
                            imageVector = Icons.Default.Shuffle,
                            contentDescription = null,
                            tint = NocturneCyan,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Shuffle", color = NocturneCyan)
                    }
                }
            }
        }

        // Tracks list
        if (tracks.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 40.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "This playlist is empty. Add songs from search or home.",
                        color = TextMuted,
                        fontSize = 14.sp
                    )
                }
            }
        } else {
            items(tracks) { track ->
                val isCurrent = playbackState.currentTrack?.id == track.id
                val isLiked = likedTracks.any { it.id == track.id }

                TrackRow(
                    track = track,
                    isPlaying = isCurrent && playbackState.isPlaying,
                    isCurrent = isCurrent,
                    isLiked = isLiked,
                    onTrackClick = { onTrackClick(track) },
                    onLikeToggle = { onLikeToggle(track) },
                    onAddToPlaylist = {},
                    onDownload = { onDownload(track) },
                    modifier = Modifier.padding(horizontal = 8.dp)
                )
            }
        }
    }
}
