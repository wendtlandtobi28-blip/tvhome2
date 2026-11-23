package de.tobi.jarvis

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

data class UpdateInfo(val versionCode: Int, val versionName: String, val apkUrl: String)

/**
 * Prüft bei GitHub, ob es eine neuere Jarvis-Version gibt, lädt sie herunter und
 * öffnet den Android-Installer. Die Netzwerk-Aufrufe blockieren: nur im Hintergrund aufrufen.
 */
class Updater(private val context: Context) {
    private val base = "https://github.com/wendtlandtobi28-blip/tvhome2/releases/download/jarvis/"

    val installedVersion: Int
        get() = context.packageManager.getPackageInfo(context.packageName, 0).let {
            if (Build.VERSION.SDK_INT >= 28) it.longVersionCode.toInt() else @Suppress("DEPRECATION") it.versionCode
        }

    val installedName: String
        get() = context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "?"

    /** Gibt die neue Version zurück, oder null, wenn die App aktuell ist. */
    fun check(): UpdateInfo? {
        val json = JSONObject(get(base + "version.json").decodeToString())
        val info = UpdateInfo(
            json.getInt("versionCode"),
            json.optString("versionName", json.getInt("versionCode").toString()),
            base + json.optString("apk", "Jarvis.apk")
        )
        return if (info.versionCode > installedVersion) info else null
    }

    /** Lädt die APK herunter. [progress] bekommt Werte von 0 bis 1. */
    fun download(info: UpdateInfo, progress: (Float) -> Unit): File {
        val dir = File(context.cacheDir, "updates").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        val out = File(dir, "Jarvis-${info.versionCode}.apk")
        val conn = open(info.apkUrl)
        val total = conn.contentLengthLong
        conn.inputStream.use { input ->
            out.outputStream().use { output ->
                val buf = ByteArray(64 * 1024)
                var read = 0L
                while (true) {
                    val n = input.read(buf)
                    if (n < 0) break
                    output.write(buf, 0, n)
                    read += n
                    if (total > 0) progress(read.toFloat() / total)
                }
            }
        }
        return out
    }

    /** Darf die App Updates installieren? Android verlangt dafür einmalig eine Freigabe. */
    fun mayInstall(): Boolean = context.packageManager.canRequestPackageInstalls()

    fun openInstallPermission() {
        context.startActivity(
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.packageName))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }

    fun install(apk: File) {
        val uri = FileProvider.getUriForFile(context, context.packageName + ".updates", apk)
        context.startActivity(
            Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }

    private fun open(url: String): HttpURLConnection {
        var current = url
        repeat(6) {
            val c = URL(current).openConnection() as HttpURLConnection
            c.instanceFollowRedirects = false
            c.connectTimeout = 15_000
            c.readTimeout = 30_000
            c.setRequestProperty("Cache-Control", "no-cache")
            val code = c.responseCode
            if (code in 300..399) {
                current = c.getHeaderField("Location") ?: error("Weiterleitung ohne Ziel")
                c.disconnect()
            } else if (code == 200) {
                return c
            } else {
                c.disconnect()
                error("Server antwortet mit $code")
            }
        }
        error("Zu viele Weiterleitungen")
    }

    private fun get(url: String): ByteArray = open(url).inputStream.use { it.readBytes() }
}
