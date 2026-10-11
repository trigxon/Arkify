package com.example.arkify

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.example.arkify.data.Catalog
import com.example.arkify.model.Lyrics
import com.example.arkify.model.SearchFilter
import com.example.arkify.model.SearchResults
import com.example.arkify.model.Track
import com.example.arkify.model.UserPlaylist
import com.example.arkify.ui.components.AddToPlaylistDialog
import com.example.arkify.ui.components.ArkifyBottomBar
import com.example.arkify.ui.components.LyricsSheet
import com.example.arkify.ui.components.MiniPlayer
import com.example.arkify.ui.components.NowPlayingSheet
import com.example.arkify.ui.components.QueueSheet
import com.example.arkify.ui.components.ScreenTab
import com.example.arkify.ui.screens.HomeScreen
import com.example.arkify.ui.screens.LibraryScreen
import com.example.arkify.ui.screens.PlaylistDetailScreen
import com.example.arkify.ui.screens.SearchScreen
import com.example.arkify.ui.screens.SettingsScreen
import com.example.arkify.ui.theme.ArkifyTheme
import com.example.arkify.ui.theme.NocturneBackground
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as ArkifyApp
        val repository = app.repository
        val playerManager = app.playerManager
        val apiService = app.apiService

        setContent {
            ArkifyTheme {
                ArkifyMainContent(
                    repository = repository,
                    playerManager = playerManager,
                    apiService = apiService
                )
            }
        }
    }
}

