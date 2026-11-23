package de.tobi.jarvis

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.Locale
import java.util.UUID
import kotlin.coroutines.resume

/** Ergebnis eines Zuhör-Versuchs. */
sealed class Heard {
    data class Words(val text: String) : Heard()
    /** Niemand hat etwas gesagt. */
    data object Silence : Heard()
    data class Failed(val code: Int) : Heard()
}

/** Spracherkennung über den eingebauten Android-Dienst (meist Google). Nur im Hauptthread benutzen. */
class Ears(private val context: Context) {
    private var recognizer: SpeechRecognizer? = null

    val available: Boolean get() = SpeechRecognizer.isRecognitionAvailable(context)

    suspend fun listen(onPartial: (String) -> Unit, onLevel: (Float) -> Unit, onReady: () -> Unit): Heard =
        suspendCancellableCoroutine { cont ->
            val rec = recognizer ?: SpeechRecognizer.createSpeechRecognizer(context).also { recognizer = it }
            var done = false
            fun finish(h: Heard) {
                if (done) return
                done = true
                if (cont.isActive) cont.resume(h)
            }
            rec.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) = onReady()
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) = onLevel(((rmsdB + 2f) / 12f).coerceIn(0f, 1f))
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onError(error: Int) {
                    when (error) {
                        SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> finish(Heard.Silence)
                        else -> finish(Heard.Failed(error))
                    }
                }
                override fun onResults(results: Bundle?) {
                    val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                    finish(if (text.isBlank()) Heard.Silence else Heard.Words(text))
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                        ?.takeIf { it.isNotBlank() }?.let(onPartial)
                }
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "de-DE")
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "de-DE")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
                putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
            }
            try {
                rec.startListening(intent)
            } catch (e: Exception) {
                finish(Heard.Failed(-1))
            }
            cont.invokeOnCancellation {
                try { rec.cancel() } catch (_: Exception) {}
            }
        }

    fun stop() {
        try { recognizer?.cancel() } catch (_: Exception) {}
    }

    fun destroy() {
        try { recognizer?.destroy() } catch (_: Exception) {}
        recognizer = null
    }
}

/** Sprachausgabe über die eingebaute Vorlesestimme des Tablets. */
class Mouth(context: Context) {
    private val ready = CompletableDeferred<Boolean>()
    private val pending = mutableMapOf<String, CompletableDeferred<Unit>>()

    private val tts: TextToSpeech = TextToSpeech(context.applicationContext) { status ->
        ready.complete(status == TextToSpeech.SUCCESS)
    }

    init {
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) { release(utteranceId) }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) { release(utteranceId) }
            override fun onError(utteranceId: String?, errorCode: Int) { release(utteranceId) }
            override fun onStop(utteranceId: String?, interrupted: Boolean) { release(utteranceId) }
        })
    }

    private fun release(id: String?) {
        synchronized(pending) { pending.remove(id) }?.complete(Unit)
    }

    /** Spricht [text] und kehrt zurück, wenn fertig gesprochen oder abgebrochen wurde. */
    suspend fun say(text: String) {
        if (!ready.await()) return
        tts.language = Locale.GERMANY
        tts.setPitch(0.92f)
        tts.setSpeechRate(1.02f)
        val clean = text.replace(Regex("[*_#`>|]"), " ").replace(Regex("\\s+"), " ").trim()
        if (clean.isEmpty()) return
        val chunks = clean.chunked(3500)
        for ((i, chunk) in chunks.withIndex()) {
            val id = UUID.randomUUID().toString()
            val done = CompletableDeferred<Unit>()
            synchronized(pending) { pending[id] = done }
            val mode = if (i == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
            if (tts.speak(chunk, mode, null, id) != TextToSpeech.SUCCESS) {
                release(id)
                return
            }
            done.await()
        }
    }

    fun stop() {
        tts.stop()
        val all = synchronized(pending) { pending.values.toList().also { pending.clear() } }
        all.forEach { it.complete(Unit) }
    }

    fun destroy() {
        stop()
        tts.shutdown()
    }
}
