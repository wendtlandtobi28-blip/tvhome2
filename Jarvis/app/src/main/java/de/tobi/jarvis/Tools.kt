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
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.TimeZone

/**
 * Werkzeuge, die Jarvis auf dem Tablet benutzen darf: Kalender (der Google-Kalender, der auf dem
 * Tablet eingerichtet ist), Wecker und Timer der Uhr-App, eigene Notizen und frühere Gespräche.
 */
class Tools(private val context: Context, private val store: Store) {

    private fun tool(name: String, description: String, props: Map<String, Map<String, Any>>, required: List<String>): Tool {
        val p = Tool.InputSchema.Properties.builder()
        props.forEach { (k, v) -> p.putAdditionalProperty(k, JsonValue.from(v)) }
        return Tool.builder()
            .name(name)
            .description(description)
            .inputSchema(Tool.InputSchema.builder().properties(p.build()).required(required).build())
            .build()
    }

    private fun str(desc: String) = mapOf("type" to "string", "description" to desc)
    private fun int(desc: String) = mapOf("type" to "integer", "description" to desc)

    val definitions: List<Tool> = listOf(
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
