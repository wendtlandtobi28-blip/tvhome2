package de.tobi.jarvis

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.errors.AnthropicIoException
import com.anthropic.errors.OverloadedException
import com.anthropic.errors.PermissionDeniedException
import com.anthropic.errors.RateLimitException
import com.anthropic.errors.UnauthorizedException
import com.anthropic.models.messages.ContentBlockParam
import com.anthropic.models.messages.MessageCreateParams
import com.anthropic.models.messages.MessageParam
import com.anthropic.models.messages.OutputConfig
import com.anthropic.models.messages.StopReason
import com.anthropic.models.messages.ToolResultBlockParam
import com.anthropic.models.messages.UserLocation
import com.anthropic.models.messages.WebSearchTool20250305
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.time.Duration
import java.util.Date
import java.util.Locale

/** Die Antwort hat zu lange gedauert. */
class TooSlow : Exception()

/** Der Gemini-Schlüssel wird von Google abgelehnt. */
class BadKey : Exception()

/** Wird geworfen, wenn das kostenlose Gemini-Kontingent für heute aufgebraucht ist. */
class FreeLimitReached : Exception()

/**
 * Das Gehirn von Jarvis. Standard ist Google Gemini im kostenlosen Tarif.
 * Ist dort das Tageslimit erreicht und ein Claude-Schlüssel hinterlegt, springt Claude Haiku ein
 * (das günstigste Claude-Modell). Läuft blockierend: nur aus einem Hintergrund-Thread aufrufen.
 */
class Brain(private val store: Store, private val tools: Tools) {
    private val gemini = GeminiBrain(store, tools)
    private val claude = ClaudeBrain(store, tools)

    /** Bereitet Gemini schon beim App-Start vor, damit die erste Frage schneller geht. */
    fun warmUp() {
        if (store.geminiKey.isNotBlank()) try { gemini.warmUp() } catch (_: Exception) {}
    }

    /** Prüft die Verbindung und sagt in Worten, was los ist (für den Test-Knopf in den Einstellungen). */
    fun test(): String {
        if (store.geminiKey.isBlank()) return "Kein Gemini-Schlüssel eingetragen."
        return gemini.test()
    }

    fun ask(history: List<Turn>, question: String, conversationId: Long): String {
        if (!store.hasAnyKey) return "Sir, mir fehlt noch ein Schlüssel. Bitte tragen Sie ihn in den Einstellungen ein."
        // Kostenlos geht vor: Ist ein Gemini-Schlüssel da, wird immer zuerst Gemini benutzt
        if (store.geminiKey.isBlank()) return claude.ask(history, question, conversationId) ?: CLAUDE_NO_CREDIT
        return try {
            gemini.ask(history, question, conversationId)
        } catch (e: FreeLimitReached) {
            // Claude nur als stille Reserve: hat das Claude-Konto kein Guthaben, wird nicht ständig ans Aufladen erinnert
            (if (store.apiKey.isNotBlank()) claude.ask(history, question, conversationId, quietAboutCredit = true) else null)
                ?: "Sir, das kostenlose Kontingent bei Google ist gerade erschöpft. In ein paar Minuten, spätestens morgen, bin ich wieder ganz für Sie da."
        }
    }

    companion object {
        const val CLAUDE_NO_CREDIT = "Sir, Ihr Claude-Guthaben ist aufgebraucht. Tragen Sie in den Einstellungen einen kostenlosen Gemini-Schlüssel ein, dann brauchen Sie kein Guthaben."
    }
}

