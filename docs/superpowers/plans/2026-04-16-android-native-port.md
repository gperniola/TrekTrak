# TrekTrak Android Native Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port TrekTrak from Next.js PWA to native Android (Kotlin + Jetpack Compose) with full feature parity to v0.6.0.

**Architecture:** Single-module MVVM with Repository pattern. osmdroid for maps, Vico for charts, Room for persistence, Koin for DI, Retrofit+OkHttp for networking. Compose UI with Material 3.

**Tech Stack:** Kotlin 2.0+, Jetpack Compose, osmdroid, Vico, Room, Retrofit, OkHttp, Koin, Kotlin Coroutines, Kotlin Serialization

**Spec:** `docs/superpowers/specs/2026-04-16-android-native-port-design.md`

**Source PWA:** The existing Next.js codebase at `C:\Progettiscemi\TrekTrak\src\` is the reference implementation. Each task references the specific PWA source files to port from.

**New project location:** `C:\Progettiscemi\TrekTrakAndroid\` — a fresh Android Studio project, separate from the PWA repo.

---

## Phase 1: Project Foundation

### Task 1: Create Android Project and Configure Gradle

**Files:**
- Create: `build.gradle.kts` (project-level)
- Create: `app/build.gradle.kts` (app-level)
- Create: `settings.gradle.kts`
- Create: `gradle.properties`
- Create: `local.properties` (template, gitignored)
- Create: `.gitignore`

- [ ] **Step 1: Create new Android project**

Open Android Studio → New Project → Empty Activity. Package: `it.trektrak`. Min SDK 26. Save to `C:\Progettiscemi\TrekTrakAndroid\`.

- [ ] **Step 2: Configure app/build.gradle.kts with all dependencies**

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
}

android {
    namespace = "it.trektrak"
    compileSdk = 35

    defaultConfig {
        applicationId = "it.trektrak"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // API keys from local.properties
        val localProps = java.util.Properties().apply {
            val file = rootProject.file("local.properties")
            if (file.exists()) load(file.inputStream())
        }
        buildConfigField("String", "ORS_API_KEY",
            "\"${localProps.getProperty("ORS_API_KEY", "")}\"")
        buildConfigField("String", "THUNDERFOREST_API_KEY",
            "\"${localProps.getProperty("THUNDERFOREST_API_KEY", "")}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // Compose BOM
    val composeBom = platform(libs.androidx.compose.bom)
    implementation(composeBom)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    debugImplementation(libs.androidx.compose.ui.tooling)

    // Window size classes (responsive layout)
    implementation(libs.androidx.material3.window.size)

    // osmdroid (maps)
    implementation(libs.osmdroid.android)

    // Vico (charts, Compose)
    implementation(libs.vico.compose.m3)

    // Room (database)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    // Retrofit + OkHttp (networking)
    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization)
    implementation(libs.okhttp)

    // Koin (DI)
    implementation(libs.koin.android)
    implementation(libs.koin.compose)

    // Kotlin Serialization
    implementation(libs.kotlinx.serialization.json)

    // Coroutines
    implementation(libs.kotlinx.coroutines.android)

    // LZ-String (URL sharing compression)
    implementation(libs.lzstring)

    // Testing
    testImplementation(libs.junit5)
    testImplementation(libs.mockk)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.androidx.room.testing)
    androidTestImplementation(composeBom)
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
}
```

- [ ] **Step 3: Configure libs.versions.toml**

```toml
[versions]
agp = "8.7.0"
kotlin = "2.0.21"
ksp = "2.0.21-1.0.27"
compose-bom = "2025.01.01"
room = "2.7.1"
retrofit = "2.11.0"
okhttp = "4.12.0"
koin = "4.0.0"
vico = "2.1.0"
osmdroid = "6.1.20"
lifecycle = "2.8.7"
navigation = "2.8.5"
activity = "1.9.3"
serialization = "1.7.3"
coroutines = "1.9.0"
junit5 = "5.11.3"
mockk = "1.13.13"

[libraries]
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "compose-bom" }
androidx-compose-material3 = { group = "androidx.compose.material3", name = "material3" }
androidx-compose-ui = { group = "androidx.compose.ui", name = "ui" }
androidx-compose-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }
androidx-compose-ui-tooling-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }
androidx-compose-ui-test-junit4 = { group = "androidx.compose.ui", name = "ui-test-junit4" }
androidx-activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activity" }
androidx-navigation-compose = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigation" }
androidx-lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycle" }
androidx-lifecycle-runtime-compose = { group = "androidx.lifecycle", name = "lifecycle-runtime-compose", version.ref = "lifecycle" }
androidx-material3-window-size = { group = "androidx.compose.material3", name = "material3-window-size-class" }
osmdroid-android = { group = "org.osmdroid", name = "osmdroid-android", version.ref = "osmdroid" }
vico-compose-m3 = { group = "com.patrykandpatrick.vico", name = "compose-m3", version.ref = "vico" }
androidx-room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
androidx-room-ktx = { group = "androidx.room", name = "room-ktx", version.ref = "room" }
androidx-room-compiler = { group = "androidx.room", name = "room-compiler", version.ref = "room" }
androidx-room-testing = { group = "androidx.room", name = "room-testing", version.ref = "room" }
retrofit = { group = "com.squareup.retrofit2", name = "retrofit", version.ref = "retrofit" }
retrofit-kotlinx-serialization = { group = "com.squareup.retrofit2", name = "converter-kotlinx-serialization", version.ref = "retrofit" }
okhttp = { group = "com.squareup.okhttp3", name = "okhttp", version.ref = "okhttp" }
koin-android = { group = "io.insert-koin", name = "koin-android", version.ref = "koin" }
koin-compose = { group = "io.insert-koin", name = "koin-androidx-compose", version.ref = "koin" }
kotlinx-serialization-json = { group = "org.jetbrains.kotlinx", name = "kotlinx-serialization-json", version.ref = "serialization" }
kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }
kotlinx-coroutines-test = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-test", version.ref = "coroutines" }
lzstring = { group = "com.aayushatharva.lzstring4j", name = "lzstring4j", version = "1.1.0" }
junit5 = { group = "org.junit.jupiter", name = "junit-jupiter", version.ref = "junit5" }
mockk = { group = "io.mockk", name = "mockk", version.ref = "mockk" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
kotlin-serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
```

- [ ] **Step 4: Add API key template to local.properties**

```properties
# API Keys - do not commit this file
ORS_API_KEY=your-openrouteservice-key-here
THUNDERFOREST_API_KEY=your-thunderforest-key-here
```

- [ ] **Step 5: Configure .gitignore**

Ensure `.gitignore` includes: `local.properties`, `*.keystore`, `*.jks`, `build/`, `.gradle/`.

- [ ] **Step 6: Build and verify project compiles**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: initial Android project with all dependencies"
```

---

### Task 2: Domain Models

Port all TypeScript interfaces from `src/lib/types.ts` to Kotlin data classes. These are pure Kotlin — no Android dependencies, fully testable on JVM.

**Files:**
- Create: `app/src/main/java/it/trektrak/domain/model/Waypoint.kt`
- Create: `app/src/main/java/it/trektrak/domain/model/Leg.kt`
- Create: `app/src/main/java/it/trektrak/domain/model/Itinerary.kt`
- Create: `app/src/main/java/it/trektrak/domain/model/ValidationResult.kt`
- Create: `app/src/main/java/it/trektrak/domain/model/QuizSession.kt`
- Create: `app/src/main/java/it/trektrak/domain/model/LearningHistory.kt`
- Create: `app/src/main/java/it/trektrak/domain/model/AppSettings.kt`
- Create: `app/src/main/java/it/trektrak/domain/model/LatLon.kt`

**Reference:** `src/lib/types.ts`

- [ ] **Step 1: Create LatLon value class**

```kotlin
package it.trektrak.domain.model

data class LatLon(val lat: Double, val lon: Double)
```

- [ ] **Step 2: Create ValidationResult and enums**

```kotlin
package it.trektrak.domain.model

import kotlinx.serialization.Serializable

enum class ValidationStatus { UNVERIFIED, VALID, WARNING, ERROR }

@Serializable
data class ValidationResult(
    val status: ValidationStatus,
    val userValue: Double,
    val realValue: Double? = null,
    val delta: Double? = null,
    val tolerance: Tolerance
)

@Serializable
data class Tolerance(val strict: Double, val loose: Double)
```

- [ ] **Step 3: Create Waypoint model**

```kotlin
package it.trektrak.domain.model

data class Waypoint(
    val id: String,
    val name: String,
    val lat: Double? = null,
    val lon: Double? = null,
    val altitude: Double? = null,
    val order: Int,
    val validationState: WaypointValidation? = null
)

data class WaypointValidation(
    val altitude: ValidationResult? = null
)
```

- [ ] **Step 4: Create Leg model**

```kotlin
package it.trektrak.domain.model

data class Leg(
    val id: String,
    val fromWaypointId: String,
    val toWaypointId: String,
    val distance: Double? = null,
    val elevationGain: Double? = null,
    val elevationLoss: Double? = null,
    val azimuth: Double? = null,
    val legOrder: Int,
    val routeGeometry: List<LatLon>? = null,
    val elevationProfile: List<ProfilePoint>? = null,
    val estimatedTime: Double? = null,
    val slope: Double? = null,
    val validationState: LegValidation? = null
)

data class ProfilePoint(val distance: Double, val elevation: Double)

data class LegValidation(
    val distance: ValidationResult? = null,
    val elevationGain: ValidationResult? = null,
    val elevationLoss: ValidationResult? = null,
    val azimuth: ValidationResult? = null
)
```

- [ ] **Step 5: Create Itinerary model**

```kotlin
package it.trektrak.domain.model

data class Itinerary(
    val id: String,
    val name: String,
    val createdAt: String,
    val updatedAt: String,
    val waypoints: List<Waypoint>,
    val legs: List<Leg>
)
```

- [ ] **Step 6: Create AppSettings model**

```kotlin
package it.trektrak.domain.model

enum class AppMode { LEARN, TRACK }
enum class DifficultyGrade { T1, T2, T3, T4, T5, T6 }

data class AppSettings(
    val tolerances: ToleranceSettings = ToleranceSettings(),
    val mapDisplay: MapDisplaySettings = MapDisplaySettings(),
    val quizQuestionsPerSession: Int = 5,
    val tutorialSeen: Boolean = false,
    val lastWhatsNewVersion: String = ""
)

data class ToleranceSettings(
    val altitude: Double = 50.0,
    val distance: Double = 10.0,       // km
    val azimuth: Double = 5.0,         // degrees
    val elevationDelta: Double = 15.0  // meters
)

data class MapDisplaySettings(
    val baseMap: String = "opentopomap",
    val showHikingTrails: Boolean = true,
    val showCoordinateGrid: Boolean = false,
    val sampleInterval: Int = 50,
    val coloredPath: Boolean = false,
    val trailRouting: Boolean = false
)
```

- [ ] **Step 7: Create QuizSession and LearningHistory models**

```kotlin
package it.trektrak.domain.model

data class QuizSession(
    val id: String,
    val date: String,
    val questions: List<QuizQuestion>,
    val totalScore: Int
)

data class QuizQuestion(
    val type: QuizQuestionType,
    val targetPoint: LatLon,
    val referencePoint: LatLon? = null,
    val userAnswer: Double,
    val correctAnswer: Double,
    val score: Int
)

enum class QuizQuestionType { COORDINATES, ALTITUDE, DISTANCE, AZIMUTH }

