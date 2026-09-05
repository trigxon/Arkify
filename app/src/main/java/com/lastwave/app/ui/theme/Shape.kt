package com.lastwave.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

/**
 * Nothing OS redesign: sharp, "engineered" rectangles everywhere — no
 * rounded card surfaces. All shapes below are flat (0dp) on purpose; this
 * file is the single place that controls corner treatment app-wide, so
 * every screen that already references [LastWaveShapes] or these named
 * constants goes flat without per-screen edits.
 */
val LastWaveShapes = Shapes(
    extraSmall = RoundedCornerShape(0.dp),
    small = RoundedCornerShape(0.dp),
    medium = RoundedCornerShape(0.dp),
    large = RoundedCornerShape(0.dp),
    extraLarge = RoundedCornerShape(0.dp),
)

val ExpressiveHeroShape = RoundedCornerShape(0.dp)
val ExpressivePillShape = RoundedCornerShape(0.dp)
val HeroInnerShape = RoundedCornerShape(0.dp)
val StatPillShape = RoundedCornerShape(0.dp)
val ListContainerShape = RoundedCornerShape(0.dp)
val BadgePillShape = RoundedCornerShape(0.dp)
val NowPlayingCardShape = RoundedCornerShape(0.dp)
val TrackRowShape = RoundedCornerShape(0.dp)
val ArtworkShape = RoundedCornerShape(0.dp)
