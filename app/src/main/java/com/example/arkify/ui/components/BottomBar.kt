package com.example.arkify.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import com.example.arkify.ui.theme.NocturneBackground
import com.example.arkify.ui.theme.NocturneCyan
import com.example.arkify.ui.theme.NocturneSurface
import com.example.arkify.ui.theme.TextMuted
import com.example.arkify.ui.theme.TextSecondary

enum class ScreenTab(val title: String, val icon: ImageVector, val tag: String) {
    HOME("Home", Icons.Default.Home, "tab_home"),
    SEARCH("Search", Icons.Default.Search, "tab_search"),
    LIBRARY("Library", Icons.Default.LibraryMusic, "tab_library"),
    SETTINGS("Settings", Icons.Default.Settings, "tab_settings")
}

@Composable
fun ArkifyBottomBar(
    currentTab: ScreenTab,
    onTabSelected: (ScreenTab) -> Unit,
    modifier: Modifier = Modifier
) {
    NavigationBar(
        modifier = modifier.testTag("bottom_nav_bar"),
        containerColor = NocturneSurface,
        contentColor = TextSecondary
    ) {
        ScreenTab.values().forEach { tab ->
            val isSelected = currentTab == tab
            NavigationBarItem(
                selected = isSelected,
                onClick = { onTabSelected(tab) },
                icon = {
                    Icon(
                        imageVector = tab.icon,
                        contentDescription = tab.title
                    )
                },
                label = { Text(tab.title) },
                modifier = Modifier.testTag(tab.tag),
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = NocturneCyan,
                    selectedTextColor = NocturneCyan,
                    unselectedIconColor = TextMuted,
                    unselectedTextColor = TextMuted,
                    indicatorColor = Color(0x1F35D6C6)
                )
            )
        }
    }
}
