package de.tobi.jarvis

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.AlarmClock
import android.provider.CalendarContract
import androidx.core.content.ContextCompat
import com.anthropic.core.JsonValue
import com.anthropic.models.messages.Tool
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.TimeZone

/** Ein Werkzeug, unabhängig davon, ob Claude oder Gemini es benutzt. */
class ToolSpec(val name: String, val description: String, val props: Map<String, Map<String, Any>>, val required: List<String>)

/**
 * Werkzeuge, die Jarvis auf dem Tablet benutzen darf: Kalender (der Google-Kalender, der auf dem
 * Tablet eingerichtet ist), Wecker und Timer der Uhr-App, eigene Notizen und frühere Gespräche.
 */
class Tools(private val context: Context, private val store: Store) {

    private fun tool(name: String, description: String, props: Map<String, Map<String, Any>>, required: List<String>) =
        ToolSpec(name, description, props, required)

    /** Die Werkzeuge im Format der Claude-Schnittstelle. */
    fun claudeTools(): List<Tool> = specs.map { t ->
        val p = Tool.InputSchema.Properties.builder()
        t.props.forEach { (k, v) -> p.putAdditionalProperty(k, JsonValue.from(v)) }
        Tool.builder()
            .name(t.name)
            .description(t.description)
            .inputSchema(Tool.InputSchema.builder().properties(p.build()).required(t.required).build())
            .build()
    }

    /** Die Werkzeuge im Format der Gemini-Schnittstelle (functionDeclarations). */
    fun geminiDeclarations(extra: List<ToolSpec>): JSONArray {
        val arr = JSONArray()
        (specs + extra).forEach { t ->
            val props = JSONObject()
            t.props.forEach { (k, v) -> props.put(k, JSONObject(v)) }
            val params = JSONObject().put("type", "object").put("properties", props)
            if (t.required.isNotEmpty()) params.put("required", JSONArray(t.required))
            arr.put(JSONObject().put("name", t.name).put("description", t.description).put("parameters", params))
        }
        return arr
    }

    private fun str(desc: String) = mapOf("type" to "string", "description" to desc)
    private fun int(desc: String) = mapOf("type" to "integer", "description" to desc)