/** Gemeinsame Anweisungen für beide Gehirne. */
fun systemPrompt(store: Store): String {
    val now = SimpleDateFormat("EEEE, d. MMMM yyyy, HH:mm 'Uhr'", Locale.GERMANY).format(Date())
    val home = store.homeCity.ifBlank { "unbekannt" }
    return """
        Du bist Jarvis, der persönliche KI-Butler deines Nutzers – höflich, souverän, mit einem Hauch trockenem britischem Humor.
        Sprich den Nutzer immer mit "Sir" an und siez ihn. Antworte immer auf Deutsch.
        Deine Antworten werden laut vorgelesen: Sprich natürlich und knapp, meist ein bis drei Sätze.
        Verwende kein Markdown, keine Aufzählungszeichen, keine Tabellen, keine Links und keine Emojis.
        Schreibe Zahlen und Einheiten so, wie man sie spricht (zum Beispiel "zwölf Grad" statt "12°C").
        Für Wetter nutze das Werkzeug weather, für Nachrichten news, für Wissensfragen wikipedia. Diese sind kostenlos und gehen vor.
        Antworte so schnell wie möglich und in erster Linie aus deinem eigenen Wissen. Recherchiere nicht ausführlich.
        Die Internetsuche nur bei wirklich aktuellen Dingen benutzen (Öffnungszeiten, Preise, Sportergebnisse, Ereignisse der letzten Tage),
        und dann höchstens ein einziges Mal pro Frage, mit einer kurzen, genauen Suchanfrage.
        Wenn der Nutzer sich auf frühere Gespräche bezieht ("weißt du noch", "was hatte ich dich gefragt"), nutze search_conversations.
        Du hast Zugriff auf den Kalender des Tablets (auch den Google-Kalender): Termine lesen, eintragen und löschen.
        Du kannst Wecker und Timer in der Uhr-App stellen und eigene Notizen speichern, vorlesen und löschen.
        Bestätige nach einer Aktion kurz, was du getan hast (zum Beispiel "Erledigt, Sir, Zahnarzt am Dienstag um zehn Uhr ist eingetragen.").
        Löschen nur nach ausdrücklicher Bestätigung des Nutzers.
        Auf Gmail, Google Notizen (Keep) oder Google Drive hast du keinen Zugriff; sag das ehrlich, wenn danach gefragt wird.
        Wenn du etwas nicht weißt, sag es ehrlich.
        Jetzt ist $now. Der Nutzer ist in Deutschland, Wohnort: $home.
    """.trimIndent()
}

// =====================================================================================
// Gemini (kostenlos)
// =====================================================================================

class GeminiBrain(private val store: Store, private val tools: Tools) {
    private val api = "https://generativelanguage.googleapis.com/v1beta/"

    /** Ein eigenes Werkzeug, hinter dem eine Gemini-Anfrage mit Google-Suche steckt. */
    private val internetSearch = ToolSpec(
        "internet_search",
        "Sucht aktuelle Informationen mit der Google-Suche im Internet. Nur benutzen, wenn weather, news und wikipedia nicht reichen.",
        mapOf("query" to mapOf("type" to "string", "description" to "Wonach gesucht wird, als vollständige Frage")),
        listOf("query")
    )

    /** Spätester Zeitpunkt für die Antwort; danach wird abgebrochen. */
    @Volatile private var deadline = 0L
    @Volatile private var searchesLeft = 1

    fun warmUp() {
        deadline = System.currentTimeMillis() + 15_000
        candidates()
    }