data class LearningSession(
    val id: Long = 0,
    val date: String,
    val category: String,
    val attempts: Int,
    val accurateCount: Int
)
```

- [ ] **Step 8: Commit**

```bash
git add app/src/main/java/it/trektrak/domain/model/
git commit -m "feat: add domain models (Waypoint, Leg, Itinerary, Settings, Quiz)"
```

---

## Phase 2: Domain Logic (Pure Kotlin, TDD)

### Task 3: Geo Calculations

Port all functions from `src/lib/calculations.ts`. Pure math, no Android deps. Full TDD.

**Files:**
- Create: `app/src/main/java/it/trektrak/domain/calculation/GeoCalculations.kt`
- Create: `app/src/test/java/it/trektrak/domain/calculation/GeoCalculationsTest.kt`

**Reference:** `src/lib/calculations.ts`

- [ ] **Step 1: Write tests for haversineDistance**

```kotlin
package it.trektrak.domain.calculation

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class GeoCalculationsTest {
    @Test
    fun `haversineDistance between Rome and Milan`() {
        // Rome (41.9028, 12.4964) to Milan (45.4642, 9.1900)
        val d = GeoCalculations.haversineDistance(41.9028, 12.4964, 45.4642, 9.1900)
        assertEquals(477.0, d, 5.0) // ~477 km, ±5 km
    }

    @Test
    fun `haversineDistance same point returns zero`() {
        val d = GeoCalculations.haversineDistance(46.0, 11.0, 46.0, 11.0)
        assertEquals(0.0, d, 0.001)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "it.trektrak.domain.calculation.GeoCalculationsTest"`
Expected: FAIL — class not found

- [ ] **Step 3: Implement GeoCalculations object**

```kotlin
package it.trektrak.domain.calculation

import it.trektrak.domain.model.DifficultyGrade
import it.trektrak.domain.model.LatLon
import it.trektrak.domain.model.ProfilePoint
import kotlin.math.*

object GeoCalculations {
    const val EARTH_RADIUS_KM = 6371.0

    /** Great-circle distance in km using haversine formula. */
    fun haversineDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2).pow(2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLon / 2).pow(2)
        return 2 * EARTH_RADIUS_KM * asin(sqrt(a))
    }

    /** Forward azimuth (bearing) from A to B in degrees [0, 360). */
    fun forwardAzimuth(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val φ1 = Math.toRadians(lat1)
        val φ2 = Math.toRadians(lat2)
        val Δλ = Math.toRadians(lon2 - lon1)
        val y = sin(Δλ) * cos(φ2)
        val x = cos(φ1) * sin(φ2) - sin(φ1) * cos(φ2) * cos(Δλ)
        val θ = atan2(y, x)
        return (Math.toDegrees(θ) + 360) % 360
    }

    /**
     * Munter hiking time formula. Returns time in minutes.
     * Horizontal: 4 km/h, Vertical gain: 400 m/h, Vertical loss: 800 m/h.
     */
    fun calculateMunterTime(distanceKm: Double, gainM: Double, lossM: Double): Double {
        val tHoriz = (distanceKm / 4.0) * 60.0
        val tGain = (gainM / 400.0) * 60.0
        val tLoss = (lossM / 800.0) * 60.0
        val tVert = maxOf(tGain, tLoss)
        return maxOf(tHoriz, tVert) + 0.5 * minOf(tHoriz, tVert)
    }

    /** Slope percentage: max(gain, loss) / horizontal distance * 100. */
    fun calculateSlope(distanceKm: Double, gainM: Double, lossM: Double): Double {
        if (distanceKm <= 0) return 0.0
        return maxOf(gainM, lossM) / (distanceKm * 1000) * 100
    }

    /** SAC difficulty grade from max slope %. */
    fun calculateDifficulty(maxSlopePercent: Double): DifficultyGrade = when {
        maxSlopePercent >= 55 -> DifficultyGrade.T6
        maxSlopePercent >= 45 -> DifficultyGrade.T5
        maxSlopePercent >= 35 -> DifficultyGrade.T4
        maxSlopePercent >= 25 -> DifficultyGrade.T3
        maxSlopePercent >= 15 -> DifficultyGrade.T2
        else -> DifficultyGrade.T1
    }

    /** Linear interpolation of N points between two coordinates. Includes endpoints. */
    fun interpolatePoints(lat1: Double, lon1: Double, lat2: Double, lon2: Double, n: Int): List<LatLon> {
        if (n <= 1) return listOf(LatLon(lat1, lon1))
        return (0 until n).map { i ->
            val t = i.toDouble() / (n - 1)
            LatLon(lat1 + t * (lat2 - lat1), lon1 + t * (lon2 - lon1))
        }
    }

    /** Cumulative elevation gain and loss from a list of elevations. */
    fun cumulativeElevation(elevations: List<Double?>): Pair<Double, Double>? {
        val valid = elevations.filterNotNull()
        if (valid.size < 2) return null
        var gain = 0.0
        var loss = 0.0
        for (i in 1 until valid.size) {
            val diff = valid[i] - valid[i - 1]
            if (diff > 0) gain += diff else loss += -diff
        }
        return Pair(gain, loss)
    }

    /** 5-point weighted moving average [1,2,3,2,1]/9. Preserves first/last. */
    fun smoothAltitudes(data: List<ProfilePoint>): List<ProfilePoint> {
        if (data.size < 5) return data
        val weights = intArrayOf(1, 2, 3, 2, 1)
        val sum = weights.sum()
        return data.mapIndexed { i, pt ->
            if (i < 2 || i > data.size - 3) pt
            else {
                val smoothed = (-2..2).sumOf { j -> data[i + j].elevation * weights[j + 2] } / sum
                pt.copy(elevation = smoothed)
            }
        }
    }

    /** Map slope % to color hex for profile visualization. */
    fun slopeColor(slopePercent: Double): String = when {
        slopePercent >= 30 -> "#EF4444" // red
        slopePercent >= 20 -> "#F97316" // orange
        slopePercent >= 10 -> "#EAB308" // yellow
        else -> "#22C55E"               // green
    }

    /** Sample interval based on distance. */
    fun sampleInterval(distanceM: Double, userInterval: Int? = null): Int {
        if (userInterval != null) return userInterval
        return if (distanceM <= 500) 20 else 50
    }

    /** Map azimuth degrees to cardinal direction. */
    fun azimuthToCardinal(azimuth: Double): String {
        val cardinals = arrayOf("N", "NE", "E", "SE", "S", "SW", "W", "NW")
        val index = ((azimuth + 22.5) / 45).toInt() % 8
        return cardinals[index]
    }

    /**
     * Given cumulative distance along route, interpolate lat/lon position.
     * Uses routeGeometry if available, falls back to straight line.
     */
    fun distanceToPosition(
        distanceKm: Double,
        waypoints: List<it.trektrak.domain.model.Waypoint>,
        legs: List<it.trektrak.domain.model.Leg>
    ): LatLon? {
        if (waypoints.size < 2 || legs.isEmpty()) return null
        var cumDist = 0.0
        for ((i, leg) in legs.withIndex()) {
            val legDist = leg.distance ?: continue
            if (cumDist + legDist >= distanceKm) {
                val fraction = if (legDist > 0) (distanceKm - cumDist) / legDist else 0.0
                val from = waypoints.getOrNull(i) ?: return null
                val to = waypoints.getOrNull(i + 1) ?: return null
                val fromLat = from.lat ?: return null
                val fromLon = from.lon ?: return null
                val toLat = to.lat ?: return null
                val toLon = to.lon ?: return null

                val geom = leg.routeGeometry
                if (geom != null && geom.size >= 2) {
                    return interpolateAlongPolyline(geom, fraction)
                }
                return LatLon(
                    fromLat + fraction * (toLat - fromLat),
                    fromLon + fraction * (toLon - fromLon)
                )
            }
            cumDist += legDist
        }
        return waypoints.lastOrNull()?.let { w ->
            if (w.lat != null && w.lon != null) LatLon(w.lat, w.lon) else null
        }
    }

    private fun interpolateAlongPolyline(points: List<LatLon>, fraction: Double): LatLon {
        if (points.size < 2) return points.first()
        var totalLen = 0.0
        val segLengths = (1 until points.size).map { i ->
            haversineDistance(points[i-1].lat, points[i-1].lon, points[i].lat, points[i].lon)
                .also { totalLen += it }
        }
        val targetDist = fraction * totalLen
        var cum = 0.0
        for (i in segLengths.indices) {
            if (cum + segLengths[i] >= targetDist) {
                val f = if (segLengths[i] > 0) (targetDist - cum) / segLengths[i] else 0.0
                return LatLon(
                    points[i].lat + f * (points[i+1].lat - points[i].lat),
                    points[i].lon + f * (points[i+1].lon - points[i].lon)
                )
            }
            cum += segLengths[i]
        }
        return points.last()
    }
}
```

- [ ] **Step 4: Write remaining tests (Munter, slope, difficulty, azimuth, interpolation, smoothing)**

```kotlin
    @Test
    fun `forwardAzimuth north returns 0`() {
        val az = GeoCalculations.forwardAzimuth(46.0, 11.0, 47.0, 11.0)
        assertEquals(0.0, az, 0.5)
    }

    @Test
    fun `forwardAzimuth east returns 90`() {
        val az = GeoCalculations.forwardAzimuth(46.0, 11.0, 46.0, 12.0)
        assertEquals(90.0, az, 1.0)
    }

    @Test
    fun `calculateMunterTime flat 8km`() {
        val t = GeoCalculations.calculateMunterTime(8.0, 0.0, 0.0)
        assertEquals(120.0, t, 0.1) // 8km / 4km/h = 2h = 120min
    }

    @Test
    fun `calculateMunterTime with elevation gain`() {
        val t = GeoCalculations.calculateMunterTime(4.0, 800.0, 0.0)
        // tHoriz=60, tGain=120, tLoss=0, tVert=120 -> max(60,120)+0.5*min(60,120) = 120+30 = 150
        assertEquals(150.0, t, 0.1)
    }

    @Test
    fun `calculateSlope`() {
        val s = GeoCalculations.calculateSlope(1.0, 200.0, 0.0)
        assertEquals(20.0, s, 0.1) // 200m / 1000m * 100
    }

    @Test
    fun `calculateDifficulty boundaries`() {
        assertEquals(DifficultyGrade.T1, GeoCalculations.calculateDifficulty(10.0))
        assertEquals(DifficultyGrade.T2, GeoCalculations.calculateDifficulty(15.0))
        assertEquals(DifficultyGrade.T3, GeoCalculations.calculateDifficulty(25.0))
        assertEquals(DifficultyGrade.T6, GeoCalculations.calculateDifficulty(60.0))
    }

    @Test
    fun `interpolatePoints generates correct count`() {
        val pts = GeoCalculations.interpolatePoints(46.0, 11.0, 47.0, 12.0, 5)
        assertEquals(5, pts.size)
        assertEquals(46.0, pts.first().lat, 0.001)
        assertEquals(47.0, pts.last().lat, 0.001)
    }

    @Test
    fun `cumulativeElevation sums gains and losses`() {
        val result = GeoCalculations.cumulativeElevation(listOf(100.0, 150.0, 120.0, 200.0))
        assertNotNull(result)
        assertEquals(130.0, result!!.first, 0.1) // gain: 50 + 80
        assertEquals(30.0, result.second, 0.1)   // loss: 30
    }

    @Test
    fun `azimuthToCardinal`() {
        assertEquals("N", GeoCalculations.azimuthToCardinal(0.0))
        assertEquals("E", GeoCalculations.azimuthToCardinal(90.0))
        assertEquals("S", GeoCalculations.azimuthToCardinal(180.0))
        assertEquals("W", GeoCalculations.azimuthToCardinal(270.0))
    }
```

- [ ] **Step 5: Run all tests**

Run: `./gradlew test --tests "it.trektrak.domain.calculation.GeoCalculationsTest"`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add app/src/main/java/it/trektrak/domain/calculation/GeoCalculations.kt
git add app/src/test/java/it/trektrak/domain/calculation/GeoCalculationsTest.kt
git commit -m "feat: add GeoCalculations with full test coverage"
```

---

### Task 4: Validation Logic

**Files:**
- Create: `app/src/main/java/it/trektrak/domain/calculation/ValidationLogic.kt`
- Create: `app/src/test/java/it/trektrak/domain/calculation/ValidationLogicTest.kt`

**Reference:** `src/lib/validation.ts`

- [ ] **Step 1: Write tests**

```kotlin
package it.trektrak.domain.calculation

import it.trektrak.domain.model.Tolerance
import it.trektrak.domain.model.ValidationStatus
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class ValidationLogicTest {
    @Test
    fun `validateValue within strict tolerance is VALID`() {
        val result = ValidationLogic.validateValue(100.0, 102.0, Tolerance(5.0, 10.0))
        assertEquals(ValidationStatus.VALID, result.status)
        assertEquals(2.0, result.delta)
    }

    @Test
    fun `validateValue within loose tolerance is WARNING`() {
        val result = ValidationLogic.validateValue(100.0, 108.0, Tolerance(5.0, 10.0))
        assertEquals(ValidationStatus.WARNING, result.status)
    }

    @Test
    fun `validateValue beyond loose tolerance is ERROR`() {
        val result = ValidationLogic.validateValue(100.0, 120.0, Tolerance(5.0, 10.0))
        assertEquals(ValidationStatus.ERROR, result.status)
    }

    @Test
    fun `validateAzimuth handles wraparound`() {
        // 355° to 5° = 10° difference, not 350°
        val result = ValidationLogic.validateAzimuth(355.0, 5.0, Tolerance(15.0, 30.0))
        assertEquals(ValidationStatus.VALID, result.status)
        assertEquals(10.0, result.delta?.let { kotlin.math.abs(it) }, 0.1)
    }

    @Test
    fun `percentageTolerance calculates strict and loose`() {
        val tol = ValidationLogic.percentageTolerance(100.0, 10.0)
        assertEquals(10.0, tol.strict, 0.01)
        assertEquals(20.0, tol.loose, 0.01)
    }
}
```

- [ ] **Step 2: Implement ValidationLogic**

```kotlin
package it.trektrak.domain.calculation

import it.trektrak.domain.model.Tolerance
import it.trektrak.domain.model.ValidationResult
import it.trektrak.domain.model.ValidationStatus
import kotlin.math.abs

object ValidationLogic {

    fun determineStatus(delta: Double, tolerance: Tolerance): ValidationStatus = when {
        abs(delta) <= tolerance.strict -> ValidationStatus.VALID
        abs(delta) <= tolerance.loose -> ValidationStatus.WARNING
        else -> ValidationStatus.ERROR
    }

    fun validateValue(userValue: Double, realValue: Double, tolerance: Tolerance): ValidationResult {
        val delta = userValue - realValue
        return ValidationResult(
            status = determineStatus(delta, tolerance),
            userValue = userValue,
            realValue = realValue,
            delta = delta,
            tolerance = tolerance
        )
    }

    /** Azimuth validation with angular wraparound (0/360 boundary). */
    fun validateAzimuth(userValue: Double, realValue: Double, tolerance: Tolerance): ValidationResult {
        var delta = userValue - realValue
        if (delta > 180) delta -= 360
        if (delta < -180) delta += 360
        return ValidationResult(
            status = determineStatus(delta, tolerance),
            userValue = userValue,
            realValue = realValue,
            delta = delta,
            tolerance = tolerance
        )
    }

    /** Compute strict and loose tolerance from a percentage. loose = strict * 2. */
    fun percentageTolerance(referenceValue: Double, percentStrict: Double): Tolerance {
        val strict = abs(referenceValue) * (percentStrict / 100.0)
        return Tolerance(strict = strict, loose = strict * 2)
    }
}
```