    val specs: List<ToolSpec> = listOf(
        tool(
            "weather",
            "Kostenloses Wetter: aktuelles Wetter und Vorhersage für die nächsten Tage für einen Ort. Immer zuerst dieses Werkzeug für Wetterfragen benutzen.",
            mapOf(
                "city" to str("Ort, zum Beispiel Berlin. Leer lassen für den Wohnort des Nutzers"),
                "days" to int("Anzahl Tage Vorhersage, 1 bis 7")
            ),
            emptyList()
        ),
        tool(
            "news",
            "Kostenlose aktuelle Nachrichten aus Deutschland und der Welt (Tagesschau). Für Fragen nach Nachrichten und Schlagzeilen.",
            mapOf("topic" to str("Optionales Stichwort, nach dem gefiltert wird")),
            emptyList()
        ),
        tool(
            "wikipedia",
            "Kostenlose Wikipedia-Suche: kurze Zusammenfassung zu Personen, Orten, Begriffen und Wissen.",
            mapOf("query" to str("Suchbegriff")), listOf("query")
        ),
        tool(
            "search_conversations",
            "Durchsucht die gespeicherten früheren Gespräche mit dem Nutzer nach Stichworten und gibt passende Ausschnitte mit Datum zurück.",
            mapOf("query" to str("Stichworte, nach denen gesucht wird")), listOf("query")
        ),
        tool(
            "calendar_list_events",
            "Liest Termine aus allen Kalendern auf dem Tablet (auch dem Google-Kalender) für einen Zeitraum.",
            mapOf(
                "from_date" to str("Erster Tag, Format JJJJ-MM-TT"),
                "to_date" to str("Letzter Tag (einschließlich), Format JJJJ-MM-TT")
            ),
            listOf("from_date", "to_date")
        ),
        tool(
            "calendar_add_event",
            "Trägt einen Termin in den Google-Kalender des Nutzers ein. Vorher kurz bestätigen lassen, wenn Datum oder Uhrzeit unklar sind.",
            mapOf(
                "title" to str("Titel des Termins"),
                "start" to str("Beginn, Format JJJJ-MM-TTTHH:MM (Ortszeit)"),
                "end" to str("Ende, Format JJJJ-MM-TTTHH:MM (Ortszeit). Wenn unbekannt: eine Stunde nach Beginn"),
                "location" to str("Ort, optional"),
                "all_day" to mapOf("type" to "boolean", "description" to "true für ganztägige Termine")
            ),
            listOf("title", "start")
        ),
        tool(
            "calendar_delete_event",
            "Löscht einen Termin anhand seiner ID aus calendar_list_events. Nur nach ausdrücklicher Bestätigung des Nutzers.",
            mapOf("event_id" to int("ID des Termins")), listOf("event_id")
        ),
        tool(
            "set_alarm",
            "Stellt einen Wecker in der Uhr-App des Tablets.",
            mapOf("hour" to int("Stunde 0-23"), "minute" to int("Minute 0-59"), "label" to str("Bezeichnung, optional")),
            listOf("hour", "minute")
        ),
        tool(
            "set_timer",
            "Startet einen Timer in der Uhr-App des Tablets.",
            mapOf("seconds" to int("Dauer in Sekunden"), "label" to str("Bezeichnung, optional")),
            listOf("seconds")
        ),
        tool(
            "notes_add",
            "Speichert eine Notiz für den Nutzer (Einkaufsliste, Erinnerung, Idee …).",
            mapOf("text" to str("Inhalt der Notiz")), listOf("text")
        ),
        tool(
            "notes_list",
            "Liest die gespeicherten Notizen des Nutzers, optional nach Stichwort gefiltert.",
            mapOf("query" to str("Stichwort, optional")), emptyList()
        ),
        tool(
            "notes_delete",
            "Löscht eine Notiz anhand ihrer Nummer aus notes_list.",
            mapOf("id" to int("Nummer der Notiz")), listOf("id")
        ),
    )

    fun run(name: String, input: Map<*, *>, conversationId: Long): String = try {
        when (name) {
            "weather" -> weather(input["city"]?.toString().orEmpty(), (input["days"] as? Number)?.toInt() ?: 3)
            "news" -> news(input["topic"]?.toString().orEmpty())
            "wikipedia" -> wikipedia(input["query"]?.toString().orEmpty())
            "search_conversations" -> store.search(input["query"]?.toString().orEmpty(), conversationId)
            "calendar_list_events" -> listEvents(input["from_date"].toString(), input["to_date"].toString())
            "calendar_add_event" -> addEvent(input)
            "calendar_delete_event" -> deleteEvent((input["event_id"] as Number).toLong())
            "set_alarm" -> setAlarm((input["hour"] as Number).toInt(), (input["minute"] as Number).toInt(), input["label"]?.toString())
            "set_timer" -> setTimer((input["seconds"] as Number).toInt(), input["label"]?.toString())
            "notes_add" -> { store.addNote(input["text"].toString()); "Notiz gespeichert." }
            "notes_list" -> store.notes(input["query"]?.toString()).let { list ->
                if (list.isEmpty()) "Keine Notizen vorhanden." else list.joinToString("\n") { "Nr. ${it.id} (${fmtDay(it.time)}): ${it.text}" }
            }
            "notes_delete" -> if (store.deleteNote((input["id"] as Number).toLong())) "Notiz gelöscht." else "Diese Notiz gibt es nicht."
            else -> "Unbekanntes Werkzeug."
        }
    } catch (e: SecurityException) {
        "Keine Berechtigung. Der Nutzer muss Jarvis in den Android-Einstellungen den Zugriff erlauben."
    } catch (e: Exception) {
        "Fehler: ${e.message}"
    }

