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

    fun ask(history: List<Turn>, question: String, conversationId: Long): String {
        if (!store.hasAnyKey) return "Sir, mir fehlt noch ein Schlüssel. Bitte tragen Sie ihn in den Einstellungen ein."
        val useGemini = store.geminiKey.isNotBlank() && (store.provider == "gemini" || store.apiKey.isBlank())
        if (!useGemini) return claude.ask(history, question, conversationId)
        return try {
            gemini.ask(history, question, conversationId)
        } catch (e: FreeLimitReached) {
            if (store.apiKey.isNotBlank()) claude.ask(history, question, conversationId)
            else "Sir, das kostenlose Tageskontingent ist aufgebraucht. Morgen bin ich wieder ganz für Sie da."
        }
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
        Nur wenn diese nicht reichen (Öffnungszeiten, Preise, Sportergebnisse, sehr aktuelle Ereignisse), nutze die Internetsuche.
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

    fun ask(history: List<Turn>, question: String, conversationId: Long): String {
        val contents = JSONArray()
        history.takeLast(10).forEach { t ->
            contents.put(msg(if (t.role == "user") "user" else "model", t.text))
        }
        contents.put(msg("user", question))

        val body = JSONObject()
            .put("systemInstruction", JSONObject().put("parts", JSONArray().put(JSONObject().put("text", systemPrompt(store)))))
            .put("contents", contents)
            .put("tools", JSONArray().put(JSONObject().put("functionDeclarations", tools.geminiDeclarations(listOf(internetSearch)))))
            .put("generationConfig", JSONObject().put("maxOutputTokens", 1500).put("temperature", 0.7))

        return try {
            for (round in 0 until 6) {
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
                    val result = if (name == internetSearch.name) search(args.optString("query"))
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
        } catch (e: java.io.IOException) {
            "Sir, ich erreiche das Internet gerade nicht. Bitte prüfen Sie die WLAN-Verbindung."
        } catch (e: Exception) {
            "Verzeihung, Sir, da ist etwas schiefgelaufen: ${e.message?.take(160)}"
        }
    }

    /** Eigene kleine Gemini-Anfrage, die nur die Google-Suche benutzt. */
    private fun search(query: String): String = try {
        val body = JSONObject()
            .put("contents", JSONArray().put(msg("user",
                "Recherchiere mit der Google-Suche und beantworte auf Deutsch mit den wichtigsten aktuellen Fakten in wenigen Sätzen: $query")))
            .put("tools", JSONArray().put(JSONObject().put("google_search", JSONObject())))
            .put("generationConfig", JSONObject().put("maxOutputTokens", 800))
        val res = generate(body)
        val parts = res.optJSONArray("candidates")?.optJSONObject(0)?.optJSONObject("content")?.optJSONArray("parts")
        (0 until (parts?.length() ?: 0)).joinToString(" ") { parts!!.getJSONObject(it).optString("text") }.trim()
            .ifBlank { "Die Suche hat nichts ergeben." }
    } catch (e: FreeLimitReached) {
        "Die kostenlose Internetsuche ist für heute aufgebraucht."
    } catch (e: Exception) {
        "Die Internetsuche ist gerade nicht verfügbar."
    }

    /** Schickt die Anfrage; probiert bei Bedarf das nächste kostenlose Modell. */
    private fun generate(body: JSONObject): JSONObject {
        val models = candidates()
        var limitHit = false
        var lastError = "kein Modell verfügbar"
        for (model in models) {
            val (code, text) = post("models/$model:generateContent", body)
            when {
                code == 200 -> {
                    if (store.geminiModel != model) store.geminiModel = model
                    return JSONObject(text)
                }
                code == 429 -> { limitHit = true; lastError = "Limit erreicht" }
                code == 404 || (code == 400 && text.contains("not supported", true)) -> lastError = "Modell $model nicht verfügbar"
                code == 400 && text.contains("API key", true) -> throw IllegalStateException("Der Gemini-Schlüssel wird nicht akzeptiert. Bitte in den Einstellungen prüfen.")
                code == 403 -> throw IllegalStateException("Der Gemini-Schlüssel hat keinen Zugriff. Bitte in den Einstellungen prüfen.")
                else -> lastError = "Fehler $code"
            }
        }
        if (limitHit) throw FreeLimitReached()
        throw IllegalStateException(lastError)
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
                        .filter { Regex("^gemini-[0-9.]+-flash(-lite)?(-latest)?$").matches(it) }
                        .sortedWith(compareByDescending<String> { version(it) }.thenBy { it.contains("lite") })
                }
            } catch (e: Exception) { emptyList() }
            val all = (found + listOf("gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite")).distinct()
            all.also { if (found.isNotEmpty()) cachedList = it }
        }
        val last = store.geminiModel
        return if (last.isNotBlank()) (listOf(last) + list).distinct() else list
    }

    private fun version(name: String): Double =
        Regex("gemini-([0-9.]+)").find(name)?.groupValues?.get(1)?.toDoubleOrNull() ?: 0.0

    private fun msg(role: String, text: String) =
        JSONObject().put("role", role).put("parts", JSONArray().put(JSONObject().put("text", text)))

    private fun toMap(o: JSONObject): Map<String, Any?> =
        o.keys().asSequence().associateWith { k -> o.get(k).let { if (it == JSONObject.NULL) null else it } }

    private fun post(path: String, body: JSONObject): Pair<Int, String> = request(path, body.toString())
    private fun get(path: String): Pair<Int, String> = request(path, null)

    private fun request(path: String, body: String?): Pair<Int, String> {
        val c = URL(api + path).openConnection() as HttpURLConnection
        c.connectTimeout = 15_000
        c.readTimeout = 90_000
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
                .timeout(Duration.ofSeconds(90))
                .maxRetries(2)
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

    fun ask(history: List<Turn>, question: String, conversationId: Long): String {
        if (store.apiKey.isBlank()) return "Sir, für Claude fehlt mir der API-Schlüssel."

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
            "Sir, der Claude-Schlüssel wird nicht akzeptiert. Bitte prüfen Sie ihn in den Einstellungen."
        } catch (e: PermissionDeniedException) {
            "Sir, Ihr Claude-Konto erlaubt diese Anfrage nicht. Bitte prüfen Sie Ihr Guthaben bei Anthropic."
        } catch (e: RateLimitException) {
            "Einen kleinen Moment, Sir, ich bekomme gerade zu viele Anfragen."
        } catch (e: OverloadedException) {
            "Die Server sind gerade überlastet, Sir. Versuchen Sie es bitte gleich noch einmal."
        } catch (e: AnthropicIoException) {
            "Sir, ich erreiche das Internet gerade nicht. Bitte prüfen Sie die WLAN-Verbindung."
        } catch (e: Exception) {
            val msg = e.message.orEmpty()
            if (msg.contains("credit", true) || msg.contains("balance", true))
                "Sir, Ihr Claude-Guthaben ist aufgebraucht. Bitte laden Sie es bei Anthropic auf."
            else "Verzeihung, Sir, da ist etwas schiefgelaufen: ${msg.take(160)}"
        }
    }
}