- [ ] **Step 3: Run tests, verify pass**

Run: `./gradlew test --tests "it.trektrak.domain.calculation.ValidationLogicTest"`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add app/src/main/java/it/trektrak/domain/calculation/ValidationLogic.kt
git add app/src/test/java/it/trektrak/domain/calculation/ValidationLogicTest.kt
git commit -m "feat: add ValidationLogic with azimuth wraparound"
```

---

### Task 5: Difficulty Rating

**Files:**
- Create: `app/src/main/java/it/trektrak/domain/calculation/DifficultyRating.kt`
- Create: `app/src/test/java/it/trektrak/domain/calculation/DifficultyRatingTest.kt`

**Reference:** `src/lib/calculations.ts` (calculateDifficulty function, already in GeoCalculations — this task adds the itinerary-level calculation)

- [ ] **Step 1: Write test**

```kotlin
package it.trektrak.domain.calculation

import it.trektrak.domain.model.DifficultyGrade
import it.trektrak.domain.model.Leg
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class DifficultyRatingTest {
    @Test
    fun `itinerary difficulty uses max slope across all legs`() {
        val legs = listOf(
            Leg("1", "a", "b", distance = 2.0, elevationGain = 100.0, elevationLoss = 0.0,
                azimuth = 90.0, legOrder = 0, slope = 5.0),
            Leg("2", "b", "c", distance = 1.0, elevationGain = 400.0, elevationLoss = 0.0,
                azimuth = 180.0, legOrder = 1, slope = 40.0)
        )
        assertEquals(DifficultyGrade.T4, DifficultyRating.forItinerary(legs))
    }

    @Test
    fun `empty legs returns T1`() {
        assertEquals(DifficultyGrade.T1, DifficultyRating.forItinerary(emptyList()))
    }
}
```

- [ ] **Step 2: Implement**

```kotlin
package it.trektrak.domain.calculation

import it.trektrak.domain.model.DifficultyGrade
import it.trektrak.domain.model.Leg

object DifficultyRating {
    fun forItinerary(legs: List<Leg>): DifficultyGrade {
        val maxSlope = legs.mapNotNull { it.slope }.maxOrNull() ?: 0.0
        return GeoCalculations.calculateDifficulty(maxSlope)
    }
}
```

- [ ] **Step 3: Run, verify, commit**

Run: `./gradlew test --tests "it.trektrak.domain.calculation.DifficultyRatingTest"`

```bash
git add app/src/main/java/it/trektrak/domain/calculation/DifficultyRating.kt
git add app/src/test/java/it/trektrak/domain/calculation/DifficultyRatingTest.kt
git commit -m "feat: add DifficultyRating for itinerary-level SAC grade"
```

---

### Task 6: Profile Sampling

**Files:**
- Create: `app/src/main/java/it/trektrak/domain/calculation/ProfileSampling.kt`
- Create: `app/src/test/java/it/trektrak/domain/calculation/ProfileSamplingTest.kt`

**Reference:** `src/lib/calculations.ts` (interpolatePoints, smoothAltitudes, sampleInterval, buildGradientStops)

- [ ] **Step 1: Write tests**

```kotlin
package it.trektrak.domain.calculation

import it.trektrak.domain.model.LatLon
import it.trektrak.domain.model.ProfilePoint
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class ProfileSamplingTest {
    @Test
    fun `computeSamplePoints generates correct count for 1km at 50m interval`() {
        val points = ProfileSampling.computeSamplePoints(
            LatLon(46.0, 11.0), LatLon(46.009, 11.0), intervalM = 50
        )
        // ~1km distance, 50m interval → ~20 points + endpoints
        assertTrue(points.size in 18..22)
    }

    @Test
    fun `smoothProfile preserves endpoints`() {
        val data = (0..10).map { ProfilePoint(it * 100.0, 1000.0 + it * 10.0) }
        val smoothed = ProfileSampling.smoothProfile(data)
        assertEquals(data.first().elevation, smoothed.first().elevation, 0.01)
        assertEquals(data.last().elevation, smoothed.last().elevation, 0.01)
    }

    @Test
    fun `smoothProfile returns input if less than 5 points`() {
        val data = listOf(ProfilePoint(0.0, 100.0), ProfilePoint(50.0, 110.0))
        assertEquals(data, ProfileSampling.smoothProfile(data))
    }
}
```

- [ ] **Step 2: Implement**

```kotlin
package it.trektrak.domain.calculation

import it.trektrak.domain.model.LatLon
import it.trektrak.domain.model.ProfilePoint

object ProfileSampling {

    /**
     * Generate sample points between two coordinates at given interval.
     * Returns list of LatLon points including endpoints.
     */
    fun computeSamplePoints(from: LatLon, to: LatLon, intervalM: Int): List<LatLon> {
        val distKm = GeoCalculations.haversineDistance(from.lat, from.lon, to.lat, to.lon)
        val distM = distKm * 1000
        val numPoints = maxOf(2, (distM / intervalM).toInt() + 1)
        return GeoCalculations.interpolatePoints(from.lat, from.lon, to.lat, to.lon, numPoints)
    }

    /** 5-point weighted moving average [1,2,3,2,1]/9. Delegates to GeoCalculations. */
    fun smoothProfile(data: List<ProfilePoint>): List<ProfilePoint> {
        return GeoCalculations.smoothAltitudes(data)
    }

    /** Build gradient stops for elevation profile coloring. */
    fun buildGradientStops(data: List<ProfilePoint>, totalDistance: Double): List<GradientStop> {
        if (data.size < 2 || totalDistance <= 0) return emptyList()
        return (1 until data.size).map { i ->
            val slope = kotlin.math.abs(data[i].elevation - data[i-1].elevation) /
                    maxOf(1.0, (data[i].distance - data[i-1].distance))  * 100
            val offset = data[i].distance / totalDistance
            GradientStop(offset = offset.coerceIn(0.0, 1.0), color = GeoCalculations.slopeColor(slope))
        }
    }
}

data class GradientStop(val offset: Double, val color: String)
```

- [ ] **Step 3: Run, verify, commit**

```bash
git add app/src/main/java/it/trektrak/domain/calculation/ProfileSampling.kt
git add app/src/test/java/it/trektrak/domain/calculation/ProfileSamplingTest.kt
git commit -m "feat: add ProfileSampling with smoothing and gradient stops"
```

---

### Task 7: Didactic Tips

**Files:**
- Create: `app/src/main/java/it/trektrak/domain/calculation/DidacticTips.kt`
- Create: `app/src/test/java/it/trektrak/domain/calculation/DidacticTipsTest.kt`

**Reference:** `src/lib/didactic-tips.ts`

- [ ] **Step 1: Write tests**

```kotlin
package it.trektrak.domain.calculation

import it.trektrak.domain.model.Tolerance
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class DidacticTipsTest {
    @Test
    fun `no tip when delta within strict tolerance`() {
        assertNull(DidacticTips.getTip("altitude", 3.0, Tolerance(5.0, 10.0)))
    }

    @Test
    fun `small band tip for altitude`() {
        val tip = DidacticTips.getTip("altitude", 8.0, Tolerance(5.0, 10.0))
        assertNotNull(tip)
        assertTrue(tip!!.contains("isoipsa")) // Italian tip about contour lines
    }

    @Test
    fun `large band tip for distance`() {
        val tip = DidacticTips.getTip("distance", 25.0, Tolerance(5.0, 10.0))
        assertNotNull(tip)
        assertTrue(tip!!.contains("curve") || tip.contains("sentiero"))
    }
}
```

- [ ] **Step 2: Implement (Italian tips, same as PWA)**

```kotlin
package it.trektrak.domain.calculation

import it.trektrak.domain.model.Tolerance
import kotlin.math.abs

object DidacticTips {

    private enum class Band { SMALL, MEDIUM, LARGE }

    private fun getBand(delta: Double, tolerance: Tolerance): Band? {
        val d = abs(delta)
        return when {
            d <= tolerance.strict -> null // no tip needed
            d <= tolerance.loose -> Band.SMALL
            d <= tolerance.loose * 2 -> Band.MEDIUM
            else -> Band.LARGE
        }
    }

    private val tips = mapOf(
        "altitude" to mapOf(
            Band.SMALL to "Controlla la lettura dell'isoipsa più vicina al punto.",
            Band.MEDIUM to "Verifica le isoipse direttrici (le linee più spesse, ogni 5 isoipse).",
            Band.LARGE to "Potresti aver letto la quota di un punto adiacente. Riparti dalla direttrice più vicina e conta le isoipse."
        ),
        "distance" to mapOf(
            Band.SMALL to "Verifica il fattore di scala della carta. 1 cm a 1:25.000 = 250 m.",
            Band.MEDIUM to "Controlla la scala: stai usando la conversione corretta?",
            Band.LARGE to "Il sentiero ha curve: misura lungo il tracciato, non in linea d'aria."
        ),
        "elevationGain" to mapOf(
            Band.SMALL to "Considera tutti i piccoli saliscendi intermedi tra i due punti.",
            Band.MEDIUM to "Ricontrolla il profilo tra i due punti contando tutti i tratti in salita.",
            Band.LARGE to "Il dislivello cumulativo è la somma di TUTTI i tratti in salita, non solo la differenza tra partenza e arrivo."
        ),
        "elevationLoss" to mapOf(
            Band.SMALL to "Considera tutti i piccoli saliscendi intermedi tra i due punti.",
            Band.MEDIUM to "Ricontrolla il profilo tra i due punti contando tutti i tratti in discesa.",
            Band.LARGE to "Il dislivello cumulativo è la somma di TUTTI i tratti in discesa, non solo la differenza tra partenza e arrivo."
        ),
        "azimuth" to mapOf(
            Band.SMALL to "Controlla la declinazione magnetica: può variare di qualche grado.",
            Band.MEDIUM to "Verifica di aver misurato dal Nord geografico (alto della carta), non da un riferimento arbitrario.",
            Band.LARGE to "Potresti aver invertito la direzione. L'azimuth è la direzione DA partenza A arrivo, in senso orario dal Nord."
        )
    )

    /**
     * Returns a contextual didactic tip for the given field and error magnitude.
     * Returns null if the delta is within strict tolerance (no tip needed).
     */
    fun getTip(field: String, delta: Double, tolerance: Tolerance): String? {
        val band = getBand(delta, tolerance) ?: return null
        return tips[field]?.get(band)
    }
}
```

- [ ] **Step 3: Run, verify, commit**

```bash
git add app/src/main/java/it/trektrak/domain/calculation/DidacticTips.kt
git add app/src/test/java/it/trektrak/domain/calculation/DidacticTipsTest.kt
git commit -m "feat: add DidacticTips with Italian contextual hints"
```

---

### Task 8: Coordinate Grid

**Files:**
- Create: `app/src/main/java/it/trektrak/domain/calculation/CoordinateGrid.kt`
- Create: `app/src/test/java/it/trektrak/domain/calculation/CoordinateGridTest.kt`

**Reference:** `src/lib/grid.ts`

- [ ] **Step 1: Write tests**

```kotlin
package it.trektrak.domain.calculation

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class CoordinateGridTest {
    @Test
    fun `zoom 10 uses 0_1 degree interval`() {
        val grid = CoordinateGrid.computeGridLines(45.0, 46.0, 10.0, 12.0, zoom = 10)
        assertEquals(0.1, grid.interval, 0.001)
    }

    @Test
    fun `zoom 6 uses 1 degree interval`() {
        val grid = CoordinateGrid.computeGridLines(44.0, 47.0, 9.0, 13.0, zoom = 6)
        assertEquals(1.0, grid.interval, 0.001)
    }

    @Test
    fun `grid lines cover bounds`() {
        val grid = CoordinateGrid.computeGridLines(45.9, 46.1, 10.9, 11.1, zoom = 12)
        assertTrue(grid.latLines.isNotEmpty())
        assertTrue(grid.lonLines.isNotEmpty())
        assertTrue(grid.latLines.first() <= 45.9)
        assertTrue(grid.latLines.last() >= 46.1)
    }
}
```

- [ ] **Step 2: Implement**

```kotlin
package it.trektrak.domain.calculation

import kotlin.math.ceil
import kotlin.math.floor

data class GridLines(
    val latLines: List<Double>,
    val lonLines: List<Double>,
    val interval: Double
)

object CoordinateGrid {

