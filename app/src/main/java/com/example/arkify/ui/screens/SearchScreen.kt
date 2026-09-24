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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.arkify.data.Catalog
import com.example.arkify.model.Category
import com.example.arkify.model.PlaybackState
import com.example.arkify.model.SearchFilter
import com.example.arkify.model.SearchResults
import com.example.arkify.model.Track
import com.example.arkify.ui.components.TrackRow
import com.example.arkify.ui.theme.NocturneBackground
import com.example.arkify.ui.theme.NocturneCyan
import com.example.arkify.ui.theme.NocturneSurface
import com.example.arkify.ui.theme.NocturneSurfaceCard
import com.example.arkify.ui.theme.NocturneSurfaceElevated
import com.example.arkify.ui.theme.TextMuted
import com.example.arkify.ui.theme.TextPrimary
import com.example.arkify.ui.theme.TextSecondary

@Composable
fun SearchScreen(
    searchQuery: String,
    onQueryChange: (String) -> Unit,
    searchResults: SearchResults,
    isSearching: Boolean,
    currentFilter: SearchFilter,
    onFilterChange: (SearchFilter) -> Unit,
    playbackState: PlaybackState,
    likedTracks: List<Track>,
    onPlayTrack: (Track, List<Track>) -> Unit,
    onLikeToggle: (Track) -> Unit,
    onAddToPlaylist: (Track) -> Unit,
    onDownload: (Track) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(NocturneBackground)
            .testTag("search_screen")
    ) {
        // Search Header & Input
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 16.dp)
        ) {
            Text(
                text = "Search",
                color = TextPrimary,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(14.dp))

            OutlinedTextField(
                value = searchQuery,
                onValueChange = onQueryChange,
                placeholder = { Text("Search songs, artists, albums…", color = TextMuted) },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search",
                        tint = TextSecondary
                    )
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { onQueryChange("") }) {
                            Icon(
                                imageVector = Icons.Default.Clear,
                                contentDescription = "Clear",
                                tint = TextSecondary
                            )
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
                colors = TextFieldDefaults.colors(
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    focusedContainerColor = NocturneSurfaceElevated,
                    unfocusedContainerColor = NocturneSurfaceElevated,
                    focusedIndicatorColor = NocturneCyan,
                    unfocusedIndicatorColor = Color.Transparent
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("search_input")
            )

            if (searchQuery.isNotEmpty()) {
                Spacer(modifier = Modifier.height(10.dp))
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(SearchFilter.values()) { filter ->
                        FilterChip(
                            selected = currentFilter == filter,
                            onClick = { onFilterChange(filter) },
                            label = { Text(filter.label) },
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
            }
        }

        // Search Content or Browse Categories
        if (searchQuery.isEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 20.dp)
            ) {
                Text(
                    text = "Browse All",
                    color = TextPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 14.dp)
                )

                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(bottom = 120.dp)
                ) {
                    items(Catalog.BROWSE_CATEGORIES) { category ->
                        CategoryCard(
                            category = category,
                            onClick = { onQueryChange(category.query) }
                        )
                    }
                }
            }
        } else if (isSearching) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = NocturneCyan)
            }
        } else if (searchResults.tracks.isEmpty() && searchResults.artists.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No results found for \"$searchQuery\"",
                    color = TextMuted,
                    fontSize = 16.sp
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 120.dp, start = 12.dp, end = 12.dp)
            ) {
                // If filter allows artists
                if (currentFilter == SearchFilter.ALL || currentFilter == SearchFilter.ARTISTS) {
                    if (searchResults.artists.isNotEmpty()) {
                        item {
                            Text(
                                text = "Artists",
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 10.dp)
                            )
                        }

                        item {
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                items(searchResults.artists) { artist ->
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        modifier = Modifier.width(90.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(76.dp)
                                                .clip(CircleShape)
                                                .background(NocturneSurfaceElevated),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            if (!artist.imageUrl.isNullOrBlank()) {
                                                AsyncImage(
                                                    model = artist.imageUrl,
                                                    contentDescription = artist.name,
                                                    modifier = Modifier.fillMaxSize(),
                                                    contentScale = ContentScale.Crop
                                                )
                                            } else {
                                                Text(
                                                    text = artist.name.take(1).uppercase(),
                                                    color = NocturneCyan,
                                                    fontSize = 24.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text(
                                            text = artist.name,
                                            color = TextPrimary,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Tracks
                if (currentFilter == SearchFilter.ALL || currentFilter == SearchFilter.SONGS) {
                    item {
                        Text(
                            text = "Songs",
                            color = TextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 12.dp)
                        )
                    }

                    items(searchResults.tracks) { track ->
                        val isCurrent = playbackState.currentTrack?.id == track.id
                        val isLiked = likedTracks.any { it.id == track.id }
                        TrackRow(
                            track = track,
                            isPlaying = isCurrent && playbackState.isPlaying,
                            isCurrent = isCurrent,
                            isLiked = isLiked,
                            onTrackClick = {
                                onPlayTrack(track, searchResults.tracks)
                            },
                            onLikeToggle = { onLikeToggle(track) },
                            onAddToPlaylist = { onAddToPlaylist(track) },
                            onDownload = { onDownload(track) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CategoryCard(
    category: Category,
    onClick: () -> Unit
) {
    val categoryColor = try {
        Color(android.graphics.Color.parseColor(category.colorHex))
    } catch (e: Exception) {
        NocturneCyan
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(96.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .testTag("category_tile_${category.id}"),
        color = NocturneSurfaceElevated
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(14.dp)
        ) {
            Text(
                text = category.name,
                color = TextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.align(Alignment.TopStart)
            )

            // Accent indicator
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(categoryColor)
                    .align(Alignment.BottomEnd)
            )
        }
    }
}
