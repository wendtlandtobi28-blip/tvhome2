package de.tobi.jarvis

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class Turn(val role: String, val text: String, val time: Long)

data class Conversation(val id: Long, val started: Long, val turns: MutableList<Turn>)

/** Speichert alle Gespräche als JSON-Datei im privaten App-Speicher. */
class Store(context: Context) {
    private val file = File(context.filesDir, "gespraeche.json")
    private val prefs = context.getSharedPreferences("jarvis", Context.MODE_PRIVATE)

    var apiKey: String
        get() = prefs.getString("api_key", "") ?: ""
        set(v) = prefs.edit().putString("api_key", v.trim()).apply()

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