    fun computeGridLines(
        south: Double, north: Double,
        west: Double, east: Double,
        zoom: Int
    ): GridLines {
        val interval = when {
            zoom <= 8 -> 1.0
            zoom <= 11 -> 0.1
            zoom <= 14 -> 0.01
            else -> 0.001
        }

        val latStart = floor(south / interval).toInt()
        val latEnd = ceil(north / interval).toInt()
        val lonStart = floor(west / interval).toInt()
        val lonEnd = ceil(east / interval).toInt()

        val precision = 1_000_000_000.0
        val latLines = (latStart..latEnd).map {
            Math.round(it * interval * precision) / precision
        }
        val lonLines = (lonStart..lonEnd).map {
            Math.round(it * interval * precision) / precision
        }

        return GridLines(latLines, lonLines, interval)
    }
}
```

- [ ] **Step 3: Run, verify, commit**

```bash
git add app/src/main/java/it/trektrak/domain/calculation/CoordinateGrid.kt
git add app/src/test/java/it/trektrak/domain/calculation/CoordinateGridTest.kt
git commit -m "feat: add CoordinateGrid with zoom-based intervals"
```

---

### Task 9: GPX Exporter

**Files:**
- Create: `app/src/main/java/it/trektrak/domain/export/GpxExporter.kt`
- Create: `app/src/test/java/it/trektrak/domain/export/GpxExporterTest.kt`

**Reference:** `src/lib/export-gpx.ts`

- [ ] **Step 1: Write tests**

```kotlin
package it.trektrak.domain.export

import it.trektrak.domain.model.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class GpxExporterTest {
    @Test
    fun `generates valid GPX with waypoints and track`() {
        val waypoints = listOf(
            Waypoint("1", "Start", 46.0, 11.0, 500.0, 0),
            Waypoint("2", "End", 46.1, 11.1, 800.0, 1)
        )
        val legs = listOf(
            Leg("l1", "1", "2", distance = 1.5, elevationGain = 300.0, elevationLoss = 0.0,
                azimuth = 45.0, legOrder = 0)
        )
        val gpx = GpxExporter.generate("Test Itinerary", waypoints, legs)

        assertTrue(gpx.contains("<?xml"))
        assertTrue(gpx.contains("<gpx"))
        assertTrue(gpx.contains("<wpt lat=\"46.0\" lon=\"11.0\""))
        assertTrue(gpx.contains("<name>Start</name>"))
        assertTrue(gpx.contains("<trk>"))
        assertTrue(gpx.contains("<ele>500.0</ele>"))
    }

    @Test
    fun `escapes XML special characters in name`() {
        val waypoints = listOf(
            Waypoint("1", "Start & <End>", 46.0, 11.0, null, 0)
        )
        val gpx = GpxExporter.generate("Test & \"Stuff\"", waypoints, emptyList())
        assertTrue(gpx.contains("Test &amp; &quot;Stuff&quot;"))
        assertTrue(gpx.contains("Start &amp; &lt;End&gt;"))
    }

    @Test
    fun `includes route geometry when available`() {
        val waypoints = listOf(
            Waypoint("1", "A", 46.0, 11.0, 500.0, 0),
            Waypoint("2", "B", 46.1, 11.1, 600.0, 1)
        )
        val legs = listOf(
            Leg("l1", "1", "2", distance = 1.5, elevationGain = 100.0, elevationLoss = 0.0,
                azimuth = 45.0, legOrder = 0,
                routeGeometry = listOf(LatLon(46.0, 11.0), LatLon(46.05, 11.05), LatLon(46.1, 11.1)))
        )
        val gpx = GpxExporter.generate("Route Test", waypoints, legs)
        // Should include intermediate point
        assertTrue(gpx.contains("lat=\"46.05\""))
    }
}
```

- [ ] **Step 2: Implement**

```kotlin
package it.trektrak.domain.export

import it.trektrak.domain.model.Leg
import it.trektrak.domain.model.Waypoint
import java.time.Instant

object GpxExporter {

    fun generate(name: String, waypoints: List<Waypoint>, legs: List<Leg>): String {
        val sb = StringBuilder()
        sb.appendLine("""<?xml version="1.0" encoding="UTF-8"?>""")
        sb.appendLine("""<gpx version="1.1" creator="TrekTrak" xmlns="http://www.topografix.com/GPX/1/1">""")
        sb.appendLine("  <metadata>")
        sb.appendLine("    <name>${escapeXml(name)}</name>")
        sb.appendLine("    <time>${Instant.now()}</time>")
        sb.appendLine("  </metadata>")

        // Waypoints
        for (wp in waypoints) {
            if (wp.lat == null || wp.lon == null) continue
            sb.appendLine("""  <wpt lat="${wp.lat}" lon="${wp.lon}">""")
            sb.appendLine("    <name>${escapeXml(wp.name)}</name>")
            if (wp.altitude != null) sb.appendLine("    <ele>${wp.altitude}</ele>")
            sb.appendLine("  </wpt>")
        }

        // Track
        if (waypoints.size >= 2) {
            sb.appendLine("  <trk>")
            sb.appendLine("    <name>${escapeXml(name)}</name>")
            sb.appendLine("    <trkseg>")
            for ((i, leg) in legs.withIndex()) {
                val from = waypoints.getOrNull(i)
                val geom = leg.routeGeometry
                if (geom != null && geom.size >= 2) {
                    // Include all geometry points; skip first on non-first legs to avoid duplicates
                    val startIdx = if (i == 0) 0 else 1
                    for (j in startIdx until geom.size) {
                        sb.appendLine("""      <trkpt lat="${geom[j].lat}" lon="${geom[j].lon}">""")
                        sb.appendLine("      </trkpt>")
                    }
                } else if (from != null && from.lat != null && from.lon != null) {
                    sb.appendLine("""      <trkpt lat="${from.lat}" lon="${from.lon}">""")
                    if (from.altitude != null) sb.appendLine("        <ele>${from.altitude}</ele>")
                    sb.appendLine("      </trkpt>")
                }
            }
            // Add last waypoint
            val last = waypoints.lastOrNull()
            if (last != null && last.lat != null && last.lon != null && legs.lastOrNull()?.routeGeometry == null) {
                sb.appendLine("""      <trkpt lat="${last.lat}" lon="${last.lon}">""")
                if (last.altitude != null) sb.appendLine("        <ele>${last.altitude}</ele>")
                sb.appendLine("      </trkpt>")
            }
            sb.appendLine("    </trkseg>")
            sb.appendLine("  </trk>")
        }

        sb.appendLine("</gpx>")
        return sb.toString()
    }

    private fun escapeXml(s: String): String = s
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&apos;")
}
```

- [ ] **Step 3: Run, verify, commit**

```bash
git add app/src/main/java/it/trektrak/domain/export/GpxExporter.kt
git add app/src/test/java/it/trektrak/domain/export/GpxExporterTest.kt
git commit -m "feat: add GPX exporter with route geometry support"
```

---

### Task 10: URL Share Codec

**Files:**
- Create: `app/src/main/java/it/trektrak/domain/export/UrlShareCodec.kt`
- Create: `app/src/test/java/it/trektrak/domain/export/UrlShareCodecTest.kt`

**Reference:** `src/lib/share-url.ts`

- [ ] **Step 1: Write tests**

```kotlin
package it.trektrak.domain.export

import it.trektrak.domain.model.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class UrlShareCodecTest {
    @Test
    fun `encode and decode roundtrip`() {
        val waypoints = listOf(
            Waypoint("1", "Start", 46.0, 11.0, 500.0, 0),
            Waypoint("2", "End", 46.1, 11.1, 800.0, 1)
        )
        val legs = listOf(
            Leg("l1", "1", "2", distance = 1.5, elevationGain = 300.0, elevationLoss = 50.0,
                azimuth = 45.0, legOrder = 0)
        )
        val encoded = UrlShareCodec.encode("Test", waypoints, legs)
        assertNotNull(encoded)

        val (name, decodedWp, decodedLegs) = UrlShareCodec.decode(encoded!!)!!
        assertEquals("Test", name)
        assertEquals(2, decodedWp.size)
        assertEquals("Start", decodedWp[0].name)
        assertEquals(46.0, decodedWp[0].lat)
        assertEquals(1.5, decodedLegs[0].distance)
    }

    @Test
    fun `returns null for too many waypoints`() {
        val waypoints = (1..16).map { Waypoint("$it", "WP$it", 46.0, 11.0, null, it) }
        assertNull(UrlShareCodec.encode("Too Many", waypoints, emptyList()))
    }

    @Test
    fun `decode returns null for garbage input`() {
        assertNull(UrlShareCodec.decode("not-valid-data"))
    }
}
```

- [ ] **Step 2: Implement**

```kotlin
package it.trektrak.domain.export

import it.trektrak.domain.model.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import com.aayushatharva.lzstring4j.LZString
import java.util.UUID

object UrlShareCodec {
    const val MAX_WAYPOINTS = 15
    const val MAX_URL_LENGTH = 2000

    @Serializable
    private data class CompactData(
        val n: String,
        val w: List<Double?>,  // [name, lat, lon, alt, name, lat, lon, alt, ...]
        val l: List<Double?>   // [dist, gain, loss, az, ...]
    )
    // Note: names are encoded separately since they're strings

    private val json = Json { ignoreUnknownKeys = true }

    fun encode(name: String, waypoints: List<Waypoint>, legs: List<Leg>): String? {
        if (waypoints.size > MAX_WAYPOINTS) return null

        val wData = mutableListOf<Any?>()
        for (wp in waypoints) {
            wData.addAll(listOf(wp.name, wp.lat, wp.lon, wp.altitude))
        }

        val lData = mutableListOf<Double?>()
        for (leg in legs) {
            lData.addAll(listOf(leg.distance, leg.elevationGain, leg.elevationLoss, leg.azimuth))
        }

        val payload = """{"n":"${name.take(200)}","w":[${
            wData.joinToString(",") { when (it) {
                is String -> "\"${it.take(100)}\""
                is Double -> it.toString()
                null -> "null"
                else -> it.toString()
            }}
        }],"l":[${lData.joinToString(",") { it?.toString() ?: "null" }}]}"""

        val compressed = LZString.compressToEncodedURIComponent(payload) ?: return null
        return if (compressed.length <= MAX_URL_LENGTH) compressed else null
    }

    data class DecodedItinerary(
        val name: String,
        val waypoints: List<Waypoint>,
        val legs: List<Leg>
    )

    fun decode(data: String): DecodedItinerary? {
        return try {
            val decompressed = LZString.decompressFromEncodedURIComponent(data) ?: return null
            val parsed = json.parseToJsonElement(decompressed)
            val obj = parsed as? kotlinx.serialization.json.JsonObject ?: return null

            val name = (obj["n"] as? kotlinx.serialization.json.JsonPrimitive)?.content ?: return null
            if (name.length > 200) return null

            val wArray = (obj["w"] as? kotlinx.serialization.json.JsonArray) ?: return null
            if (wArray.size % 4 != 0) return null

            val waypoints = mutableListOf<Waypoint>()
            for (i in wArray.indices step 4) {
                val wpName = (wArray[i] as? kotlinx.serialization.json.JsonPrimitive)?.content ?: ""
                val lat = (wArray[i+1] as? kotlinx.serialization.json.JsonPrimitive)?.doubleOrNull
                val lon = (wArray[i+2] as? kotlinx.serialization.json.JsonPrimitive)?.doubleOrNull
                val alt = (wArray[i+3] as? kotlinx.serialization.json.JsonPrimitive)?.doubleOrNull
                if (lat != null && !lat.isFinite()) return null
                if (lon != null && !lon.isFinite()) return null
                waypoints.add(Waypoint(
                    id = UUID.randomUUID().toString(),
                    name = wpName.take(100),
                    lat = lat, lon = lon, altitude = alt,
                    order = i / 4
                ))
            }

            val lArray = (obj["l"] as? kotlinx.serialization.json.JsonArray) ?: return null
            if (lArray.size % 4 != 0) return null

            val legs = mutableListOf<Leg>()
            for (i in lArray.indices step 4) {
                val dist = (lArray[i] as? kotlinx.serialization.json.JsonPrimitive)?.doubleOrNull
                val gain = (lArray[i+1] as? kotlinx.serialization.json.JsonPrimitive)?.doubleOrNull
                val loss = (lArray[i+2] as? kotlinx.serialization.json.JsonPrimitive)?.doubleOrNull
                val az = (lArray[i+3] as? kotlinx.serialization.json.JsonPrimitive)?.doubleOrNull
                if (i / 4 < waypoints.size - 1) {
                    legs.add(Leg(
                        id = UUID.randomUUID().toString(),
                        fromWaypointId = waypoints[i/4].id,
                        toWaypointId = waypoints[i/4 + 1].id,
                        distance = dist, elevationGain = gain,
                        elevationLoss = loss, azimuth = az,
                        legOrder = i / 4
                    ))
                }
            }

            DecodedItinerary(name, waypoints, legs)
        } catch (_: Exception) {
            null
        }
    }
}
```

- [ ] **Step 3: Run, verify, commit**

```bash
git add app/src/main/java/it/trektrak/domain/export/UrlShareCodec.kt
git add app/src/test/java/it/trektrak/domain/export/UrlShareCodecTest.kt
git commit -m "feat: add URL share codec with LZ-string compression"
```

---

### Task 11: Learning Stats

**Files:**
- Create: `app/src/main/java/it/trektrak/domain/calculation/LearningStats.kt`
- Create: `app/src/test/java/it/trektrak/domain/calculation/LearningStatsTest.kt`

**Reference:** `src/lib/learning-stats.ts`

- [ ] **Step 1: Write tests**

```kotlin
package it.trektrak.domain.calculation