    // ---------------- kostenlose Internetdienste ----------------

    private fun getJson(url: String): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 10_000
        c.readTimeout = 15_000
        c.setRequestProperty("User-Agent", "JarvisTabletApp/1.0")
        try {
            if (c.responseCode != 200) error("Dienst antwortet mit ${c.responseCode}")
            return c.inputStream.use { it.readBytes().decodeToString() }
        } finally {
            c.disconnect()
        }
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    private fun weather(cityIn: String, daysIn: Int): String {
        val city = cityIn.ifBlank { store.homeCity }.ifBlank { return "Kein Ort bekannt. Frag den Nutzer, für welchen Ort." }
        val geo = JSONObject(getJson("https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=" + enc(city)))
        val place = geo.optJSONArray("results")?.optJSONObject(0) ?: return "Ort \"$city\" nicht gefunden."
        val days = daysIn.coerceIn(1, 7)
        val w = JSONObject(
            getJson(
                "https://api.open-meteo.com/v1/forecast?latitude=${place.getDouble("latitude")}&longitude=${place.getDouble("longitude")}" +
                    "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation" +
                    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
                    "&timezone=auto&forecast_days=$days"
            )
        )
        val cur = w.getJSONObject("current")
        val sb = StringBuilder("${place.getString("name")}: jetzt ${cur.getDouble("temperature_2m")} °C " +
            "(gefühlt ${cur.getDouble("apparent_temperature")} °C), ${code(cur.getInt("weather_code"))}, " +
            "Wind ${cur.getDouble("wind_speed_10m")} km/h.")
        val d = w.getJSONObject("daily")
        val dates = d.getJSONArray("time")
        for (i in 0 until dates.length()) {
            sb.append("\n${dates.getString(i)}: ${code(d.getJSONArray("weather_code").getInt(i))}, " +
                "${d.getJSONArray("temperature_2m_min").getDouble(i)} bis ${d.getJSONArray("temperature_2m_max").getDouble(i)} °C, " +
                "Regenwahrscheinlichkeit ${d.getJSONArray("precipitation_probability_max").optInt(i)} %")
        }
        return sb.toString()
    }

    private fun code(c: Int) = when (c) {
        0 -> "klar"; 1 -> "überwiegend klar"; 2 -> "teils bewölkt"; 3 -> "bedeckt"
        45, 48 -> "Nebel"; 51, 53, 55 -> "Nieselregen"; 56, 57 -> "gefrierender Niesel"
        61 -> "leichter Regen"; 63 -> "Regen"; 65 -> "starker Regen"; 66, 67 -> "gefrierender Regen"
        71 -> "leichter Schneefall"; 73 -> "Schneefall"; 75 -> "starker Schneefall"; 77 -> "Schneegriesel"
        80, 81, 82 -> "Regenschauer"; 85, 86 -> "Schneeschauer"; 95 -> "Gewitter"; 96, 99 -> "Gewitter mit Hagel"
        else -> "wechselhaft"
    }