    fun ask(history: List<Turn>, question: String, conversationId: Long): String {
        deadline = System.currentTimeMillis() + 25_000
        searchesLeft = 1
        val contents = JSONArray()
        history.takeLast(10).forEach { t ->
            contents.put(msg(if (t.role == "user") "user" else "model", t.text))
        }
        contents.put(msg("user", question))

        val body = JSONObject()
            .put("systemInstruction", JSONObject().put("parts", JSONArray().put(JSONObject().put("text", systemPrompt(store)))))
            .put("contents", contents)
            .put("tools", JSONArray().put(JSONObject().put("functionDeclarations", tools.geminiDeclarations(listOf(internetSearch)))))
            .put("generationConfig", JSONObject().put("maxOutputTokens", 400).put("temperature", 0.7))

        return try {
            for (round in 0 until 3) {
                // In der letzten Runde keine Werkzeuge mehr anbieten: dann muss eine Antwort kommen
                if (round == 2) body.put("toolConfig", JSONObject().put("functionCallingConfig", JSONObject().put("mode", "NONE")))
                val res = generate(body)
                val candidate = res.optJSONArray("candidates")?.optJSONObject(0)
                    ?: return "Verzeihung, Sir, darauf darf ich leider nicht antworten."
                val content = candidate.optJSONObject("content") ?: JSONObject().put("role", "model").put("parts", JSONArray())
                val parts = content.optJSONArray("parts") ?: JSONArray()
                val calls = (0 until parts.length()).mapNotNull { parts.getJSONObject(it).optJSONObject("functionCall") }
                if (calls.isEmpty()) {
                    val text = (0 until parts.length())
                        .map { parts.getJSONObject(it) }
                        .filter { !it.optBoolean("thought") }
                        .joinToString(" ") { it.optString("text") }
                        .trim()
                    return text.ifBlank { "Verzeihung, Sir, darauf habe ich gerade keine Antwort." }
                }
                // Antwort des Modells unverändert zurückgeben (enthält ggf. Signaturen, die Gemini braucht)
                if (!content.has("role")) content.put("role", "model")
                contents.put(content)
                val responses = JSONArray()
                for (call in calls) {
                    val name = call.optString("name")
                    val args = call.optJSONObject("args") ?: JSONObject()
                    val result = if (name == internetSearch.name) {
                        if (searchesLeft-- > 0) { tools.status("Suche kurz im Internet …"); search(args.optString("query")) }
                        else "Keine weitere Suche. Antworte jetzt mit dem, was du weißt."
                    }
                    else tools.run(name, toMap(args), conversationId)
                    val fr = JSONObject().put("name", name).put("response", JSONObject().put("result", result))
                    if (call.has("id")) fr.put("id", call.get("id"))
                    responses.put(JSONObject().put("functionResponse", fr))
                }
                contents.put(JSONObject().put("role", "user").put("parts", responses))
            }
            "Verzeihung, Sir, das hat zu lange gedauert. Fragen Sie mich bitte noch einmal."
        } catch (e: FreeLimitReached) {
            throw e
        } catch (e: TooSlow) {
            "Verzeihung, Sir, Google antwortet gerade sehr langsam. Fragen Sie mich bitte gleich noch einmal."
        } catch (e: java.net.SocketTimeoutException) {
            "Verzeihung, Sir, Google antwortet gerade sehr langsam. Fragen Sie mich bitte gleich noch einmal."
        } catch (e: BadKey) {
            "Sir, Google akzeptiert den Gemini-Schlüssel nicht. Bitte tippen Sie oben auf Einstellungen und fügen Sie nur den Schlüssel ein, der mit A I z a beginnt."
        } catch (e: java.io.IOException) {
            "Sir, ich erreiche das Internet gerade nicht. Bitte prüfen Sie die WLAN-Verbindung."
        } catch (e: Exception) {
            "Verzeihung, Sir, da ist etwas schiefgelaufen: ${e.message?.take(160)}"
        }
    }

    /** Eigene kleine Gemini-Anfrage, die nur die Google-Suche benutzt. */
    private fun search(query: String): String = try {
        // Die Suche bekommt höchstens 12 Sekunden, damit danach noch Zeit für die Antwort bleibt
        val outer = deadline
        deadline = minOf(outer, System.currentTimeMillis() + 12_000)
        val body = JSONObject()
            .put("contents", JSONArray().put(msg("user",
                "Suche einmal kurz mit der Google-Suche und nenne auf Deutsch in höchstens drei Sätzen die wichtigsten Fakten. Keine lange Recherche: $query")))
            .put("tools", JSONArray().put(JSONObject().put("google_search", JSONObject())))
            .put("generationConfig", JSONObject().put("maxOutputTokens", 300))
        val res = try { generate(body) } finally { deadline = outer }
        val parts = res.optJSONArray("candidates")?.optJSONObject(0)?.optJSONObject("content")?.optJSONArray("parts")
        (0 until (parts?.length() ?: 0)).joinToString(" ") { parts!!.getJSONObject(it).optString("text") }.trim()
            .ifBlank { "Die Suche hat nichts ergeben." }
    } catch (e: FreeLimitReached) {
        "Die kostenlose Internetsuche ist für heute aufgebraucht."
    } catch (e: Exception) {
        "Die Internetsuche ist gerade nicht verfügbar."
    }