import it.trektrak.domain.model.LearningSession
import it.trektrak.domain.model.QuizSession
import it.trektrak.domain.model.QuizQuestion
import it.trektrak.domain.model.QuizQuestionType
import it.trektrak.domain.model.LatLon
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class LearningStatsTest {
    @Test
    fun `trend direction up when recent sessions improve`() {
        val sessions = (1..10).map { i ->
            LearningSession(id = i.toLong(), date = "2026-04-${i.toString().padStart(2, '0')}",
                category = "altitude", attempts = 10, accurateCount = i) // improving
        }
        assertEquals(TrendDirection.UP, LearningStats.trendDirection(sessions))
    }

    @Test
    fun `trend direction null with less than 10 sessions`() {
        val sessions = (1..5).map { i ->
            LearningSession(id = i.toLong(), date = "2026-04-0$i",
                category = "altitude", attempts = 10, accurateCount = 5)
        }
        assertNull(LearningStats.trendDirection(sessions))
    }

    @Test
    fun `categoryStats computes valid percent`() {
        val sessions = listOf(
            LearningSession(1, "2026-04-01", "altitude", 10, 7),
            LearningSession(2, "2026-04-02", "altitude", 10, 8)
        )
        val stats = LearningStats.categoryStats(sessions, "altitude")
        assertEquals(75.0, stats.validPercent, 1.0) // (7+8)/20 = 75%
    }
}
```

- [ ] **Step 2: Implement**

```kotlin
package it.trektrak.domain.calculation

import it.trektrak.domain.model.LearningSession
import it.trektrak.domain.model.QuizSession

enum class TrendDirection { UP, DOWN, STABLE }

data class CategoryStat(
    val count: Int,
    val validPercent: Double,
    val warningPercent: Double,
    val errorPercent: Double
)

data class SummaryStats(
    val totalVerifications: Int,
    val totalQuizzes: Int,
    val lastVerifyValidPercent: Double?,
    val lastQuizAverage: Double?
)

object LearningStats {

    /** Requires ≥10 sessions. Compares avg of last 5 vs previous 5. */
    fun trendDirection(sessions: List<LearningSession>): TrendDirection? {
        if (sessions.size < 10) return null
        val sorted = sessions.sortedBy { it.date }
        val recent5 = sorted.takeLast(5)
        val prev5 = sorted.dropLast(5).takeLast(5)

        fun avg(list: List<LearningSession>): Double {
            val totalAttempts = list.sumOf { it.attempts }
            if (totalAttempts == 0) return 0.0
            return list.sumOf { it.accurateCount }.toDouble() / totalAttempts * 100
        }

        val diff = avg(recent5) - avg(prev5)
        return when {
            diff >= 5 -> TrendDirection.UP
            diff <= -5 -> TrendDirection.DOWN
            else -> TrendDirection.STABLE
        }
    }

    fun categoryStats(sessions: List<LearningSession>, category: String): CategoryStat {
        val filtered = sessions.filter { it.category == category }
        val totalAttempts = filtered.sumOf { it.attempts }
        val totalAccurate = filtered.sumOf { it.accurateCount }
        val validPct = if (totalAttempts > 0) totalAccurate.toDouble() / totalAttempts * 100 else 0.0
        return CategoryStat(
            count = filtered.size,
            validPercent = validPct,
            warningPercent = 0.0, // computed from detailed data in UI
            errorPercent = 100.0 - validPct
        )
    }

    fun summaryStats(
        learningSessions: List<LearningSession>,
        quizSessions: List<QuizSession>
    ): SummaryStats {
        val lastVerify = learningSessions.maxByOrNull { it.date }
        val lastVerifyPct = lastVerify?.let {
            if (it.attempts > 0) it.accurateCount.toDouble() / it.attempts * 100 else null
        }
        val lastQuiz = quizSessions.maxByOrNull { it.date }
        return SummaryStats(
            totalVerifications = learningSessions.size,
            totalQuizzes = quizSessions.size,
            lastVerifyValidPercent = lastVerifyPct,
            lastQuizAverage = lastQuiz?.totalScore?.toDouble()
        )
    }
}
```

- [ ] **Step 3: Run, verify, commit**

```bash
git add app/src/main/java/it/trektrak/domain/calculation/LearningStats.kt
git add app/src/test/java/it/trektrak/domain/calculation/LearningStatsTest.kt
git commit -m "feat: add LearningStats with trend analysis"
```

---

## Phase 3: Data Layer (Room + Network)

### Task 12: Room Database, Entities, and DAOs

**Files:**
- Create: `app/src/main/java/it/trektrak/data/local/entity/ItineraryEntity.kt`
- Create: `app/src/main/java/it/trektrak/data/local/entity/WaypointEntity.kt`
- Create: `app/src/main/java/it/trektrak/data/local/entity/LegEntity.kt`
- Create: `app/src/main/java/it/trektrak/data/local/entity/QuizSessionEntity.kt`
- Create: `app/src/main/java/it/trektrak/data/local/entity/LearningSessionEntity.kt`
- Create: `app/src/main/java/it/trektrak/data/local/entity/SettingsEntity.kt`
- Create: `app/src/main/java/it/trektrak/data/local/dao/ItineraryDao.kt`
- Create: `app/src/main/java/it/trektrak/data/local/dao/QuizDao.kt`
- Create: `app/src/main/java/it/trektrak/data/local/dao/LearningDao.kt`
- Create: `app/src/main/java/it/trektrak/data/local/AppDatabase.kt`
- Create: `app/src/main/java/it/trektrak/data/local/Converters.kt`
- Test: `app/src/androidTest/java/it/trektrak/data/local/dao/ItineraryDaoTest.kt`

**Reference:** Spec section "Data Model (Room)"

- [ ] **Step 1: Create all Room entities**

Implement each entity as defined in the spec. Use `@TypeConverters` for JSON fields (validation state, elevation profile, route geometry).

The `Converters.kt` file handles JSON serialization via Kotlin Serialization:

```kotlin
package it.trektrak.data.local

import androidx.room.TypeConverter
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString

class Converters {
    private val json = Json { ignoreUnknownKeys = true }

    @TypeConverter
    fun fromString(value: String?): Map<String, String>? =
        value?.let { json.decodeFromString(it) }

    @TypeConverter
    fun mapToString(value: Map<String, String>?): String? =
        value?.let { json.encodeToString(it) }
}
```

- [ ] **Step 2: Create ItineraryDao**

```kotlin
package it.trektrak.data.local.dao

import androidx.room.*
import it.trektrak.data.local.entity.*
import kotlinx.coroutines.flow.Flow

@Dao
interface ItineraryDao {
    @Query("SELECT * FROM ItineraryEntity ORDER BY updatedAt DESC")
    fun getAllItineraries(): Flow<List<ItineraryEntity>>

    @Query("SELECT * FROM ItineraryEntity WHERE id = :id")
    suspend fun getItineraryById(id: String): ItineraryEntity?

    @Query("SELECT * FROM WaypointEntity WHERE itineraryId = :itineraryId ORDER BY `order` ASC")
    suspend fun getWaypointsForItinerary(itineraryId: String): List<WaypointEntity>

    @Query("SELECT * FROM LegEntity WHERE itineraryId = :itineraryId ORDER BY legOrder ASC")
    suspend fun getLegsForItinerary(itineraryId: String): List<LegEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItinerary(itinerary: ItineraryEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWaypoints(waypoints: List<WaypointEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLegs(legs: List<LegEntity>)

    @Transaction
    suspend fun saveItinerary(
        itinerary: ItineraryEntity,
        waypoints: List<WaypointEntity>,
        legs: List<LegEntity>
    ) {
        insertItinerary(itinerary)
        deleteWaypointsForItinerary(itinerary.id)
        deleteLegsForItinerary(itinerary.id)
        insertWaypoints(waypoints)
        insertLegs(legs)
    }

    @Query("DELETE FROM WaypointEntity WHERE itineraryId = :itineraryId")
    suspend fun deleteWaypointsForItinerary(itineraryId: String)

    @Query("DELETE FROM LegEntity WHERE itineraryId = :itineraryId")
    suspend fun deleteLegsForItinerary(itineraryId: String)

    @Query("DELETE FROM ItineraryEntity WHERE id = :id")
    suspend fun deleteItinerary(id: String)
}
```

- [ ] **Step 3: Create QuizDao and LearningDao**

Similar pattern with `insert`, `getAll`, `delete` for quiz sessions and learning sessions. LearningDao also includes:

```kotlin
@Query("SELECT * FROM LearningSessionEntity ORDER BY date DESC LIMIT 100")
fun getRecentSessions(): Flow<List<LearningSessionEntity>>

@Query("SELECT * FROM LearningSessionEntity WHERE category = :category ORDER BY date DESC")
fun getSessionsByCategory(category: String): Flow<List<LearningSessionEntity>>
```

- [ ] **Step 4: Create AppDatabase**

```kotlin
package it.trektrak.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import it.trektrak.data.local.dao.*
import it.trektrak.data.local.entity.*

@Database(
    entities = [
        ItineraryEntity::class,
        WaypointEntity::class,
        LegEntity::class,
        QuizSessionEntity::class,
        LearningSessionEntity::class,
        SettingsEntity::class
    ],
    version = 1,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun itineraryDao(): ItineraryDao
    abstract fun quizDao(): QuizDao
    abstract fun learningDao(): LearningDao
}
```

- [ ] **Step 5: Write DAO integration test**

```kotlin
@RunWith(AndroidJUnit4::class)
class ItineraryDaoTest {
    private lateinit var db: AppDatabase
    private lateinit var dao: ItineraryDao

    @Before
    fun setup() {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(), AppDatabase::class.java
        ).build()
        dao = db.itineraryDao()
    }

    @After
    fun teardown() { db.close() }

    @Test
    fun saveAndLoadItinerary() = runBlocking {
        val itinerary = ItineraryEntity("1", "Test", "2026-04-16", "2026-04-16", "learn")
        val waypoints = listOf(
            WaypointEntity("w1", "1", "Start", 46.0, 11.0, 500.0, 0, null)
        )
        dao.saveItinerary(itinerary, waypoints, emptyList())

        val loaded = dao.getItineraryById("1")
        assertNotNull(loaded)
        assertEquals("Test", loaded!!.name)

        val wps = dao.getWaypointsForItinerary("1")
        assertEquals(1, wps.size)
        assertEquals("Start", wps[0].name)
    }
}
```

- [ ] **Step 6: Run tests, commit**

```bash
git add app/src/main/java/it/trektrak/data/local/
git add app/src/androidTest/java/it/trektrak/data/local/
git commit -m "feat: add Room database with entities, DAOs, and converters"
```

---

### Task 13: Network Services (Retrofit)

**Files:**
- Create: `app/src/main/java/it/trektrak/data/remote/ElevationService.kt`
- Create: `app/src/main/java/it/trektrak/data/remote/GeocodingService.kt`
- Create: `app/src/main/java/it/trektrak/data/remote/RoutingService.kt`
- Create: `app/src/main/java/it/trektrak/data/remote/OverpassService.kt`
- Create: `app/src/main/java/it/trektrak/data/remote/model/` (response DTOs)

**Reference:** `src/lib/elevation-api.ts`, `src/lib/elevation-proxy.ts`, `src/lib/geocoding-api.ts`, `src/lib/routing-api.ts`, `src/lib/overpass-api.ts`

- [ ] **Step 1: Create Elevation API DTOs and Retrofit interface**

```kotlin
package it.trektrak.data.remote

import it.trektrak.data.remote.model.ElevationResponse
import retrofit2.http.GET
import retrofit2.http.Query
import retrofit2.Response

interface OpenTopoDataApi {
    @GET("v1/eudem25m")
    suspend fun getElevation(@Query("locations") locations: String): Response<ElevationResponse>
}

interface OpenElevationApi {
    @GET("api/v1/lookup")
    suspend fun getElevation(@Query("locations") locations: String): Response<ElevationResponse>
}
```

```kotlin
package it.trektrak.data.remote.model

import kotlinx.serialization.Serializable

@Serializable
data class ElevationResponse(val results: List<ElevationResult>)

@Serializable
data class ElevationResult(val elevation: Double?, val location: ElevationLocation? = null)

@Serializable
data class ElevationLocation(val lat: Double, val lng: Double)
```

- [ ] **Step 2: Implement ElevationService with caching, batching, fallback**

```kotlin
package it.trektrak.data.remote

import it.trektrak.domain.model.LatLon
import kotlinx.coroutines.delay
import java.util.concurrent.ConcurrentHashMap

class ElevationService(
    private val openTopoApi: OpenTopoDataApi,
    private val openElevationApi: OpenElevationApi
) {
    private val cache = ConcurrentHashMap<Pair<Double, Double>, Double?>()
    private val BATCH_SIZE = 95

    suspend fun fetchElevation(lat: Double, lon: Double): Double? {
        val key = Pair(lat, lon)
        cache[key]?.let { return it }
        val locations = "$lat,$lon"
        val result = fetchFromPrimaryThenFallback(locations)
        val elevation = result?.firstOrNull()
        cache[key] = elevation
        return elevation
    }

    suspend fun fetchElevationProfile(points: List<LatLon>): List<Double?> {
        if (points.isEmpty()) return emptyList()
        // Check cache first
        val results = MutableList<Double?>(points.size) { null }
        val uncached = mutableListOf<IndexedValue<LatLon>>()
        points.forEachIndexed { i, pt ->
            val cached = cache[Pair(pt.lat, pt.lon)]
            if (cached != null) results[i] = cached
            else uncached.add(IndexedValue(i, pt))
        }
        // Batch fetch uncached
        for (batch in uncached.chunked(BATCH_SIZE)) {
            val locations = batch.joinToString("|") { "${it.value.lat},${it.value.lon}" }
            val elevations = fetchFromPrimaryThenFallback(locations) ?: List(batch.size) { null }
            batch.forEachIndexed { j, iv ->
                val el = elevations.getOrNull(j)
                results[iv.index] = el
                cache[Pair(iv.value.lat, iv.value.lon)] = el
            }
            if (batch.size == BATCH_SIZE) delay(1000) // rate limit
        }
        return results
    }

    private suspend fun fetchFromPrimaryThenFallback(locations: String): List<Double?>? {
        // Try OpenTopoData
        try {
            val response = openTopoApi.getElevation(locations)
            if (response.isSuccessful) {
                return response.body()?.results?.map { it.elevation }
            }
        } catch (_: Exception) {}
        // Fallback: Open-Elevation
        try {
            val response = openElevationApi.getElevation(locations)
            if (response.isSuccessful) {
                return response.body()?.results?.map { it.elevation }
            }
        } catch (_: Exception) {}
        return null
    }

    fun clearCache() { cache.clear() }
}
```

- [ ] **Step 3: Implement GeocodingService, RoutingService, OverpassService**

Follow same pattern: Retrofit interface + service class. Key details:
- GeocodingService: add `User-Agent: TrekTrak/1.0` header via OkHttp interceptor
- RoutingService: API key from `BuildConfig.ORS_API_KEY` as `Authorization` header
- OverpassService: POST with Overpass QL query body, 10s timeout

- [ ] **Step 4: Commit**

```bash
git add app/src/main/java/it/trektrak/data/remote/
git commit -m "feat: add Retrofit services for elevation, geocoding, routing, Overpass"
```

---

### Task 14: Repository Layer

**Files:**
- Create: `app/src/main/java/it/trektrak/data/repository/ItineraryRepository.kt` (interface)
- Create: `app/src/main/java/it/trektrak/data/repository/ItineraryRepositoryImpl.kt`
- Create: `app/src/main/java/it/trektrak/data/repository/QuizRepository.kt`
- Create: `app/src/main/java/it/trektrak/data/repository/LearningRepository.kt`
- Create: `app/src/main/java/it/trektrak/data/repository/SettingsRepository.kt`
- Create: `app/src/main/java/it/trektrak/data/repository/EntityMapper.kt`

**Reference:** `src/lib/storage.ts`

- [ ] **Step 1: Create EntityMapper (Entity ↔ Domain model)**

```kotlin
package it.trektrak.data.repository

import it.trektrak.data.local.entity.*
import it.trektrak.domain.model.*
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString

object EntityMapper {
    private val json = Json { ignoreUnknownKeys = true }

