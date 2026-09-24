package com.example.arkify

import android.app.Application
import com.example.arkify.data.local.AppDatabase
import com.example.arkify.data.remote.MusicApiService
import com.example.arkify.data.repository.MusicRepository
import com.example.arkify.playback.MusicPlayerManager

class ArkifyApp : Application() {
    lateinit var database: AppDatabase
        private set

    lateinit var repository: MusicRepository
        private set

    lateinit var apiService: MusicApiService
        private set

    lateinit var playerManager: MusicPlayerManager
        private set

    override fun onCreate() {
        super.onCreate()
        database = AppDatabase.getInstance(this)
        repository = MusicRepository(database, this)
        apiService = MusicApiService()
        playerManager = MusicPlayerManager(this, repository, apiService)
    }
}