    /**
     * Schickt die Anfrage; probiert bei Bedarf das nächste kostenlose Modell.
     * Schaltet das lange Nachdenken der Modelle ab bzw. auf "niedrig", damit Antworten schnell kommen.
     * Welche Einstellung ein Modell versteht, wird ausprobiert und gemerkt.
     */
    private fun generate(body: JSONObject): JSONObject {
        val now = System.currentTimeMillis()
        val all = candidates()
        val usable = all.filter { store.modelBlockedUntil(it) < now }.ifEmpty { all.take(2) }
        var limitHit = false
        var lastError = "kein Modell verfügbar"
        for (model in usable) {
            if (deadline - System.currentTimeMillis() < 2500) break
            val remembered = store.thinkingMode(model)
            val modes = if (remembered.isNotBlank()) listOf(remembered) else listOf("level", "budget", "none")
            for (mode in modes) {
                val (code, text) = post("models/$model:generateContent", withThinking(body, mode))
                if (code == 400 && text.contains("thinking", true) && mode != "none") continue
                when {
                    code == 200 -> {
                        if (store.geminiModel != model) store.geminiModel = model
                        if (remembered != mode) store.setThinkingMode(model, mode)
                        lastGood = model
                        return JSONObject(text)
                    }
                    code == 429 -> {
                        limitHit = true
                        lastError = "Limit bei $model"
                        // Jedes Modell hat sein eigenes Kontingent: sperren und das nächste probieren
                        val msg = text.lowercase()
                        val pause = when {
                            // Modell gehört nicht zum Gratis-Tarif (Kontingent 0): drei Tage überspringen
                            msg.contains("limit: 0") || msg.contains("billing") || msg.contains("paid") -> 3 * 24 * 3600_000L
                            msg.contains("perday") || msg.contains("per day") || msg.contains("daily") -> 6 * 3600_000L
                            else -> 60_000L
                        }
                        store.blockModel(model, System.currentTimeMillis() + pause)
                        if (store.geminiModel == model) store.geminiModel = ""
                    }
                    code == 404 || (code == 400 && text.contains("not supported", true)) -> {
                        lastError = "Modell $model nicht verfügbar"
                        store.blockModel(model, System.currentTimeMillis() + 7 * 24 * 3600_000L)
                    }
                    code == 400 && text.contains("API key", true) -> throw BadKey()
                    code == 401 || code == 403 -> throw BadKey()
                    else -> lastError = "Fehler $code bei $model: " + Regex("\"message\":\\s*\"([^\"]{0,140})").find(text)?.groupValues?.get(1).orEmpty()
                }
                break
            }
        }
        if (limitHit) throw FreeLimitReached()
        throw IllegalStateException(lastError)
    }

    @Volatile private var lastGood = ""

    /** Kurze Testanfrage; Ergebnis in verständlichen Worten. */
    fun test(): String {
        deadline = System.currentTimeMillis() + 40_000
        return try {
            val body = JSONObject()
                .put("contents", JSONArray().put(msg("user", "Antworte nur mit dem Wort: Bereit")))
                .put("generationConfig", JSONObject().put("maxOutputTokens", 20))
            generate(body)
            "✓ Gemini funktioniert kostenlos (Modell: $lastGood)."
        } catch (e: BadKey) {
            "✗ Google lehnt den Schlüssel ab. Bitte den Schlüssel neu kopieren (beginnt mit AIza)."
        } catch (e: FreeLimitReached) {
            "✗ Google meldet bei allen Gratis-Modellen ein Limit. Bitte in ein paar Minuten erneut testen. " +
                "Wenn es dauerhaft so bleibt: Auf aistudio.google.com/apikey prüfen, ob beim Schlüssel „Free“ steht und keine Abrechnung aktiv ist."
        } catch (e: TooSlow) {
            "✗ Google antwortet gerade nicht rechtzeitig. Bitte später erneut testen."
        } catch (e: java.io.IOException) {
            "✗ Keine Internetverbindung."
        } catch (e: Exception) {
            "✗ ${e.message}"
        }
    }

    private fun withThinking(body: JSONObject, mode: String): JSONObject {
        val copy = JSONObject(body.toString())
        val gen = copy.optJSONObject("generationConfig") ?: JSONObject().also { copy.put("generationConfig", it) }
        when (mode) {
            "level" -> gen.put("thinkingConfig", JSONObject().put("thinkingLevel", "low"))
            "budget" -> gen.put("thinkingConfig", JSONObject().put("thinkingBudget", 0))
        }
        return copy
    }

