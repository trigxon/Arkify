package com.lastwave.app.ui.common

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally

/**
 * Nothing OS redesign: transitions read as a device responding, not a
 * surface animating for its own sake — short (150-200ms), ease-out, no
 * spring/bounce, no scale morphing (that reads as "liquid," which this
 * flat/mechanical look explicitly avoids). Object name and function
 * signatures are unchanged from the previous "Expressive" motion set so
 * every call site elsewhere in the app picks this up automatically.
 */
object ExpressiveMotion {
    const val Quick = 120
    const val Standard = 180
    const val Emphasized = 200

    /** No longer bouncy — critically damped (DampingRatioNoBouncy) — kept
     *  for the handful of gesture-driven call sites (player drag, lyrics
     *  scroll) that still need a spring's velocity-continuity rather than
     *  a fixed-duration tween, just without any overshoot. */
    fun <T> spatialSpring() = spring<T>(
        dampingRatio = Spring.DampingRatioNoBouncy,
        stiffness = Spring.StiffnessHigh,
    )

    fun <T> smoothSpring() = spring<T>(
        dampingRatio = Spring.DampingRatioNoBouncy,
        stiffness = Spring.StiffnessHigh,
    )

    fun forwardEnter(): EnterTransition =
        fadeIn(tween(Standard, easing = LinearOutSlowInEasing)) +
            slideInHorizontally(tween(Standard, easing = LinearOutSlowInEasing)) { it / 16 }

    fun forwardExit(): ExitTransition =
        fadeOut(tween(Quick))

    fun backEnter(): EnterTransition =
        fadeIn(tween(Standard, easing = LinearOutSlowInEasing)) +
            slideInHorizontally(tween(Standard, easing = LinearOutSlowInEasing)) { -it / 16 }

    fun backExit(): ExitTransition =
        fadeOut(tween(Quick)) +
            slideOutHorizontally(tween(Quick, easing = LinearOutSlowInEasing)) { it / 16 }
}
