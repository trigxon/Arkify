package com.example.arkify.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SelfImprovement
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Waves
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
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
import com.example.arkify.data.Catalog
import com.example.arkify.model.PlaybackState
import com.example.arkify.model.Track
import com.example.arkify.ui.components.TrackRow
import com.example.arkify.ui.theme.NocturneBackground
import com.example.arkify.ui.theme.NocturneCyan
import com.example.arkify.ui.theme.NocturneCyanGlow
import com.example.arkify.ui.theme.NocturneCyanSoft
import com.example.arkify.ui.theme.NocturneSurface
import com.example.arkify.ui.theme.NocturneSurfaceCard
import com.example.arkify.ui.theme.NocturneSurfaceElevated
import com.example.arkify.ui.theme.TextDark
import com.example.arkify.ui.theme.TextMuted
import com.example.arkify.ui.theme.TextPrimary
import com.example.arkify.ui.theme.TextSecondary
import java.util.Calendar

@Composable
fun HomeScreen(
    playbackState: PlaybackState,
    historyTracks: List<Track>,
    likedTracks: List<Track>,
    onPlayTrack: (Track, List<Track>) -> Unit,
    onLikeToggle: (Track) -> Unit,
    onAddToPlaylist: (Track) -> Unit,
    onDownload: (Track) -> Unit,
    onQuickAction: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val greeting = remember {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        when (hour) {
            in 5..11 -> "Good morning"
            in 12..17 -> "Good afternoon"
            else -> "Good evening"
        }
    }

    val featuredTrack = remember { Catalog.CURATED_FEATURED_TRACKS.first() }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(NocturneBackground)
            .testTag("home_screen"),
        contentPadding = PaddingValues(bottom = 120.dp)
    ) {
        // App Bar / Greeting
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 20.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(12.dp)
                                .clip(CircleShape)
                                .background(NocturneCyan)
                                .shadow(8.dp, CircleShape, spotColor = NocturneCyan)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = "ARKIFY",
                            color = TextPrimary,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 20.sp,
                            letterSpacing = 4.sp
                        )
                    }

                    Surface(
                        shape = CircleShape,
                        color = NocturneSurfaceElevated
                    ) {
                        Text(
                            text = "v1.0",
                            color = NocturneCyan,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = greeting,
                    color = TextSecondary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "Nocturne Audio",
                    color = TextPrimary,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        // Quick Action Pills
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                QuickActionChip(
                    label = "Liked",
                    icon = Icons.Default.Favorite,
                    onClick = { onQuickAction("liked") },
                    modifier = Modifier.weight(1f)
                )
                QuickActionChip(
                    label = "Discover",
                    icon = Icons.Default.AutoAwesome,
                    onClick = { onQuickAction("discover") },
                    modifier = Modifier.weight(1f)
                )
                QuickActionChip(
                    label = "Chill",
                    icon = Icons.Default.Waves,
                    onClick = { onQuickAction("chill") },
                    modifier = Modifier.weight(1f)
                )
                QuickActionChip(
                    label = "Focus",
                    icon = Icons.Default.SelfImprovement,
                    onClick = { onQuickAction("focus") },
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Featured Hero Card
        item {
            Spacer(modifier = Modifier.height(24.dp))
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .testTag("featured_card")
                    .clickable {
                        onPlayTrack(featuredTrack, Catalog.CURATED_FEATURED_TRACKS)
                    },
                colors = CardDefaults.cardColors(containerColor = NocturneSurfaceElevated)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(190.dp)
                ) {
                    AsyncImage(
                        model = featuredTrack.albumImageUrl,
                        contentDescription = "Featured",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )

                    // Ambient gradient overlay
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.verticalGradient(
                                    listOf(Color.Transparent, Color(0xCC0C0F0F), NocturneBackground)
                                )
                            )
                    )

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(20.dp),
                        verticalArrangement = Arrangement.Bottom
                    ) {
                        Text(
                            text = "FEATURED FLOW",
                            color = NocturneCyan,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 2.sp
                        )
                        Text(
                            text = featuredTrack.title,
                            color = TextPrimary,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "${featuredTrack.artist.name} • ${featuredTrack.album ?: "Exclusive"}",
                                color = TextSecondary,
                                fontSize = 13.sp
                            )

                            Button(
                                onClick = {
                                    onPlayTrack(featuredTrack, Catalog.CURATED_FEATURED_TRACKS)
                                },
                                shape = CircleShape,
                                colors = ButtonDefaults.buttonColors(containerColor = NocturneCyan),
                                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.PlayArrow,
                                    contentDescription = null,
                                    tint = TextDark,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Play", color = TextDark, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        // Section: Recently Played or Recommended
        item {
            Spacer(modifier = Modifier.height(28.dp))
            val tracksToShow = if (historyTracks.isNotEmpty()) historyTracks else Catalog.CURATED_FEATURED_TRACKS
            val sectionTitle = if (historyTracks.isNotEmpty()) "Recently Played" else "Trending Now"

            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = sectionTitle,
                    color = TextPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                )

                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    items(tracksToShow) { track ->
                        val isCurrent = playbackState.currentTrack?.id == track.id
                        Column(
                            modifier = Modifier
                                .width(135.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .clickable {
                                    onPlayTrack(track, tracksToShow)
                                }
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(135.dp)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(NocturneSurfaceElevated)
                                    .border(
                                        width = if (isCurrent) 1.5.dp else 0.dp,
                                        color = if (isCurrent) NocturneCyan else Color.Transparent,
                                        shape = RoundedCornerShape(16.dp)
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                AsyncImage(
                                    model = track.albumImageUrl,
                                    contentDescription = track.title,
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )

                                if (isCurrent && playbackState.isPlaying) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .background(Color(0x66000000)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.GraphicEq,
                                            contentDescription = null,
                                            tint = NocturneCyan,
                                            modifier = Modifier.size(36.dp)
                                        )
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = track.title,
                                color = if (isCurrent) NocturneCyan else TextPrimary,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = track.artist.name,
                                color = TextSecondary,
                                fontSize = 12.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }
        }

        // Section: Made For You
        item {
            Spacer(modifier = Modifier.height(28.dp))
            Text(
                text = "Made For You",
                color = TextPrimary,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
            )
        }

        items(Catalog.CURATED_FEATURED_TRACKS.drop(1)) { track ->
            val isCurrent = playbackState.currentTrack?.id == track.id
            val isLiked = likedTracks.any { it.id == track.id }
            TrackRow(
                track = track,
                isPlaying = isCurrent && playbackState.isPlaying,
                isCurrent = isCurrent,
                isLiked = isLiked,
                onTrackClick = {
                    onPlayTrack(track, Catalog.CURATED_FEATURED_TRACKS)
                },
                onLikeToggle = { onLikeToggle(track) },
                onAddToPlaylist = { onAddToPlaylist(track) },
                onDownload = { onDownload(track) },
                modifier = Modifier.padding(horizontal = 8.dp)
            )
        }
    }
}

@Composable
private fun QuickActionChip(
    label: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .testTag("quick_action_$label"),
        color = NocturneSurfaceElevated
    ) {
        Column(
            modifier = Modifier.padding(vertical = 12.dp, horizontal = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = NocturneCyan,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = label,
                color = TextPrimary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