    private var cachedList: List<String>? = null

    /**
     * Sucht die "Flash"-Modelle, die Google gerade anbietet (die schnellen, im Gratis-Tarif nutzbaren),
     * neueste zuerst. Das zuletzt funktionierende Modell kommt an den Anfang.
     */
    private fun candidates(): List<String> {
        val list = cachedList ?: run {
            val found = try {
                val (code, text) = get("models?pageSize=200")
                if (code != 200) emptyList() else {
                    val arr = JSONObject(text).optJSONArray("models") ?: JSONArray()
                    (0 until arr.length()).map { arr.getJSONObject(it) }
                        .filter { m ->
                            val methods = m.optJSONArray("supportedGenerationMethods")
                            methods != null && (0 until methods.length()).any { methods.getString(it) == "generateContent" }
                        }
                        .map { it.getString("name").removePrefix("models/") }
                        // Nur Text-Modelle; Bild-, Sprach- und Spezialmodelle sowie die teuren "pro"-Modelle auslassen
                        .filter { it.startsWith("gemini-") }
                        .filterNot { n -> listOf("pro", "image", "tts", "audio", "embed", "live", "vision", "computer", "robotics", "exp", "learnlm")
                            .any { n.contains(it) } }
                        // Neueste Generation zuerst; innerhalb einer Generation die schnellen "flash"-Modelle bevorzugen
                        // Gratis-Tarif gibt es fast immer für die stabilen "flash"-Modelle; die zuerst, neueste vorne.
                        // Vorschau- und ganz neue Sondermodelle (z. B. gemini-4-hydrogen) kommen danach.
                        .sortedWith(
                            compareByDescending<String> { it.contains("flash") && !it.contains("preview") }
                                .thenByDescending { version(it) }
                                .thenBy { it.contains("lite") }
                                .thenBy { it.contains("preview") }
                        )
                }
            } catch (e: Exception) { emptyList() }
            val all = (found + listOf("gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite")).distinct()
            all.also { if (found.isNotEmpty()) cachedList = it }
        }
        val last = store.geminiModel
        return if (last.isNotBlank()) (listOf(last) + list).distinct() else list
    }

    private fun version(name: String): Double =
        Regex("gemini-([0-9]+(\\.[0-9]+)?)").find(name)?.groupValues?.get(1)?.toDoubleOrNull() ?: 0.0

    private fun msg(role: String, text: String) =
        JSONObject().put("role", role).put("parts", JSONArray().put(JSONObject().put("text", text)))

    private fun toMap(o: JSONObject): Map<String, Any?> =
        o.keys().asSequence().associateWith { k -> o.get(k).let { if (it == JSONObject.NULL) null else it } }

    private fun post(path: String, body: JSONObject): Pair<Int, String> = request(path, body.toString())
    private fun get(path: String): Pair<Int, String> = request(path, null)

    private fun request(path: String, body: String?): Pair<Int, String> {
        val remaining = (deadline - System.currentTimeMillis()).toInt()
        if (remaining < 1500) throw TooSlow()
        val c = URL(api + path).openConnection() as HttpURLConnection
        c.connectTimeout = minOf(8_000, remaining)
        c.readTimeout = remaining
        c.setRequestProperty("x-goog-api-key", store.geminiKey)
        if (body != null) {
            c.requestMethod = "POST"
            c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            c.outputStream.use { it.write(body.toByteArray()) }
        }
        return try {
            val code = c.responseCode
            val stream = if (code in 200..299) c.inputStream else c.errorStream
            code to (stream?.use { it.readBytes().decodeToString() } ?: "")
        } finally {
            c.disconnect()
        }
    }
}

// =====================================================================================
// Claude Haiku (günstig, braucht Guthaben)
// =====================================================================================

class ClaudeBrain(private val store: Store, private val tools: Tools) {
    private var client: AnthropicClient? = null
    private var clientKey = ""

