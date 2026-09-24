package com.example.arkify.data

import com.example.arkify.model.Artist
import com.example.arkify.model.Category
import com.example.arkify.model.Track

object Catalog {
    val BROWSE_CATEGORIES = listOf(
        Category("c1", "Charts", "#35D6C6", "top hits this week"),
        Category("c2", "New Releases", "#FFFFFF", "new music releases"),
        Category("c3", "Moods", "#FFA63D", "chill mood playlist"),
        Category("c4", "Indian", "#F5A9CE", "bollywood hits"),
        Category("c5", "Hip-Hop", "#FF8A3D", "hip hop essentials"),
        Category("c6", "Pop", "#FFFFFF", "pop hits"),
        Category("c7", "EDM", "#57E8D6", "edm dance mix"),
        Category("c8", "Rock", "#FF6B5A", "rock classics"),
        Category("c9", "Jazz", "#7FB2FF", "jazz classics"),
        Category("c10", "Classical", "#E4D7A8", "classical instrumental"),
        Category("c11", "Lo-Fi", "#9B8CF0", "lofi beats to relax"),
        Category("c12", "Workout", "#5AD1A8", "workout motivation songs"),
        Category("c13", "Party", "#FFC24D", "party anthems"),
        Category("c14", "Relax", "#7FE3D4", "relaxing ambient music")
    )

    val QUICK_ACTIONS = listOf(
        QuickAction("liked", "Liked"),
        QuickAction("discover", "Discover"),
        QuickAction("chill", "Chill"),
        QuickAction("focus", "Focus")
    )

    data class QuickAction(val id: String, val label: String)

    // Curated high-fidelity playable catalog with royalty-free & direct stream audio
    val CURATED_FEATURED_TRACKS = listOf(
        Track(
            id = "arkify:ambient-flow-01",
            title = "Midnight Echoes",
            artist = Artist("art-1", "Aura Nocturne"),
            albumImageUrl = "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
            duration = 195,
            audioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            sourceId = "featured_1",
            album = "Cinematic Horizons"
        ),
        Track(
            id = "arkify:chill-beats-02",
            title = "Cyan Horizon",
            artist = Artist("art-2", "Solaris Drift"),
            albumImageUrl = "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80",
            duration = 240,
            audioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
            sourceId = "featured_2",
            album = "Nocturne Dreamscapes"
        ),
        Track(
            id = "arkify:lofi-focus-03",
            title = "Rain Over Neon",
            artist = Artist("art-3", "Komorebi"),
            albumImageUrl = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80",
            duration = 184,
            audioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
            sourceId = "featured_3",
            album = "Lo-Fi Study Session"
        ),
        Track(
            id = "arkify:deep-focus-04",
            title = "Quantum Solitude",
            artist = Artist("art-4", "Starlight Audio"),
            albumImageUrl = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80",
            duration = 210,
            audioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
            sourceId = "featured_4",
            album = "Deep Space Pulse"
        ),
        Track(
            id = "arkify:electronic-vibe-05",
            title = "Velvet Skyline",
            artist = Artist("art-5", "Synthwave Syndicate"),
            albumImageUrl = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&auto=format&fit=crop&q=80",
            duration = 222,
            audioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
            sourceId = "featured_5",
            album = "Retro Glow"
        ),
        Track(
            id = "arkify:peaceful-piano-06",
            title = "Subtle Reflections",
            artist = Artist("art-6", "Elysian"),
            albumImageUrl = "https://images.unsplash.com/photo-1520523839898-507121c25567?w=600&auto=format&fit=crop&q=80",
            duration = 178,
            audioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
            sourceId = "featured_6",
            album = "Acoustic Whispers"
        )
    )
}