    fun toWaypoint(entity: WaypointEntity): Waypoint = Waypoint(
        id = entity.id, name = entity.name,
        lat = entity.lat, lon = entity.lon, altitude = entity.altitude,
        order = entity.order,
        validationState = entity.validationJson?.let {
            json.decodeFromString<WaypointValidation>(it)
        }
    )

    fun toWaypointEntity(wp: Waypoint, itineraryId: String): WaypointEntity = WaypointEntity(
        id = wp.id, itineraryId = itineraryId, name = wp.name,
        lat = wp.lat, lon = wp.lon, altitude = wp.altitude,
        order = wp.order,
        validationJson = wp.validationState?.let { json.encodeToString(it) }
    )

    // ... similar for Leg, QuizSession, LearningSession, Settings
    // Leg strips elevationProfile on save (same as PWA storage.ts)
}
```

- [ ] **Step 2: Create ItineraryRepository interface**

```kotlin
package it.trektrak.data.repository

import it.trektrak.domain.model.Itinerary
import kotlinx.coroutines.flow.Flow

interface ItineraryRepository {
    fun getAllItineraries(): Flow<List<Itinerary>>
    suspend fun getItinerary(id: String): Itinerary?
    suspend fun saveItinerary(itinerary: Itinerary)
    suspend fun deleteItinerary(id: String)
}
```

- [ ] **Step 3: Implement ItineraryRepositoryImpl**

Uses `ItineraryDao` + `EntityMapper` to convert between layers. Flow from DAO maps entities to domain models.

- [ ] **Step 4: Implement QuizRepository, LearningRepository, SettingsRepository**

Same pattern. SettingsRepository handles default values (creates singleton row if not exists).

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/it/trektrak/data/repository/
git commit -m "feat: add Repository layer with Entity-Domain mapping"
```

---

### Task 15: Koin Dependency Injection

**Files:**
- Create: `app/src/main/java/it/trektrak/di/AppModule.kt`
- Create: `app/src/main/java/it/trektrak/di/ViewModelModule.kt`
- Create: `app/src/main/java/it/trektrak/TrekTrakApplication.kt`

- [ ] **Step 1: Create AppModule**

```kotlin
package it.trektrak.di

import androidx.room.Room
import it.trektrak.data.local.AppDatabase
import it.trektrak.data.remote.*
import it.trektrak.data.repository.*
import it.trektrak.domain.calculation.AutoFillPipeline
import okhttp3.OkHttpClient
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import java.util.concurrent.TimeUnit

val appModule = module {
    // Database
    single {
        Room.databaseBuilder(androidContext(), AppDatabase::class.java, "trektrak.db")
            .build()
    }
    single { get<AppDatabase>().itineraryDao() }
    single { get<AppDatabase>().quizDao() }
    single { get<AppDatabase>().learningDao() }

    // Network
    single {
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .cache(okhttp3.Cache(androidContext().cacheDir.resolve("http_cache"), 10L * 1024 * 1024))
            .build()
    }

    single {
        val json = Json { ignoreUnknownKeys = true }
        val contentType = "application/json".toMediaType()
        fun buildRetrofit(baseUrl: String) = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(get())
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()

        buildRetrofit("https://api.opentopodata.org/")
            .create(OpenTopoDataApi::class.java)
    }

    single { ElevationService(get(), get()) }
    single { GeocodingService(get()) }
    single { RoutingService(get()) }
    single { OverpassService(get()) }

    // Repositories
    single<ItineraryRepository> { ItineraryRepositoryImpl(get()) }
    single { QuizRepository(get()) }
    single { LearningRepository(get()) }
    single { SettingsRepository(get()) }

    // Domain
    single { AutoFillPipeline(get(), get()) }
    single { NetworkMonitor(androidContext()) }
}
```

- [ ] **Step 2: Create ViewModelModule**

```kotlin
package it.trektrak.di

import it.trektrak.ui.map.MapViewModel
import it.trektrak.ui.panel.PanelViewModel
import it.trektrak.ui.quiz.QuizViewModel
import it.trektrak.ui.learn.ProgressViewModel
import it.trektrak.ui.settings.SettingsViewModel
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.module

val viewModelModule = module {
    viewModel { MapViewModel(get(), get(), get(), get()) }
    viewModel { PanelViewModel(get(), get(), get()) }
    viewModel { QuizViewModel(get(), get(), get()) }
    viewModel { ProgressViewModel(get(), get()) }
    viewModel { SettingsViewModel(get()) }
}
```

- [ ] **Step 3: Create TrekTrakApplication**

```kotlin
package it.trektrak

import android.app.Application
import it.trektrak.di.appModule
import it.trektrak.di.viewModelModule
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.startKoin
import org.osmdroid.config.Configuration

class TrekTrakApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Koin DI
        startKoin {
            androidContext(this@TrekTrakApplication)
            modules(appModule, viewModelModule)
        }
        // osmdroid config
        Configuration.getInstance().apply {
            userAgentValue = "TrekTrak/1.0"
            osmdroidTileCache = cacheDir.resolve("osmdroid")
            tileFileSystemCacheMaxBytes = 100L * 1024 * 1024
            tileFileSystemCacheTrimBytes = 80L * 1024 * 1024
            expirationOverrideDuration = 30L * 24 * 60 * 60 * 1000
        }
    }
}
```

Update `AndroidManifest.xml` to reference `TrekTrakApplication` and add permissions:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<application android:name=".TrekTrakApplication" ...>
```

- [ ] **Step 4: Build to verify DI compiles**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add app/src/main/java/it/trektrak/di/
git add app/src/main/java/it/trektrak/TrekTrakApplication.kt
git add app/src/main/AndroidManifest.xml
git commit -m "feat: add Koin DI, Application class, osmdroid config"
```

---

## Phase 4: UI Foundation

### Task 16: Theme, Navigation, and Main Scaffold

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/theme/Theme.kt`
- Create: `app/src/main/java/it/trektrak/ui/theme/Color.kt`
- Create: `app/src/main/java/it/trektrak/ui/navigation/TrekTrakNavigation.kt`
- Modify: `app/src/main/java/it/trektrak/MainActivity.kt`

- [ ] **Step 1: Create Material 3 theme**

Define color scheme matching the PWA's Tailwind-based green/slate palette. Light theme only for v1.

- [ ] **Step 2: Create Navigation with single MainScreen route**

```kotlin
@Composable
fun TrekTrakNavigation() {
    val navController = rememberNavController()
    NavHost(navController, startDestination = "main") {
        composable("main") { MainScreen() }
    }
}
```

- [ ] **Step 3: Create MainScreen scaffold**

The responsive layout shell:
- Uses `calculateWindowSizeClass()` for Compact/Medium/Expanded
- Compact: `Box` with map full-screen + `BottomSheetScaffold` for panel
- Expanded: `Row` with panel (380dp) + map

- [ ] **Step 4: Wire MainActivity**

```kotlin
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TrekTrakTheme {
                TrekTrakNavigation()
            }
        }
    }
}
```

- [ ] **Step 5: Run on emulator, verify empty screen renders**

- [ ] **Step 6: Commit**

```bash
git add app/src/main/java/it/trektrak/ui/theme/
git add app/src/main/java/it/trektrak/ui/navigation/
git add app/src/main/java/it/trektrak/MainActivity.kt
git commit -m "feat: add theme, navigation, and responsive MainScreen scaffold"
```

---

### Task 17: Map View with osmdroid

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/map/TrekMapView.kt`
- Create: `app/src/main/java/it/trektrak/ui/map/TileProviders.kt`
- Create: `app/src/main/java/it/trektrak/ui/map/MapViewModel.kt`

- [ ] **Step 1: Create TileProviders**

```kotlin
package it.trektrak.ui.map

import org.osmdroid.tileprovider.tilesource.OnlineTileSourceBase
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.MapTileIndex

object TileProviders {
    val OSM = TileSourceFactory.MAPNIK

    val OPEN_TOPO_MAP = object : OnlineTileSourceBase(
        "OpenTopoMap", 0, 17, 256, ".png",
        arrayOf("https://a.tile.opentopomap.org/", "https://b.tile.opentopomap.org/")
    ) {
        override fun getTileURLString(pMapTileIndex: Long): String {
            val z = MapTileIndex.getZoom(pMapTileIndex)
            val x = MapTileIndex.getX(pMapTileIndex)
            val y = MapTileIndex.getY(pMapTileIndex)
            return "${baseUrl}$z/$x/$y.png"
        }
    }

    val CYCLOSM = object : OnlineTileSourceBase(
        "CyclOSM", 0, 19, 256, ".png",
        arrayOf("https://a.tile-cyclosm.openstreetmap.fr/cyclosm/",
                "https://b.tile-cyclosm.openstreetmap.fr/cyclosm/")
    ) {
        override fun getTileURLString(pMapTileIndex: Long): String {
            val z = MapTileIndex.getZoom(pMapTileIndex)
            val x = MapTileIndex.getX(pMapTileIndex)
            val y = MapTileIndex.getY(pMapTileIndex)
            return "${baseUrl}$z/$x/$y.png"
        }
    }

    // Thunderforest requires API key
    fun thunderforest(apiKey: String) = object : OnlineTileSourceBase(
        "Thunderforest", 0, 22, 256, ".png",
        arrayOf("https://tile.thunderforest.com/outdoors/")
    ) {
        override fun getTileURLString(pMapTileIndex: Long): String {
            val z = MapTileIndex.getZoom(pMapTileIndex)
            val x = MapTileIndex.getX(pMapTileIndex)
            val y = MapTileIndex.getY(pMapTileIndex)
            return "${baseUrl}$z/$x/$y.png?apikey=$apiKey"
        }
    }

    fun forName(name: String, thunderforestKey: String = ""): OnlineTileSourceBase = when (name) {
        "opentopomap" -> OPEN_TOPO_MAP
        "cyclosm" -> CYCLOSM
        "thunderforest" -> thunderforest(thunderforestKey)
        else -> OSM as OnlineTileSourceBase
    }
}
```

- [ ] **Step 2: Create MapViewModel**

