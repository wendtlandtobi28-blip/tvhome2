package de.tobi.jarvis

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
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
import com.anthropic.models.messages.Tool
import com.anthropic.models.messages.ToolResultBlockParam
import com.anthropic.models.messages.UserLocation
import com.anthropic.models.messages.WebSearchTool20260209
import java.text.SimpleDateFormat
import java.time.Duration
import java.util.Date
import java.util.Locale

/** Spricht mit Claude. Läuft blockierend, also nur aus einem Hintergrund-Thread aufrufen. */
class Brain(private val store: Store) {
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

    private fun systemPrompt(): String {
        val now = SimpleDateFormat("EEEE, d. MMMM yyyy, HH:mm 'Uhr'", Locale.GERMANY).format(Date())
        return """
            Du bist Jarvis, der persönliche KI-Butler deines Nutzers – höflich, souverän, mit einem Hauch trockenem britischem Humor.
            Sprich den Nutzer immer mit "Sir" an und siez ihn. Antworte immer auf Deutsch.
            Deine Antworten werden laut vorgelesen: Sprich natürlich und knapp, meist ein bis vier Sätze.
            Verwende kein Markdown, keine Aufzählungszeichen, keine Tabellen, keine Links und keine Emojis.
            Schreibe Zahlen und Einheiten so, wie man sie spricht (zum Beispiel "zwölf Grad" statt "12°C").
            Wenn eine Frage aktuelle Informationen braucht (Wetter, Nachrichten, Öffnungszeiten, Preise, Sportergebnisse, Termine),
            nutze die Websuche. Nenne die Quelle nur kurz, wenn es hilft.
            Wenn der Nutzer sich auf frühere Gespräche bezieht ("weißt du noch", "was hatte ich dich gefragt"),
            nutze das Werkzeug search_conversations.
            Wenn du etwas nicht weißt, sag es ehrlich.
            Jetzt ist $now. Der Nutzer ist in Deutschland.
        """.trimIndent()
    }

    private val conversationTool = Tool.builder()
        .name("search_conversations")
        .description("Durchsucht die gespeicherten früheren Gespräche mit dem Nutzer nach Stichworten und gibt passende Ausschnitte mit Datum zurück.")
        .inputSchema(
            Tool.InputSchema.builder()
                .properties(
                    Tool.InputSchema.Properties.builder()
                        .putAdditionalProperty(
                            "query",
                            JsonValue.from(mapOf("type" to "string", "description" to "Stichworte, nach denen gesucht wird"))
                        )
                        .build()
                )
                .required(listOf("query"))
                .build()
        )
        .build()

    private val webSearch = WebSearchTool20260209.builder()
        .maxUses(4L)
        .userLocation(UserLocation.builder().country("DE").timezone("Europe/Berlin").build())
        .build()

    /** Beantwortet [question] im Kontext der bisherigen Runden [history] des laufenden Gesprächs. */
    fun ask(history: List<Turn>, question: String, conversationId: Long): String {
        if (store.apiKey.isBlank()) return "Sir, mir fehlt noch der API-Schlüssel. Bitte tragen Sie ihn in den Einstellungen ein."

        val messages = mutableListOf<MessageParam>()
        // Nur die letzten Runden mitschicken, damit es schnell und günstig bleibt
        history.takeLast(16).forEach {
            messages.add(
                if (it.role == "user") MessageParam.ofUser(it.text)
                else MessageParam.ofAssistant(it.text)
            )
        }
        // Die Liste muss mit einer Nutzer-Nachricht beginnen
        while (messages.isNotEmpty() && !messages.first().isUser()) messages.removeAt(0)
        messages.add(MessageParam.ofUser(question))

        return try {
            for (round in 0 until 6) {
                val params = MessageCreateParams.builder()
                    .model("claude-opus-5-5")
                    .maxTokens(4000L)
                    .system(systemPrompt())
                    .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.LOW).build())
                    .addTool(webSearch)
                    .addTool(conversationTool)
                    .messages(messages)
                    // Falls ein Sicherheitsfilter ablehnt, übernimmt automatisch ein anderes Modell
                    .putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                    .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
                    .build()

                val response = client().messages().create(params)
                val stop = response.stopReason().orElse(null)

                if (stop == StopReason.REFUSAL) {
                    return "Verzeihung, Sir, dabei kann ich Ihnen leider nicht helfen."
                }

                when (stop) {
                    StopReason.TOOL_USE -> {
                        messages.add(response.toParam())
                        val results = response.content().mapNotNull { block ->
                            block.toolUse().orElse(null)?.let { use ->
                                val input = use._input().convert(Map::class.java) as? Map<*, *>
                                val q = input?.get("query")?.toString().orEmpty()
                                ContentBlockParam.ofToolResult(
                                    ToolResultBlockParam.builder()
                                        .toolUseId(use.id())
                                        .content(store.search(q, conversationId))
                                        .build()
                                )
                            }
                        }
                        messages.add(MessageParam.ofUserOfContentBlockParams(results))
                    }
                    StopReason.PAUSE_TURN -> {
                        // Die Websuche läuft noch: Antwort zurückgeben und weitermachen lassen
                        messages.add(response.toParam())
                    }
                    else -> {
                        val text = response.content()
                            .mapNotNull { it.text().orElse(null)?.text() }
                            .joinToString(" ")
                            .trim()
                        return text.ifBlank { "Verzeihung, Sir, darauf habe ich gerade keine Antwort." }
                    }
                }
            }
            "Verzeihung, Sir, das hat zu lange gedauert. Fragen Sie mich bitte noch einmal."
        } catch (e: UnauthorizedException) {
            "Sir, der API-Schlüssel wird nicht akzeptiert. Bitte prüfen Sie ihn in den Einstellungen."
        } catch (e: PermissionDeniedException) {
            "Sir, Ihr API-Konto erlaubt diese Anfrage nicht. Bitte prüfen Sie Ihr Guthaben bei Anthropic."
        } catch (e: RateLimitException) {
            "Einen kleinen Moment, Sir, ich bekomme gerade zu viele Anfragen. Versuchen Sie es gleich noch einmal."
        } catch (e: OverloadedException) {
            "Die Server sind gerade überlastet, Sir. Versuchen Sie es bitte gleich noch einmal."
        } catch (e: AnthropicIoException) {
            "Sir, ich erreiche das Internet gerade nicht. Bitte prüfen Sie die WLAN-Verbindung."
        } catch (e: Exception) {
            val msg = e.message.orEmpty()
            if (msg.contains("credit", true) || msg.contains("balance", true))
                "Sir, Ihr API-Guthaben ist aufgebraucht. Bitte laden Sie es bei Anthropic auf."
            else "Verzeihung, Sir, da ist etwas schiefgelaufen: ${msg.take(160)}"
        }
    }
}