@Composable
fun ArkifyMainContent(
    repository: com.example.arkify.data.repository.MusicRepository,
    playerManager: com.example.arkify.playback.MusicPlayerManager,
    apiService: com.example.arkify.data.remote.MusicApiService
) {
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    // State collections from Repository & Player
    val playbackState by playerManager.playbackState.collectAsState()
    val likedTracks by repository.likedTracks.collectAsState(initial = emptyList())
    val historyTracks by repository.historyTracks.collectAsState(initial = emptyList())
    val downloadedTracks by repository.downloadedTracks.collectAsState(initial = emptyList())
    val playlists by repository.playlists.collectAsState(initial = emptyList())

    // Navigation and Sheet states
    var currentTab by remember { mutableStateOf(ScreenTab.HOME) }
    var selectedPlaylist by remember { mutableStateOf<UserPlaylist?>(null) }
    var showNowPlayingSheet by remember { mutableStateOf(false) }
    var showLyricsSheet by remember { mutableStateOf(false) }
    var showQueueSheet by remember { mutableStateOf(false) }
    var trackForPlaylistDialog by remember { mutableStateOf<Track?>(null) }

    // Search state
    var searchQuery by remember { mutableStateOf("") }
    var searchFilter by remember { mutableStateOf(SearchFilter.ALL) }
    var searchResults by remember { mutableStateOf(SearchResults()) }
    var isSearching by remember { mutableStateOf(false) }

    // Lyrics cache / state
    var currentLyrics by remember { mutableStateOf<Lyrics?>(null) }
    var isLoadingLyrics by remember { mutableStateOf(false) }

    // Settings state
    var streamQuality by remember { mutableStateOf("High (160kbps)") }
    var configuredEndpoints by remember { mutableStateOf(apiService.configuredEndpoints.toList()) }

    // Debounced Search Trigger
    LaunchedEffect(searchQuery, searchFilter) {
        if (searchQuery.isBlank()) {
            searchResults = SearchResults()
            isSearching = false
        } else {
            isSearching = true
            delay(350L) // Debounce
            try {
                searchResults = apiService.search(searchQuery, searchFilter)
            } catch (e: Exception) {
                searchResults = SearchResults()
            } finally {
                isSearching = false
            }
        }
    }

    // Load Lyrics when track changes or lyrics opened
    LaunchedEffect(playbackState.currentTrack?.id, showLyricsSheet) {
        val track = playbackState.currentTrack
        if (track != null && showLyricsSheet) {
            isLoadingLyrics = true
            try {
                currentLyrics = apiService.getLyrics(track)
            } catch (e: Exception) {
                currentLyrics = null
            } finally {
                isLoadingLyrics = false
            }
        }
    }

    Scaffold(
        containerColor = NocturneBackground,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            Column(modifier = Modifier.navigationBarsPadding()) {
                // Docked Mini Player
                if (playbackState.currentTrack != null) {
                    MiniPlayer(
                        playbackState = playbackState,
                        onTogglePlayPause = { playerManager.togglePlayPause() },
                        onSkipNext = { playerManager.skipNext() },
                        onClick = { showNowPlayingSheet = true }
                    )
                }

                // Bottom Navigation
                ArkifyBottomBar(
                    currentTab = currentTab,
                    onTabSelected = {
                        selectedPlaylist = null
                        currentTab = it
                    }
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            val currentPlaylist = selectedPlaylist
            if (currentPlaylist != null) {
                // Playlist Detail Screen
                val playlistTracks by repository.getPlaylistTracks(currentPlaylist.id).collectAsState(initial = emptyList())
                PlaylistDetailScreen(
                    playlist = currentPlaylist,
                    tracks = playlistTracks,
                    playbackState = playbackState,
                    likedTracks = likedTracks,
                    onBack = { selectedPlaylist = null },
                    onPlayAll = { tracks ->
                        if (tracks.isNotEmpty()) {
                            playerManager.playTrack(tracks.first(), tracks)
                        }
                    },
                    onShufflePlay = { tracks ->
                        if (tracks.isNotEmpty()) {
                            val shuffled = tracks.shuffled()
                            playerManager.playTrack(shuffled.first(), shuffled)
                        }
                    },
                    onTrackClick = { track ->
                        playerManager.playTrack(track, playlistTracks)
                    },
                    onLikeToggle = { track ->
                        scope.launch { repository.toggleLike(track) }
                    },
                    onRemoveTrack = { track ->
                        scope.launch {
                            repository.removeTrackFromPlaylist(currentPlaylist.id, track.id)
                        }
                    },
                    onDeletePlaylist = {
                        scope.launch {
                            repository.deletePlaylist(currentPlaylist.id)
                            selectedPlaylist = null
                            snackbarHostState.showSnackbar("Playlist deleted")
                        }
                    },
                    onDownload = { track ->
                        scope.launch {
                            snackbarHostState.showSnackbar("Downloading ${track.title}...")
                            val res = repository.downloadTrack(track)
                            if (res.isSuccess) {
                                snackbarHostState.showSnackbar("Downloaded ${track.title}")
                            } else {
                                snackbarHostState.showSnackbar("Download failed")
                            }
                        }
                    }
                )
            } else {
                when (currentTab) {
                    ScreenTab.HOME -> {
                        HomeScreen(
                            playbackState = playbackState,
                            historyTracks = historyTracks,
                            likedTracks = likedTracks,
                            onPlayTrack = { track, queue ->
                                playerManager.playTrack(track, queue)
                            },
                            onLikeToggle = { track ->
                                scope.launch { repository.toggleLike(track) }
                            },
                            onAddToPlaylist = { track ->
                                trackForPlaylistDialog = track
                            },
                            onDownload = { track ->
                                scope.launch {
                                    snackbarHostState.showSnackbar("Downloading ${track.title}...")
                                    val res = repository.downloadTrack(track)
                                    if (res.isSuccess) {
                                        snackbarHostState.showSnackbar("Downloaded ${track.title}")
                                    } else {
                                        snackbarHostState.showSnackbar("Download failed")
                                    }
                                }
                            },
                            onQuickAction = { actionId ->
                                when (actionId) {
                                    "liked" -> {
                                        currentTab = ScreenTab.LIBRARY
                                    }
                                    "discover" -> {
                                        searchQuery = "trending songs"
                                        currentTab = ScreenTab.SEARCH
                                    }
                                    "chill" -> {
                                        searchQuery = "chill relaxing songs"
                                        currentTab = ScreenTab.SEARCH
                                    }
                                    "focus" -> {
                                        searchQuery = "focus instrumental"
                                        currentTab = ScreenTab.SEARCH
                                    }
                                }
                            }
                        )
                    }

                    ScreenTab.SEARCH -> {
                        SearchScreen(
                            searchQuery = searchQuery,
                            onQueryChange = { searchQuery = it },
                            searchResults = searchResults,
                            isSearching = isSearching,
                            currentFilter = searchFilter,
                            onFilterChange = { searchFilter = it },
                            playbackState = playbackState,
                            likedTracks = likedTracks,
                            onPlayTrack = { track, queue ->
                                playerManager.playTrack(track, queue)
                            },
                            onLikeToggle = { track ->
                                scope.launch { repository.toggleLike(track) }
                            },
                            onAddToPlaylist = { track ->
                                trackForPlaylistDialog = track
                            },
                            onDownload = { track ->
                                scope.launch {
                                    snackbarHostState.showSnackbar("Downloading ${track.title}...")
                                    val res = repository.downloadTrack(track)
                                    if (res.isSuccess) {
                                        snackbarHostState.showSnackbar("Downloaded ${track.title}")
                                    } else {
                                        snackbarHostState.showSnackbar("Download failed")
                                    }
                                }
                            }
                        )
                    }

                    ScreenTab.LIBRARY -> {
                        LibraryScreen(
                            likedTracks = likedTracks,
                            downloadedTracks = downloadedTracks,
                            historyTracks = historyTracks,
                            playlists = playlists,
                            playbackState = playbackState,
                            onPlayTrack = { track, queue ->
                                playerManager.playTrack(track, queue)
                            },
                            onLikeToggle = { track ->
                                scope.launch { repository.toggleLike(track) }
                            },
                            onPlaylistClick = { playlist ->
                                selectedPlaylist = playlist
                            },
                            onCreatePlaylist = {
                                scope.launch {
                                    val newId = repository.createPlaylist("Playlist #${playlists.size + 1}")
                                    snackbarHostState.showSnackbar("Playlist created")
                                }
                            },
                            onClearHistory = {
                                scope.launch {
                                    repository.clearHistory()
                                    snackbarHostState.showSnackbar("History cleared")
                                }
                            },
                            onAddToPlaylist = { track ->
                                trackForPlaylistDialog = track
                            },
                            onDownload = { track ->
                                scope.launch {
                                    snackbarHostState.showSnackbar("Downloading ${track.title}...")
                                    val res = repository.downloadTrack(track)
                                    if (res.isSuccess) {
                                        snackbarHostState.showSnackbar("Downloaded ${track.title}")
                                    } else {
                                        snackbarHostState.showSnackbar("Download failed")
                                    }
                                }
                            }
                        )
                    }

                    ScreenTab.SETTINGS -> {
                        SettingsScreen(
                            currentQuality = streamQuality,
                            onQualityChange = { streamQuality = it },
                            sleepTimerMinutes = playbackState.sleepTimerMinutesRemaining,
                            onSetSleepTimer = { minutes ->
                                playerManager.setSleepTimer(minutes)
                                val msg = if (minutes > 0) "Sleep timer set for $minutes minutes" else "Sleep timer disabled"
                                scope.launch { snackbarHostState.showSnackbar(msg) }
                            },
                            configuredEndpoints = configuredEndpoints,
                            onAddEndpoint = { newEp ->
                                apiService.configuredEndpoints.add(newEp)
                                configuredEndpoints = apiService.configuredEndpoints.toList()
                                scope.launch { snackbarHostState.showSnackbar("Endpoint added") }
                            },
                            onClearCache = {
                                scope.launch {
                                    // Cache cleared
                                    searchResults = SearchResults()
                                }
                            },
                            snackbarHostState = snackbarHostState
                        )
                    }
                }
            }
        }
    }

    // Now Playing Modal Sheet
    if (showNowPlayingSheet && playbackState.currentTrack != null) {
        val currentTrack = playbackState.currentTrack!!
        val isLiked = likedTracks.any { it.id == currentTrack.id }

        NowPlayingSheet(
            playbackState = playbackState,
            isLiked = isLiked,
            onTogglePlayPause = { playerManager.togglePlayPause() },
            onSkipNext = { playerManager.skipNext() },
            onSkipPrevious = { playerManager.skipPrevious() },
            onSeekTo = { playerManager.seekTo(it) },
            onToggleShuffle = { playerManager.toggleShuffle() },
            onCycleRepeat = { playerManager.cycleRepeatMode() },
            onToggleLike = {
                scope.launch { repository.toggleLike(currentTrack) }
            },
            onOpenLyrics = { showLyricsSheet = true },
            onOpenQueue = { showQueueSheet = true },
            onOpenSleepTimer = {
                // cycle timer: 0 -> 15 -> 30 -> 45 -> 60 -> 0
                val nextMins = when (playbackState.sleepTimerMinutesRemaining) {
                    null -> 15
                    15 -> 30
                    30 -> 45
                    45 -> 60
                    else -> 0
                }
                playerManager.setSleepTimer(nextMins)
                val msg = if (nextMins > 0) "Sleep timer set for $nextMins minutes" else "Sleep timer off"
                scope.launch { snackbarHostState.showSnackbar(msg) }
            },
            onDismiss = { showNowPlayingSheet = false }
        )
    }

    // Lyrics Modal Sheet
    if (showLyricsSheet && playbackState.currentTrack != null) {
        LyricsSheet(
            track = playbackState.currentTrack!!,
            lyrics = currentLyrics,
            isLoading = isLoadingLyrics,
            currentPositionMs = playbackState.positionMs,
            onDismiss = { showLyricsSheet = false }
        )
    }

    // Queue Modal Sheet
    if (showQueueSheet) {
        QueueSheet(
            playbackState = playbackState,
            onTrackSelect = { track ->
                playerManager.playTrack(track)
            },
            onRemoveFromQueue = { trackId ->
                playerManager.removeFromQueue(trackId)
            },
            onClearQueue = {
                playerManager.clearQueue()
            },
            onDismiss = { showQueueSheet = false }
        )
    }

    // Add To Playlist Dialog
    val trackForPlaylist = trackForPlaylistDialog
    if (trackForPlaylist != null) {
        AddToPlaylistDialog(
            track = trackForPlaylist,
            playlists = playlists,
            onAddToPlaylist = { playlistId ->
                scope.launch {
                    repository.addTrackToPlaylist(playlistId, trackForPlaylist)
                    trackForPlaylistDialog = null
                    snackbarHostState.showSnackbar("Added to playlist")
                }
            },
            onCreateAndAdd = { newName ->
                scope.launch {
                    val newId = repository.createPlaylist(newName)
                    repository.addTrackToPlaylist(newId, trackForPlaylist)
                    trackForPlaylistDialog = null
                    snackbarHostState.showSnackbar("Added to $newName")
                }
            },
            onDismiss = { trackForPlaylistDialog = null }
        )
    }
}
