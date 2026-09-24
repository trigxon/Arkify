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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material.icons.filled.CleaningServices
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.arkify.ui.theme.NocturneBackground
import com.example.arkify.ui.theme.NocturneCyan
import com.example.arkify.ui.theme.NocturneSurface
import com.example.arkify.ui.theme.NocturneSurfaceElevated
import com.example.arkify.ui.theme.TextDark
import com.example.arkify.ui.theme.TextMuted
import com.example.arkify.ui.theme.TextPrimary
import com.example.arkify.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(
    currentQuality: String,
    onQualityChange: (String) -> Unit,
    sleepTimerMinutes: Int?,
    onSetSleepTimer: (Int) -> Unit,
    configuredEndpoints: List<String>,
    onAddEndpoint: (String) -> Unit,
    onClearCache: () -> Unit,
    snackbarHostState: SnackbarHostState,
    modifier: Modifier = Modifier
) {
    val scope = rememberCoroutineScope()
    var showQualityDialog by remember { mutableStateOf(false) }
    var showSleepTimerDialog by remember { mutableStateOf(false) }
    var showAddEndpointDialog by remember { mutableStateOf(false) }
    var newEndpointUrl by remember { mutableStateOf("") }

    val qualities = listOf("Normal (96kbps)", "High (160kbps)", "Maximum (320kbps)")
    val timerOptions = listOf(0 to "Off", 15 to "15 minutes", 30 to "30 minutes", 45 to "45 minutes", 60 to "1 hour")

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(NocturneBackground)
            .testTag("settings_screen"),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 20.dp)
    ) {
        item {
            Text(
                text = "Settings",
                color = TextPrimary,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(20.dp))
        }

        // Section: Playback
        item {
            SettingsSectionHeader(title = "PLAYBACK & AUDIO")

            SettingsItem(
                title = "Streaming Quality",
                subtitle = currentQuality,
                icon = Icons.Default.GraphicEq,
                onClick = { showQualityDialog = true }
            )

            SettingsItem(
                title = "Sleep Timer",
                subtitle = if (sleepTimerMinutes != null) "$sleepTimerMinutes minutes remaining" else "Off",
                icon = Icons.Default.Bedtime,
                onClick = { showSleepTimerDialog = true }
            )

            Spacer(modifier = Modifier.height(24.dp))
        }

        // Section: Resolver Endpoints
        item {
            SettingsSectionHeader(title = "STREAM SOURCES")

            SettingsItem(
                title = "Resolver Endpoints",
                subtitle = "${configuredEndpoints.size} active (Invidious / Piped)",
                icon = Icons.Default.Dns,
                onClick = { showAddEndpointDialog = true }
            )

            Spacer(modifier = Modifier.height(24.dp))
        }

        // Section: Storage
        item {
            SettingsSectionHeader(title = "STORAGE")

            SettingsItem(
                title = "Clear Cache",
                subtitle = "Free temporary streaming & metadata files",
                icon = Icons.Default.CleaningServices,
                onClick = {
                    onClearCache()
                    scope.launch {
                        snackbarHostState.showSnackbar("Cache cleared successfully")
                    }
                }
            )

            Spacer(modifier = Modifier.height(24.dp))
        }

        // Section: About
        item {
            SettingsSectionHeader(title = "ABOUT")

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                colors = CardDefaults.cardColors(containerColor = NocturneSurfaceElevated)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(NocturneCyan),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("A", color = TextDark, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text("Arkify", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            Text("Version 1.0.0 (Native Android)", color = TextSecondary, fontSize = 12.sp)
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "A sleek, high-fidelity music streaming client with Nocturne Cyan aesthetics, offline caching, and responsive playback.",
                        color = TextSecondary,
                        fontSize = 13.sp
                    )
                }
            }
        }
    }

    // Quality Selection Dialog
    if (showQualityDialog) {
        AlertDialog(
            onDismissRequest = { showQualityDialog = false },
            containerColor = NocturneSurfaceElevated,
            title = { Text("Select Streaming Quality", color = TextPrimary) },
            text = {
                Column {
                    qualities.forEach { q ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onQualityChange(q)
                                    showQualityDialog = false
                                }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = currentQuality == q,
                                onClick = {
                                    onQualityChange(q)
                                    showQualityDialog = false
                                },
                                colors = RadioButtonDefaults.colors(selectedColor = NocturneCyan)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(text = q, color = TextPrimary)
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showQualityDialog = false }) {
                    Text("Close", color = TextSecondary)
                }
            }
        )
    }

    // Sleep Timer Dialog
    if (showSleepTimerDialog) {
        AlertDialog(
            onDismissRequest = { showSleepTimerDialog = false },
            containerColor = NocturneSurfaceElevated,
            title = { Text("Sleep Timer", color = TextPrimary) },
            text = {
                Column {
                    timerOptions.forEach { (mins, label) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onSetSleepTimer(mins)
                                    showSleepTimerDialog = false
                                }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = (sleepTimerMinutes == mins) || (sleepTimerMinutes == null && mins == 0),
                                onClick = {
                                    onSetSleepTimer(mins)
                                    showSleepTimerDialog = false
                                },
                                colors = RadioButtonDefaults.colors(selectedColor = NocturneCyan)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(text = label, color = TextPrimary)
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showSleepTimerDialog = false }) {
                    Text("Close", color = TextSecondary)
                }
            }
        )
    }

    // Add Endpoint Dialog
    if (showAddEndpointDialog) {
        AlertDialog(
            onDismissRequest = { showAddEndpointDialog = false },
            containerColor = NocturneSurfaceElevated,
            title = { Text("Resolver Endpoints", color = TextPrimary) },
            text = {
                Column {
                    Text(
                        "Configured playback and search endpoints:",
                        color = TextSecondary,
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    configuredEndpoints.forEach { ep ->
                        Text("• $ep", color = TextMuted, fontSize = 12.sp)
                    }
                    Spacer(modifier = Modifier.height(14.dp))
                    OutlinedTextField(
                        value = newEndpointUrl,
                        onValueChange = { newEndpointUrl = it },
                        placeholder = { Text("https://my-invidious.instance") },
                        label = { Text("Add Endpoint URL") },
                        singleLine = true,
                        colors = TextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            focusedContainerColor = NocturneBackground,
                            unfocusedContainerColor = NocturneBackground,
                            focusedIndicatorColor = NocturneCyan
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (newEndpointUrl.isNotBlank()) {
                            onAddEndpoint(newEndpointUrl.trim())
                            newEndpointUrl = ""
                            showAddEndpointDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = NocturneCyan)
                ) {
                    Text("Add", color = TextDark)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddEndpointDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }
}

@Composable
private fun SettingsSectionHeader(title: String) {
    Text(
        text = title,
        color = NocturneCyan,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 2.sp,
        modifier = Modifier.padding(vertical = 8.dp)
    )
}

@Composable
private fun SettingsItem(
    title: String,
    subtitle: String,
    icon: ImageVector,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(NocturneSurfaceElevated)
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = NocturneCyan,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = TextPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = subtitle,
                color = TextSecondary,
                fontSize = 13.sp
            )
        }
    }
}
