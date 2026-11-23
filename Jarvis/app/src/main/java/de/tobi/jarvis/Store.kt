package de.tobi.jarvis

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class Turn(val role: String, val text: String, val time: Long)

/**
 * Holt den echten Gemini-Schlüssel aus eingefügtem Text heraus, auch wenn versehentlich
 * Beispielcode mitkopiert wurde. Gibt "" zurück, wenn kein Schlüssel darin steckt.
 */
fun cleanGeminiKey(raw: String): String {
    Regex("AIza[0-9A-Za-z_-]{30,}").find(raw)?.let { return it.value }
    val t = raw.trim()
    return if (t.length in 20..200 && t.none { it.isWhitespace() || it == '"' || it == '(' }) t else ""
}

/** Dasselbe für den Claude-Schlüssel (beginnt mit "sk-ant-"). */
fun cleanClaudeKey(raw: String): String {
    Regex("sk-ant-[0-9A-Za-z_-]{20,}").find(raw)?.let { return it.value }
    val t = raw.trim()
    return if (t.startsWith("sk-") && t.none { it.isWhitespace() }) t else ""
}

data class Note(val id: Long, val text: String, val time: Long)

data class Conversation(val id: Long, val started: Long, val turns: MutableList<Turn>)

/** Speichert alle Gespräche als JSON-Datei im privaten App-Speicher. */
class Store(context: Context) {
    private val file = File(context.filesDir, "gespraeche.json")
    private val prefs = context.getSharedPreferences("jarvis", Context.MODE_PRIVATE)

    var apiKey: String
        get() = cleanClaudeKey(prefs.getString("api_key", "") ?: "")
        set(v) = prefs.edit().putString("api_key", cleanClaudeKey(v)).apply()

    /** Kostenloser Schlüssel von Google AI Studio für Gemini. */
    var geminiKey: String
        get() = cleanGeminiKey(prefs.getString("gemini_key", "") ?: "")
        set(v) = prefs.edit().putString("gemini_key", cleanGeminiKey(v)).apply()

    /** "gemini" (kostenlos) oder "claude" (Guthaben nötig). */
    var provider: String
        get() = prefs.getString("provider", "gemini") ?: "gemini"
        set(v) = prefs.edit().putString("provider", v).apply()

    /** Zuletzt funktionierendes Gemini-Modell, damit nicht jedes Mal gesucht werden muss. */
    var geminiModel: String
        get() = prefs.getString("gemini_model", "") ?: ""
        set(v) = prefs.edit().putString("gemini_model", v).apply()

    /** Wohnort für Wetterfragen ohne Ortsangabe. */
    var homeCity: String
        get() = prefs.getString("home_city", "") ?: ""
        set(v) = prefs.edit().putString("home_city", v.trim()).apply()

    /** Hat Jarvis überhaupt einen Schlüssel, mit dem er denken kann? */
    val hasAnyKey: Boolean get() = geminiKey.isNotBlank() || apiKey.isNotBlank()

    /** Name der gewählten Stimme; leer = automatisch die natürlichste. */
    var voice: String
        get() = prefs.getString("voice", "") ?: ""
        set(v) = prefs.edit().putString("voice", v).apply()

    var askedCalendar: Boolean
        get() = prefs.getBoolean("asked_calendar", false)
        set(v) = prefs.edit().putBoolean("asked_calendar", v).apply()

    var speechRate: Float
        get() = prefs.getFloat("rate", 1.0f)
        set(v) = prefs.edit().putFloat("rate", v).apply()

    @Synchronized
    fun all(): List<Conversation> {
        if (!file.exists()) return emptyList()
        return try {
            val arr = JSONArray(file.readText())
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                val t = o.getJSONArray("turns")
                Conversation(
                    o.getLong("id"), o.getLong("started"),
                    (0 until t.length()).map { j ->
                        val x = t.getJSONObject(j)
                        Turn(x.getString("role"), x.getString("text"), x.getLong("time"))
                    }.toMutableList()
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    @Synchronized
    fun save(conv: Conversation) {
        if (conv.turns.isEmpty()) return
        val list = all().filter { it.id != conv.id }.toMutableList()
        list.add(conv)
        write(list)
    }

    @Synchronized
    fun delete(id: Long) = write(all().filter { it.id != id })

    @Synchronized
    fun deleteAll() = write(emptyList())

    private fun write(list: List<Conversation>) {
        val arr = JSONArray()
        list.sortedBy { it.started }.forEach { c ->
            val t = JSONArray()
            c.turns.forEach { t.put(JSONObject().put("role", it.role).put("text", it.text).put("time", it.time)) }
            arr.put(JSONObject().put("id", c.id).put("started", c.started).put("turns", t))
        }
        val tmp = File(file.parentFile, file.name + ".tmp")
        tmp.writeText(arr.toString())
        tmp.renameTo(file)
    }

    // ---------------- Notizen ----------------

    private val notesFile = File(context.filesDir, "notizen.json")

    @Synchronized
    fun notes(query: String? = null): List<Note> {
        if (!notesFile.exists()) return emptyList()
        val list = try {
            val arr = JSONArray(notesFile.readText())
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                Note(o.getLong("id"), o.getString("text"), o.getLong("time"))
            }
        } catch (e: Exception) { emptyList() }
        val q = query?.trim()?.lowercase().orEmpty()
        return if (q.isEmpty()) list else list.filter { it.text.lowercase().contains(q) }
    }

    @Synchronized
    fun addNote(text: String) {
        val list = notes()
        val id = (list.maxOfOrNull { it.id } ?: 0L) + 1
        writeNotes(list + Note(id, text.trim(), System.currentTimeMillis()))
    }

    @Synchronized
    fun deleteNote(id: Long): Boolean {
        val list = notes()
        if (list.none { it.id == id }) return false
        writeNotes(list.filter { it.id != id })
        return true
    }

    private fun writeNotes(list: List<Note>) {
        val arr = JSONArray()
        list.forEach { arr.put(JSONObject().put("id", it.id).put("text", it.text).put("time", it.time)) }
        val tmp = File(notesFile.parentFile, notesFile.name + ".tmp")
        tmp.writeText(arr.toString())
        tmp.renameTo(notesFile)
    }

    /** Einfache Stichwortsuche in früheren Gesprächen, für Jarvis' "lokale" Suche. */
    fun search(query: String, excludeId: Long): String {
        val words = query.lowercase().split(Regex("\\W+")).filter { it.length > 2 }
        if (words.isEmpty()) return "Keine Suchbegriffe."
        val df = java.text.SimpleDateFormat("dd.MM.yyyy HH:mm", java.util.Locale.GERMANY)
        val hits = mutableListOf<Pair<Int, String>>()
        for (c in all()) {
            if (c.id == excludeId) continue
            c.turns.forEachIndexed { i, t ->
                val low = t.text.lowercase()
                val score = words.count { low.contains(it) }
                if (score > 0) {
                    val ctx = c.turns.subList(maxOf(0, i - 1), minOf(c.turns.size, i + 2))
                        .joinToString("\n") { (if (it.role == "user") "Nutzer: " else "Jarvis: ") + it.text.take(400) }
                    hits.add(score to "[${df.format(java.util.Date(t.time))}]\n$ctx")
                }
            }
        }
        if (hits.isEmpty()) return "In früheren Gesprächen nichts dazu gefunden."
        return hits.sortedByDescending { it.first }.take(6).joinToString("\n---\n") { it.second }
    }
}