```kotlin
package it.trektrak.ui.map

import androidx.lifecycle.ViewModel
import it.trektrak.data.repository.ItineraryRepository
import it.trektrak.data.repository.SettingsRepository
import it.trektrak.data.remote.ElevationService
import it.trektrak.domain.calculation.AutoFillPipeline
import it.trektrak.domain.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ToolType { COMPASS, RULER, QUIZ }

data class SharedMapState(
    val profileHoverDistance: Float? = null,
    val profileFlyToIndex: Int? = null,
    val selectedLegIndex: Int? = null
)

data class MapUiState(
    val itineraryId: String = "",
    val itineraryName: String = "Nuovo Itinerario",
    val waypoints: List<Waypoint> = emptyList(),
    val legs: List<Leg> = emptyList(),
    val appMode: AppMode = AppMode.LEARN,
    val settings: AppSettings = AppSettings(),
    val activeTool: ToolType? = null,
    val sharedMapState: SharedMapState = SharedMapState(),
    val quizPoints: List<LatLon> = emptyList()
)

class MapViewModel(
    private val itineraryRepo: ItineraryRepository,
    private val settingsRepo: SettingsRepository,
    private val elevationService: ElevationService,
    private val autoFillPipeline: AutoFillPipeline
) : ViewModel() {
    private val _uiState = MutableStateFlow(MapUiState())
    val uiState: StateFlow<MapUiState> = _uiState.asStateFlow()

    // Waypoint actions: add, remove, update, reorder
    // Leg actions: update
    // Mode switching
    // Tool activation/deactivation
    // Profile hover/fly-to
    // Save/load itinerary
    // ... (each action updates _uiState via copy())
}
```

- [ ] **Step 3: Create TrekMapView Composable (AndroidView wrapper)**

```kotlin
package it.trektrak.ui.map

import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import org.osmdroid.views.MapView
import org.osmdroid.util.GeoPoint

@Composable
fun TrekMapView(
    modifier: Modifier = Modifier,
    viewModel: MapViewModel
) {
    val uiState by viewModel.uiState.collectAsState()

    AndroidView(
        modifier = modifier,
        factory = { context ->
            MapView(context).apply {
                setMultiTouchControls(true)
                controller.setZoom(10.0)
                controller.setCenter(GeoPoint(46.07, 11.12)) // Default: Trento
                setTileSource(TileProviders.forName(uiState.settings.mapDisplay.baseMap))
            }
        },
        update = { mapView ->
            // Update tile source when settings change
            mapView.setTileSource(
                TileProviders.forName(uiState.settings.mapDisplay.baseMap)
            )
            // Update overlays (waypoints, polylines, etc.) — wired in later tasks
        }
    )
}
```

- [ ] **Step 4: Integrate TrekMapView into MainScreen**

- [ ] **Step 5: Run on emulator, verify map renders with tile loading**

- [ ] **Step 6: Commit**

```bash
git add app/src/main/java/it/trektrak/ui/map/
git commit -m "feat: add osmdroid map view with tile providers and MapViewModel"
```

---

## Phase 5: Map Overlays

### Task 18: Waypoint Overlay (Markers)

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/map/overlay/WaypointOverlay.kt`

**Reference:** `src/components/map/InteractiveMap.tsx` (marker rendering)

- [ ] **Step 1: Implement draggable waypoint markers**

osmdroid `Marker` class with custom green icon. `OnMarkerDragListener` calls `viewModel.updateWaypointPosition()`.

- [ ] **Step 2: Implement tap-to-add-waypoint**

`MapEventsOverlay` with `singleTapConfirmedHelper` that calls `viewModel.addWaypointAtPosition(lat, lon)`.

- [ ] **Step 3: Test on emulator — tap adds marker, drag moves it**

- [ ] **Step 4: Commit**

### Task 19: Leg Polyline Overlay

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/map/overlay/LegPolylineOverlay.kt`

**Reference:** `src/components/map/LegPolylines.tsx`

- [ ] **Step 1: Implement colored polylines between consecutive waypoints**

Use osmdroid `Polyline` class. Color based on leg index (cycling through a palette). Use `routeGeometry` if available, else straight line between waypoints.

- [ ] **Step 2: Commit**

### Task 20: Compass, Ruler, and Coordinate Grid Overlays

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/map/overlay/CompassOverlay.kt`
- Create: `app/src/main/java/it/trektrak/ui/map/overlay/RulerOverlay.kt`
- Create: `app/src/main/java/it/trektrak/ui/map/overlay/CoordinateGridOverlay.kt`

**Reference:** `src/components/map/CompassTool.tsx`, `src/components/map/RulerTool.tsx`, `src/components/map/CoordinateGrid.tsx`

- [ ] **Step 1: CompassOverlay — draw bearing line from center with Canvas**
- [ ] **Step 2: RulerOverlay — tap two points, show distance**
- [ ] **Step 3: CoordinateGridOverlay — uses `CoordinateGrid.computeGridLines()`, draws lines with Canvas**
- [ ] **Step 4: Commit**

### Task 21: Quiz Marker Overlay

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/map/overlay/QuizMarkerOverlay.kt`

- [ ] **Step 1: Implement — observes `MapViewModel.uiState.quizPoints`, renders markers**
- [ ] **Step 2: Commit**

---

## Phase 6: Panel UI

### Task 22: Common UI Components

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/common/NumberInputField.kt`
- Create: `app/src/main/java/it/trektrak/ui/common/ModeSwitch.kt`
- Create: `app/src/main/java/it/trektrak/ui/common/OfflineBanner.kt`
- Create: `app/src/main/java/it/trektrak/ui/common/NetworkMonitor.kt`
- Test: `app/src/test/java/it/trektrak/ui/common/NumberInputFieldTest.kt`

**Reference:** `src/components/NumberInput.tsx`, `src/components/ModeSwitch.tsx`, `src/components/OfflineBanner.tsx`

- [ ] **Step 1: NumberInputField — numeric keyboard, validation, Compose TextField**
- [ ] **Step 2: ModeSwitch — learn/track toggle with SegmentedButton (Material 3)**
- [ ] **Step 3: OfflineBanner — observes NetworkMonitor.isOnline StateFlow**
- [ ] **Step 4: NetworkMonitor — ConnectivityManager callback → StateFlow<Boolean>**
- [ ] **Step 5: Compose UI tests for NumberInputField**
- [ ] **Step 6: Commit**

### Task 23: Waypoint and Leg Cards

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/panel/WaypointCard.kt`
- Create: `app/src/main/java/it/trektrak/ui/panel/LegCard.kt`
- Create: `app/src/main/java/it/trektrak/ui/panel/WaypointList.kt`
- Test: `app/src/test/java/it/trektrak/ui/panel/WaypointCardTest.kt`

**Reference:** `src/components/WaypointCard.tsx`, `src/components/LegCard.tsx`, `src/components/WaypointList.tsx`

- [ ] **Step 1: WaypointCard — name, lat, lon, altitude fields with NumberInputField**
- [ ] **Step 2: LegCard — distance, D+, D-, azimuth fields, derived time/slope display**
- [ ] **Step 3: WaypointList — LazyColumn with drag-and-drop reordering (reorderable library)**
- [ ] **Step 4: Compose UI tests for WaypointCard**
- [ ] **Step 5: Commit**

### Task 24: Summary Bar, Action Bar, and Panel Screen

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/panel/SummaryBar.kt`
- Create: `app/src/main/java/it/trektrak/ui/panel/ActionBar.kt`
- Create: `app/src/main/java/it/trektrak/ui/panel/ItineraryHeader.kt`
- Create: `app/src/main/java/it/trektrak/ui/panel/PanelScreen.kt`
- Create: `app/src/main/java/it/trektrak/ui/panel/PanelViewModel.kt`
- Create: `app/src/main/java/it/trektrak/ui/panel/SavedItinerariesDialog.kt`

**Reference:** `src/components/SummaryBar.tsx`, `src/components/ActionBar.tsx`, `src/components/LeftPanel.tsx`, `src/components/ItineraryHeader.tsx`, `src/components/SavedItinerariesModal.tsx`

- [ ] **Step 1: SummaryBar — total distance, D+, D-, time, difficulty badge**
- [ ] **Step 2: ActionBar — buttons: Validate, PDF, GPX, Share, Meteo, Save, Load**
- [ ] **Step 3: ItineraryHeader — editable name TextField**
- [ ] **Step 4: PanelScreen — assembles header + ModeSwitch + WaypointList + SummaryBar + ActionBar**
- [ ] **Step 5: PanelViewModel — validation trigger, export actions, save/load**
- [ ] **Step 6: SavedItinerariesDialog — load/delete from Room**
- [ ] **Step 7: Commit**

---

## Phase 7: Auto-Fill Pipeline

### Task 25: AutoFillPipeline

**Files:**
- Create: `app/src/main/java/it/trektrak/domain/calculation/AutoFillPipeline.kt`
- Create: `app/src/test/java/it/trektrak/domain/calculation/AutoFillPipelineTest.kt`

**Reference:** `src/lib/auto-fill.ts`

- [ ] **Step 1: Write tests with mocked services**

```kotlin
package it.trektrak.domain.calculation

import io.mockk.*
import it.trektrak.data.remote.ElevationService
import it.trektrak.data.remote.RoutingService
import it.trektrak.domain.model.*
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class AutoFillPipelineTest {
    private val elevationService = mockk<ElevationService>()
    private val routingService = mockk<RoutingService>()
    private val pipeline = AutoFillPipeline(elevationService, routingService)

    @Test
    fun `classic mode fills elevation profile and cumulative D+D-`() = runTest {
        val from = Waypoint("1", "A", 46.0, 11.0, null, 0)
        val to = Waypoint("2", "B", 46.01, 11.01, null, 1)
        val leg = Leg("l1", "1", "2", legOrder = 0)

        coEvery { elevationService.fetchElevation(any(), any()) } returns 500.0
        coEvery { elevationService.fetchElevationProfile(any()) } returns
            listOf(500.0, 520.0, 510.0, 550.0, 530.0)

        val result = pipeline.executeClassic(leg, from, to, sampleInterval = 50)

        assertNotNull(result)
        assertNotNull(result!!.elevationProfile)
        assertTrue(result.elevationProfile!!.isNotEmpty())
        assertNotNull(result.elevationGain)
        assertNotNull(result.elevationLoss)
    }
}
```

- [ ] **Step 2: Implement AutoFillPipeline**

```kotlin
package it.trektrak.domain.calculation

import it.trektrak.data.remote.ElevationService
import it.trektrak.data.remote.RoutingService
import it.trektrak.domain.model.*
import kotlinx.coroutines.*

data class AutoFillResult(
    val leg: Leg,
    val fromAltitude: Double? = null,
    val toAltitude: Double? = null
)

class AutoFillPipeline(
    private val elevationService: ElevationService,
    private val routingService: RoutingService
) {
    private var currentJob: Job? = null

    fun execute(
        scope: CoroutineScope,
        leg: Leg, from: Waypoint, to: Waypoint,
        settings: MapDisplaySettings,
        onResult: (AutoFillResult) -> Unit
    ) {
        currentJob?.cancel()
        currentJob = scope.launch(Dispatchers.IO) {
            val result = if (settings.trailRouting) {
                executeGuided(leg, from, to, settings.sampleInterval)
            } else {
                executeClassic(leg, from, to, settings.sampleInterval)
            }
            ensureActive()
            if (result != null) {
                withContext(Dispatchers.Main) { onResult(result) }
            }
        }
    }

    suspend fun executeClassic(leg: Leg, from: Waypoint, to: Waypoint, sampleInterval: Int): AutoFillResult? {
        val fromLat = from.lat ?: return null
        val fromLon = from.lon ?: return null
        val toLat = to.lat ?: return null
        val toLon = to.lon ?: return null

        // 1. Fetch elevation for endpoints
        val fromAlt = elevationService.fetchElevation(fromLat, fromLon)
        val toAlt = elevationService.fetchElevation(toLat, toLon)

        // 2. Calculate distance and azimuth
        val distance = GeoCalculations.haversineDistance(fromLat, fromLon, toLat, toLon)
        val azimuth = GeoCalculations.forwardAzimuth(fromLat, fromLon, toLat, toLon)

        // 3. Sample elevation profile
        val interval = GeoCalculations.sampleInterval(distance * 1000, sampleInterval)
        val samplePoints = ProfileSampling.computeSamplePoints(
            LatLon(fromLat, fromLon), LatLon(toLat, toLon), interval
        )
        val elevations = elevationService.fetchElevationProfile(samplePoints)

        // 4. Build profile, smooth, calculate D+/D-
        val profile = samplePoints.mapIndexedNotNull { i, pt ->
            val el = elevations.getOrNull(i) ?: return@mapIndexedNotNull null
            val dist = if (i == 0) 0.0
                else GeoCalculations.haversineDistance(samplePoints[0].lat, samplePoints[0].lon, pt.lat, pt.lon) * 1000
            ProfilePoint(dist, el)
        }
        val smoothed = ProfileSampling.smoothProfile(profile)
        val cumElev = GeoCalculations.cumulativeElevation(smoothed.map { it.elevation })

        // 5. Compute derived fields
        val gain = cumElev?.first ?: 0.0
        val loss = cumElev?.second ?: 0.0
        val time = GeoCalculations.calculateMunterTime(distance, gain, loss)
        val slope = GeoCalculations.calculateSlope(distance, gain, loss)

        val updatedLeg = leg.copy(
            distance = distance,
            azimuth = azimuth,
            elevationGain = gain,
            elevationLoss = loss,
            elevationProfile = smoothed,
            estimatedTime = time,
            slope = slope
        )

        return AutoFillResult(updatedLeg, fromAlt, toAlt)
    }

    suspend fun executeGuided(leg: Leg, from: Waypoint, to: Waypoint, sampleInterval: Int): AutoFillResult? {
        val fromLat = from.lat ?: return null
        val fromLon = from.lon ?: return null
        val toLat = to.lat ?: return null
        val toLon = to.lon ?: return null

        val route = routingService.fetchRoute(LatLon(fromLat, fromLon), LatLon(toLat, toLon))
        if (route == null) {
            // Fallback to classic
            return executeClassic(leg, from, to, sampleInterval)
        }

        val azimuth = GeoCalculations.forwardAzimuth(fromLat, fromLon, toLat, toLon)
        val time = GeoCalculations.calculateMunterTime(route.distance, route.ascent, route.descent)
        val slope = GeoCalculations.calculateSlope(route.distance, route.ascent, route.descent)

        val updatedLeg = leg.copy(
            distance = route.distance,
            azimuth = azimuth,
            elevationGain = route.ascent,
            elevationLoss = route.descent,
            routeGeometry = route.geometry,
            elevationProfile = route.elevationProfile,
            estimatedTime = time,
            slope = slope
        )

        return AutoFillResult(updatedLeg, route.elevationProfile?.firstOrNull()?.elevation,
            route.elevationProfile?.lastOrNull()?.elevation)
    }
}
```

- [ ] **Step 3: Run tests, verify pass**
- [ ] **Step 4: Commit**

```bash
git add app/src/main/java/it/trektrak/domain/calculation/AutoFillPipeline.kt
git add app/src/test/java/it/trektrak/domain/calculation/AutoFillPipelineTest.kt
git commit -m "feat: add AutoFillPipeline with classic and guided modes"
```

---

## Phase 8: Charts

### Task 26: Elevation Profile Chart

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/chart/ElevationProfileChart.kt`