    private fun news(topic: String): String {
        val json = JSONObject(getJson("https://www.tagesschau.de/api2u/homepage/"))
        val items = mutableListOf<String>()
        for (key in listOf("news", "regional")) {
            val arr = json.optJSONArray(key) ?: continue
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val title = o.optString("title")
                val first = o.optString("firstSentence")
                if (title.isBlank()) continue
                val line = if (first.isNotBlank()) "$title: $first" else title
                if (topic.isBlank() || line.contains(topic, ignoreCase = true)) items.add(line)
            }
        }
        return if (items.isEmpty()) "Keine passenden Nachrichten gefunden." else items.distinct().take(10).joinToString("\n")
    }

    private fun wikipedia(query: String): String {
        if (query.isBlank()) return "Kein Suchbegriff."
        val search = JSONObject(getJson("https://de.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=" + enc(query)))
        val hit = search.getJSONObject("query").getJSONArray("search").optJSONObject(0) ?: return "Bei Wikipedia nichts gefunden."
        val title = hit.getString("title")
        val sum = JSONObject(getJson("https://de.wikipedia.org/api/rest_v1/page/summary/" + enc(title.replace(' ', '_')).replace("+", "%20")))
        return "$title: " + sum.optString("extract").take(1500)
    }

    private fun fmtDay(ms: Long) =
        DateTimeFormatter.ofPattern("d.M.yyyy", Locale.GERMANY).format(java.time.Instant.ofEpochMilli(ms).atZone(ZoneId.systemDefault()))

    private fun hasCalendar(write: Boolean): Boolean = ContextCompat.checkSelfPermission(
        context, if (write) Manifest.permission.WRITE_CALENDAR else Manifest.permission.READ_CALENDAR
    ) == PackageManager.PERMISSION_GRANTED

    private fun listEvents(from: String, to: String): String {
        if (!hasCalendar(false)) return "Keine Berechtigung für den Kalender. Der Nutzer muss den Kalenderzugriff für Jarvis erlauben."
        val zone = ZoneId.systemDefault()
        val start = LocalDate.parse(from).atStartOfDay(zone).toInstant().toEpochMilli()
        val end = LocalDate.parse(to).plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()
        val uri = CalendarContract.Instances.CONTENT_URI.buildUpon().also {
            android.content.ContentUris.appendId(it, start)
            android.content.ContentUris.appendId(it, end)
        }.build()
        val cols = arrayOf(
            CalendarContract.Instances.EVENT_ID, CalendarContract.Instances.TITLE, CalendarContract.Instances.BEGIN,
            CalendarContract.Instances.END, CalendarContract.Instances.ALL_DAY, CalendarContract.Instances.EVENT_LOCATION,
            CalendarContract.Instances.CALENDAR_DISPLAY_NAME
        )
        val f = DateTimeFormatter.ofPattern("EEEE, d. MMMM, HH:mm", Locale.GERMANY)
        val fd = DateTimeFormatter.ofPattern("EEEE, d. MMMM", Locale.GERMANY)
        val out = mutableListOf<String>()
        context.contentResolver.query(uri, cols, null, null, CalendarContract.Instances.BEGIN + " ASC")?.use { c ->
            while (c.moveToNext() && out.size < 60) {
                val allDay = c.getInt(4) == 1
                val begin = java.time.Instant.ofEpochMilli(c.getLong(2))
                val when_ = if (allDay) fd.format(begin.atZone(ZoneId.of("UTC"))) + " (ganztägig)"
                else f.format(begin.atZone(zone)) + " bis " + DateTimeFormatter.ofPattern("HH:mm").format(java.time.Instant.ofEpochMilli(c.getLong(3)).atZone(zone))
                val loc = c.getString(5)?.takeIf { it.isNotBlank() }?.let { ", Ort: $it" } ?: ""
                out.add("ID ${c.getLong(0)}: ${c.getString(1) ?: "(ohne Titel)"}, $when_$loc [${c.getString(6) ?: ""}]")
            }
        }
        return if (out.isEmpty()) "Keine Termine in diesem Zeitraum." else out.joinToString("\n")
    }

    /** Sucht den Hauptkalender: bevorzugt ein beschreibbarer Google-Kalender. */
    private fun primaryCalendarId(): Long? {
        val cols = arrayOf(
            CalendarContract.Calendars._ID, CalendarContract.Calendars.ACCOUNT_TYPE,
            CalendarContract.Calendars.IS_PRIMARY, CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL,
            CalendarContract.Calendars.VISIBLE
        )
        var best: Long? = null
        var bestScore = -1
        context.contentResolver.query(CalendarContract.Calendars.CONTENT_URI, cols, null, null, null)?.use { c ->
            while (c.moveToNext()) {
                if (c.getInt(3) < CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR) continue
                val score = (if (c.getString(1) == "com.google") 4 else 0) + (if (c.getInt(2) == 1) 2 else 0) + (if (c.getInt(4) == 1) 1 else 0)
                if (score > bestScore) { bestScore = score; best = c.getLong(0) }
            }
        }
        return best
    }

    private fun addEvent(input: Map<*, *>): String {
        if (!hasCalendar(true)) return "Keine Berechtigung für den Kalender. Der Nutzer muss den Kalenderzugriff für Jarvis erlauben."
        val calId = primaryCalendarId() ?: return "Auf dem Tablet ist kein beschreibbarer Kalender eingerichtet."
        val zone = ZoneId.systemDefault()
        val allDay = input["all_day"] == true
        val start = LocalDateTime.parse(input["start"].toString().take(16))
        val end = input["end"]?.toString()?.takeIf { it.isNotBlank() }?.let { LocalDateTime.parse(it.take(16)) }
            ?: if (allDay) start.plusDays(1) else start.plusHours(1)
        val values = ContentValues().apply {
            put(CalendarContract.Events.CALENDAR_ID, calId)
            put(CalendarContract.Events.TITLE, input["title"].toString())
            input["location"]?.toString()?.takeIf { it.isNotBlank() }?.let { put(CalendarContract.Events.EVENT_LOCATION, it) }
            if (allDay) {
                val utc = ZoneId.of("UTC")
                put(CalendarContract.Events.DTSTART, start.toLocalDate().atStartOfDay(utc).toInstant().toEpochMilli())
                put(CalendarContract.Events.DTEND, maxOf(end.toLocalDate(), start.toLocalDate().plusDays(1)).atStartOfDay(utc).toInstant().toEpochMilli())
                put(CalendarContract.Events.ALL_DAY, 1)
                put(CalendarContract.Events.EVENT_TIMEZONE, "UTC")
            } else {
                put(CalendarContract.Events.DTSTART, start.atZone(zone).toInstant().toEpochMilli())
                put(CalendarContract.Events.DTEND, end.atZone(zone).toInstant().toEpochMilli())
                put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
            }
        }
        val uri = context.contentResolver.insert(CalendarContract.Events.CONTENT_URI, values)
            ?: return "Der Termin konnte nicht gespeichert werden."
        // Standard-Erinnerung 30 Minuten vorher
        if (!allDay) {
            val id = uri.lastPathSegment?.toLongOrNull()
            if (id != null) {
                context.contentResolver.insert(CalendarContract.Reminders.CONTENT_URI, ContentValues().apply {
                    put(CalendarContract.Reminders.EVENT_ID, id)
                    put(CalendarContract.Reminders.MINUTES, 30)
                    put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT)
                })
            }
        }
        return "Termin eingetragen."
    }

    private fun deleteEvent(id: Long): String {
        if (!hasCalendar(true)) return "Keine Berechtigung für den Kalender."
        val uri = android.content.ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id)
        return if (context.contentResolver.delete(uri, null, null) > 0) "Termin gelöscht." else "Termin nicht gefunden."
    }

    private fun setAlarm(hour: Int, minute: Int, label: String?): String {
        val i = Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, hour)
            .putExtra(AlarmClock.EXTRA_MINUTES, minute)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        label?.takeIf { it.isNotBlank() }?.let { i.putExtra(AlarmClock.EXTRA_MESSAGE, it) }
        context.startActivity(i)
        return "Wecker gestellt."
    }

    private fun setTimer(seconds: Int, label: String?): String {
        val i = Intent(AlarmClock.ACTION_SET_TIMER)
            .putExtra(AlarmClock.EXTRA_LENGTH, seconds)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        label?.takeIf { it.isNotBlank() }?.let { i.putExtra(AlarmClock.EXTRA_MESSAGE, it) }
        context.startActivity(i)
        return "Timer gestartet."
    }
}