    private fun client(): AnthropicClient {
        val key = store.apiKey
        if (client == null || key != clientKey) {
            client = AnthropicOkHttpClient.builder()
                .apiKey(key)
                .timeout(Duration.ofSeconds(30))
                .maxRetries(1)
                .build()
            clientKey = key
        }
        return client!!
    }

    // Kostenpflichtige Websuche nur sparsam: höchstens zwei Suchen pro Frage
    private val webSearch = WebSearchTool20250305.builder()
        .maxUses(2L)
        .userLocation(UserLocation.builder().country("DE").timezone("Europe/Berlin").build())
        .build()

    /** Gibt null zurück, wenn [quietAboutCredit] gesetzt ist und Claude wegen fehlendem Guthaben nicht kann. */
    fun ask(history: List<Turn>, question: String, conversationId: Long, quietAboutCredit: Boolean = false): String? {
        if (store.apiKey.isBlank()) return null

        val messages = mutableListOf<MessageParam>()
        // Nur die letzten Runden mitschicken, damit es günstig bleibt
        history.takeLast(10).forEach {
            messages.add(if (it.role == "user") MessageParam.ofUser(it.text) else MessageParam.ofAssistant(it.text))
        }
        while (messages.isNotEmpty() && !messages.first().isUser()) messages.removeAt(0)
        messages.add(MessageParam.ofUser(question))

        return try {
            for (round in 0 until 6) {
                val params = MessageCreateParams.builder()
                    // Günstigstes Claude-Modell, ausdrücklich so vom Nutzer gewünscht
                    .model("claude-haiku-5-5")
                    .maxTokens(1500L)
                    .system(systemPrompt(store))
                    .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.LOW).build())
                    .addTool(webSearch)
                    .apply { tools.claudeTools().forEach { addTool(it) } }
                    .messages(messages)
                    .build()

                val response = client().messages().create(params)
                when (response.stopReason().orElse(null)) {
                    StopReason.REFUSAL -> return "Verzeihung, Sir, dabei kann ich Ihnen leider nicht helfen."
                    StopReason.TOOL_USE -> {
                        messages.add(response.toParam())
                        val results = response.content().mapNotNull { block ->
                            block.toolUse().orElse(null)?.let { use ->
                                val input = use._input().convert(Map::class.java) as? Map<*, *> ?: emptyMap<Any, Any>()
                                ContentBlockParam.ofToolResult(
                                    ToolResultBlockParam.builder()
                                        .toolUseId(use.id())
                                        .content(tools.run(use.name(), input, conversationId))
                                        .build()
                                )
                            }
                        }
                        messages.add(MessageParam.ofUserOfContentBlockParams(results))
                    }
                    StopReason.PAUSE_TURN -> messages.add(response.toParam())
                    else -> {
                        val text = response.content().mapNotNull { it.text().orElse(null)?.text() }.joinToString(" ").trim()
                        return text.ifBlank { "Verzeihung, Sir, darauf habe ich gerade keine Antwort." }
                    }
                }
            }
            "Verzeihung, Sir, das hat zu lange gedauert. Fragen Sie mich bitte noch einmal."
        } catch (e: UnauthorizedException) {
            if (quietAboutCredit) null else "Sir, der Claude-Schlüssel wird nicht akzeptiert. Bitte prüfen Sie ihn in den Einstellungen."
        } catch (e: PermissionDeniedException) {
            if (quietAboutCredit) null else Brain.CLAUDE_NO_CREDIT
        } catch (e: RateLimitException) {
            "Einen kleinen Moment, Sir, ich bekomme gerade zu viele Anfragen."
        } catch (e: OverloadedException) {
            "Die Server sind gerade überlastet, Sir. Versuchen Sie es bitte gleich noch einmal."
        } catch (e: AnthropicIoException) {
            "Sir, ich erreiche das Internet gerade nicht. Bitte prüfen Sie die WLAN-Verbindung."
        } catch (e: Exception) {
            val msg = e.message.orEmpty()
            if (msg.contains("credit", true) || msg.contains("balance", true) || msg.contains("billing", true))
                (if (quietAboutCredit) null else Brain.CLAUDE_NO_CREDIT)
            else if (quietAboutCredit) null
            else "Verzeihung, Sir, da ist etwas schiefgelaufen: ${msg.take(160)}"
        }
    }
}