**Reference:** `src/components/map/ElevationProfile.tsx`

- [ ] **Step 1: Implement Vico AreaChart with gradient fill**

Uses Vico's `CartesianChart` with `AreaStyle`. Data from `MapViewModel.uiState.legs[].elevationProfile`. Touch gesture → updates `sharedMapState.profileHoverDistance`.

- [ ] **Step 2: Implement tap-on-waypoint → map fly-to**

When user taps near a waypoint label on the chart, set `sharedMapState.profileFlyToIndex`.

- [ ] **Step 3: Commit**

### Task 27: Trend Chart

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/chart/TrendChart.kt`

**Reference:** `src/components/ProgressOverlay.tsx` (trend line chart)

- [ ] **Step 1: Implement Vico LineChart for learning trend**
- [ ] **Step 2: Commit**

---

## Phase 9: Validation & Learning

### Task 28: Validation Badge and Didactic Tips

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/learn/ValidationBadge.kt`

**Reference:** `src/components/ValidationBadge.tsx`

- [ ] **Step 1: Implement colored circle badge (green/yellow/red) with icon**
- [ ] **Step 2: Add Popup with delta, real value, and didactic tip**
- [ ] **Step 3: Compose UI test**
- [ ] **Step 4: Commit**

### Task 29: Progress Screen (Report Apprendimento)

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/learn/ProgressScreen.kt`
- Create: `app/src/main/java/it/trektrak/ui/learn/ProgressViewModel.kt`

**Reference:** `src/components/ProgressOverlay.tsx`

- [ ] **Step 1: ProgressViewModel — loads from LearningRepository + QuizRepository, computes stats via LearningStats**
- [ ] **Step 2: ProgressScreen — summary cards + TrendChart + category breakdown in ModalBottomSheet**
- [ ] **Step 3: Commit**

---

## Phase 10: Quiz

### Task 30: Quiz Mode

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/quiz/QuizViewModel.kt`
- Create: `app/src/main/java/it/trektrak/ui/quiz/QuizScreen.kt`
- Create: `app/src/main/java/it/trektrak/ui/quiz/QuizQuestion.kt`
- Create: `app/src/main/java/it/trektrak/ui/quiz/QuizSummary.kt`

**Reference:** `src/components/QuizOverlay.tsx`, `src/components/QuizQuestion.tsx`, `src/components/QuizSummary.tsx`

- [ ] **Step 1: QuizViewModel — generate questions from viewport bounds, fetch POIs via Overpass, score calculation**
- [ ] **Step 2: QuizScreen — full-screen overlay on map, shows QuizQuestion or QuizSummary**
- [ ] **Step 3: QuizQuestion — display question, input field, submit, show result**
- [ ] **Step 4: QuizSummary — session results, save to QuizRepository**
- [ ] **Step 5: Wire quiz points to MapViewModel.quizPoints → QuizMarkerOverlay**
- [ ] **Step 6: Commit**

---

## Phase 11: Export

### Task 31: PDF Export

**Files:**
- Create: `app/src/main/java/it/trektrak/domain/export/PdfSummaryExporter.kt`
- Create: `app/src/main/java/it/trektrak/domain/export/PdfRoadbookExporter.kt`

**Reference:** `src/components/ActionBar.tsx` (PDF generation logic)

- [ ] **Step 1: PdfSummaryExporter — 1 page: title, metadata, leg table with Canvas drawing**
- [ ] **Step 2: PdfRoadbookExporter — multi-page: detail per leg (azimuth, direction, distance, elevation)**
- [ ] **Step 3: Wire to ActionBar — save via ACTION_CREATE_DOCUMENT, share via ShareCompat**
- [ ] **Step 4: Commit**

### Task 32: GPX Export and File Sharing

**Files:**
- Modify: `app/src/main/java/it/trektrak/ui/panel/ActionBar.kt`

- [ ] **Step 1: Wire GpxExporter to ActionBar**
- [ ] **Step 2: Implement SAF save (ACTION_CREATE_DOCUMENT) and share (ShareCompat)**
- [ ] **Step 3: Implement Meteo link (Intent.ACTION_VIEW with Meteoblue URL)**
- [ ] **Step 4: Commit**

---

## Phase 12: Settings & Misc

### Task 33: Settings Sheets

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/settings/MapSettingsSheet.kt`
- Create: `app/src/main/java/it/trektrak/ui/settings/ToleranceSettingsSheet.kt`
- Create: `app/src/main/java/it/trektrak/ui/settings/SettingsViewModel.kt`

**Reference:** `src/components/MapSettings.tsx`, `src/components/ToleranceSettings.tsx`

- [ ] **Step 1: MapSettingsSheet — base map picker (4 options), hiking trails toggle, coordinate grid toggle, sample interval selector**
- [ ] **Step 2: ToleranceSettingsSheet — sliders for altitude, distance, azimuth, elevation tolerances**
- [ ] **Step 3: SettingsViewModel — persist to Room via SettingsRepository**
- [ ] **Step 4: Commit**

### Task 34: Onboarding

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/onboarding/TutorialOverlay.kt`
- Create: `app/src/main/java/it/trektrak/ui/onboarding/WhatsNewDialog.kt`

**Reference:** `src/components/LearnTutorial.tsx`, `src/components/WhatsNew.tsx`

- [ ] **Step 1: TutorialOverlay — step-by-step onboarding, dismiss persisted in Settings**
- [ ] **Step 2: WhatsNewDialog — version-based feature highlights**
- [ ] **Step 3: Commit**

### Task 35: URL Sharing (Deep Link)

**Files:**
- Modify: `app/src/main/AndroidManifest.xml` (Intent filter)
- Modify: `app/src/main/java/it/trektrak/MainActivity.kt` (handle incoming intent)

- [ ] **Step 1: Add Intent filter for `trektrak://itinerary/{hash}`**
- [ ] **Step 2: Handle incoming deep link in MainActivity — decode with UrlShareCodec, load itinerary**
- [ ] **Step 3: Wire share button in ActionBar — encode with UrlShareCodec, share via ShareCompat**
- [ ] **Step 4: Commit**

### Task 36: Location Search

**Files:**
- Create: `app/src/main/java/it/trektrak/ui/map/LocationSearchBar.kt`

**Reference:** `src/components/map/LocationSearch.tsx`

- [ ] **Step 1: Implement search bar with debounced Nominatim geocoding**
- [ ] **Step 2: Autocomplete dropdown with results, tap → map centers on location**
- [ ] **Step 3: Commit**

---

## Phase 13: Integration & Polish

### Task 37: Wire Everything Together

- [ ] **Step 1: Connect MapViewModel actions to all UI components**
- [ ] **Step 2: Wire auto-fill pipeline to waypoint add/drag/reorder events**
- [ ] **Step 3: Wire validation flow (ActionBar validate → ElevationService → ValidationLogic → ValidationBadge)**
- [ ] **Step 4: Wire mode switch (learn ↔ track) with correct field clearing**
- [ ] **Step 5: Ensure tool mutual exclusion (compass/ruler/quiz)**
- [ ] **Step 6: Commit**

### Task 38: Responsive Layout Polish

- [ ] **Step 1: Test Compact layout (phone portrait) — bottom sheet behavior, peek SummaryBar**
- [ ] **Step 2: Test Medium layout (phone landscape) — side-by-side 60/40**
- [ ] **Step 3: Test Expanded layout (tablet) — fixed 380dp panel**
- [ ] **Step 4: Fix any layout issues**
- [ ] **Step 5: Commit**

### Task 39: Geolocation

**Files:**
- Modify: `app/src/main/java/it/trektrak/ui/map/TrekMapView.kt`

- [ ] **Step 1: Add "My Location" FAB**
- [ ] **Step 2: Request location permission at runtime**
- [ ] **Step 3: Center map on user location when granted**
- [ ] **Step 4: Commit**

---

## Phase 14: Testing

### Task 40: Complete Unit Test Suite

- [ ] **Step 1: Port remaining PWA test cases to Kotlin**

Reference the 28 test files in `src/__tests__/`. Key tests to port:
- `calculations.test.ts` → `GeoCalculationsTest.kt` (already done in Task 3)
- `validation.test.ts` → `ValidationLogicTest.kt` (already done in Task 4)
- `grid.test.ts` → `CoordinateGridTest.kt` (already done in Task 8)
- `share-url.test.ts` → `UrlShareCodecTest.kt` (already done in Task 10)
- `export-gpx.test.ts` → `GpxExporterTest.kt` (already done in Task 9)
- `learning-stats.test.ts` → `LearningStatsTest.kt` (already done in Task 11)
- `storage.test.ts` → `ItineraryRepositoryTest.kt` (integration)
- `didactic-tips.test.ts` → `DidacticTipsTest.kt` (already done in Task 7)

- [ ] **Step 2: Run full test suite**

Run: `./gradlew test`
Expected: ALL PASS

- [ ] **Step 3: Commit**

### Task 41: Compose UI Tests

- [ ] **Step 1: Write remaining Compose tests (ActionBar, LegCard, ModeSwitch, QuizQuestion)**
- [ ] **Step 2: Run instrumented tests**

Run: `./gradlew connectedAndroidTest`

- [ ] **Step 3: Commit**

---

## Phase 15: Build & Distribution

### Task 42: ProGuard Rules

**Files:**
- Create: `app/proguard-rules.pro`

- [ ] **Step 1: Add keep rules**

```proguard
# Room entities
-keep class it.trektrak.data.local.entity.** { *; }

# Kotlin Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class it.trektrak.data.remote.model.** { *; }

# Retrofit
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}

# osmdroid
-keep class org.osmdroid.** { *; }
```

- [ ] **Step 2: Build release APK**

Run: `./gradlew assembleRelease`
Expected: BUILD SUCCESSFUL, APK in `app/build/outputs/apk/release/`

- [ ] **Step 3: Commit**

### Task 43: App Icon and Splash Screen

**Files:**
- Create: `app/src/main/res/mipmap-*/ic_launcher.png` (multiple densities)
- Create: `app/src/main/res/values/splash.xml`

- [ ] **Step 1: Generate adaptive icon (green mountain/compass motif on white background)**
- [ ] **Step 2: Configure splash screen with Material 3 SplashScreen API**
- [ ] **Step 3: Commit**

### Task 44: Play Store Preparation

- [ ] **Step 1: Generate signed AAB**

```bash
./gradlew bundleRelease
```

- [ ] **Step 2: Prepare listing assets (icon 512x512, feature graphic 1024x500, screenshots)**
- [ ] **Step 3: Write privacy policy (GitHub Pages or similar)**
- [ ] **Step 4: Complete Data Safety declaration in Play Console**
- [ ] **Step 5: Submit for review**

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1: Foundation | 1-2 | Project setup, domain models |
| 2: Domain Logic | 3-11 | Calculations, validation, tips, grid, export, stats (TDD) |
| 3: Data Layer | 12-15 | Room, Retrofit, repositories, DI |
| 4: UI Foundation | 16-17 | Theme, navigation, map view |
| 5: Map Overlays | 18-21 | Waypoints, polylines, compass, ruler, grid, quiz markers |
| 6: Panel UI | 22-24 | Input components, cards, action bar, panel |
| 7: Auto-Fill | 25 | Async pipeline with cancellation |
| 8: Charts | 26-27 | Elevation profile, trend chart (Vico) |
| 9: Validation | 28-29 | Badges, didactic tips, progress report |
| 10: Quiz | 30 | Quiz mode with all question types |
| 11: Export | 31-32 | PDF (summary + roadbook), GPX, file sharing |
| 12: Settings | 33-36 | Map settings, tolerances, onboarding, URL sharing, search |
| 13: Integration | 37-39 | Wiring, responsive layout, geolocation |
| 14: Testing | 40-41 | Complete unit + UI test suite |
| 15: Distribution | 42-44 | ProGuard, icon, Play Store |

**Total: 44 tasks across 15 phases.**
