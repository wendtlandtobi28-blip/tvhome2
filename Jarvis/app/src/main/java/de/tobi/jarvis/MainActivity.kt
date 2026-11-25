package de.tobi.jarvis

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.SpeechRecognizer
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private const val GREETING = "Ja, Sir, wie kann ich Ihnen heute weiterhelfen?"
private val Muted = Color(0xFFB892AA)
private val Fg = Color(0xFFF6E9F2)

private sealed class Screen {
    data object Main : Screen()
    data object Setup : Screen()
    data object History : Screen()
    data class Detail(val conv: Conversation) : Screen()
}

class MainActivity : ComponentActivity() {
    private lateinit var store: Store
    private lateinit var brain: Brain
    private lateinit var tools: Tools
    private lateinit var ears: Ears
    private lateinit var mouth: Mouth
    private lateinit var updater: Updater

    private var update by mutableStateOf<UpdateInfo?>(null)
    private var updateProgress by mutableStateOf<Float?>(null)
    private var updateNote by mutableStateOf("")
    private var installAfterPermission = false

    private var mood by mutableStateOf(Mood.Idle)
    private var level by mutableFloatStateOf(0f)
    private var heard by mutableStateOf("")
    private var reply by mutableStateOf(GREETING)
    private var hint by mutableStateOf("")
    private var screen by mutableStateOf<Screen>(Screen.Main)

    private var conv = Conversation(System.currentTimeMillis(), System.currentTimeMillis(), mutableListOf())
    private var loop: Job? = null
    private var greeted = false
    private var asleep = false

    private val askMic = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        if (result[Manifest.permission.RECORD_AUDIO] == true) startLoop() else {
            mood = Mood.Sleeping
            hint = "Ohne Mikrofon kann ich Sie nicht hören, Sir. Erlauben Sie es bitte in den App-Einstellungen."
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        store = Store(this)
        tools = Tools(this, store)
        tools.onStatus = { text -> runOnUiThread { hint = text } }
        brain = Brain(store, tools)
        // Gemini schon im Hintergrund vorbereiten, damit die erste Antwort schneller kommt
        lifecycleScope.launch(Dispatchers.IO) { brain.warmUp() }
        ears = Ears(this)
        mouth = Mouth(this, store)
        updater = Updater(this)
        if (!store.hasAnyKey) screen = Screen.Setup
        checkForUpdate(silent = true)

        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Pink, background = Bg, surface = Bg)) {
                Box(Modifier.fillMaxSize().background(Bg)) {
                    when (val s = screen) {
                        Screen.Main -> MainScreen()
                        Screen.Setup -> SetupScreen()
                        Screen.History -> HistoryScreen()
                        is Screen.Detail -> DetailScreen(s.conv)
                    }
                    UpdateDialog()
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (installAfterPermission && updater.mayInstall()) {
            installAfterPermission = false
            update?.let { startUpdate(it) }
        }
        if (screen == Screen.Main && !asleep) begin()
    }

    override fun onPause() {
        super.onPause()
        halt()
        saveConversation()
    }

    override fun onDestroy() {
        super.onDestroy()
        ears.destroy()
        mouth.destroy()
    }

    // ---------------- Gesprächsschleife ----------------

    private fun begin() {
        if (!store.hasAnyKey) { screen = Screen.Setup; return }
        val micMissing = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED
        val calendarMissing = ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_CALENDAR) != PackageManager.PERMISSION_GRANTED
        // Den Kalender nur einmal von selbst erfragen, danach nur noch das Mikrofon
        val askCalendar = calendarMissing && !store.askedCalendar
        if (micMissing || askCalendar) {
            store.askedCalendar = true
            askMic.launch(
                arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR)
            )
        } else startLoop()
    }

    private fun halt() {
        loop?.cancel()
        loop = null
        ears.stop()
        mouth.stop()
        level = 0f
        if (mood != Mood.Sleeping) mood = Mood.Idle
    }

    private fun startLoop(wakeWords: String? = null) {
        loop?.cancel()
        asleep = false
        hint = ""
        loop = lifecycleScope.launch {
            if (!greeted) {
                greeted = true
                speak(GREETING)
            } else if (wakeWords != null) {
                speak(wakeWords)
            }
            if (!ears.available) {
                mood = Mood.Sleeping
                hint = "Auf diesem Tablet ist keine Spracherkennung eingerichtet. Installieren oder aktivieren Sie bitte die Google-App."
                return@launch
            }
            var silence = 0
            var failures = 0
            while (isActive) {
                mood = Mood.Listening
                heard = ""
                val result = ears.listen(
                    onPartial = { heard = it },
                    onLevel = { level = it },
                    onReady = { hint = "" }
                )
                level = 0f
                when (result) {
                    is Heard.Words -> {
                        silence = 0; failures = 0
                        heard = result.text
                        if (isGoodbye(result.text)) {
                            speak("Sehr wohl, Sir. Tippen Sie einfach auf mich, wenn Sie mich wieder brauchen.")
                            sleep()
                            return@launch
                        }
                        answer(result.text)
                    }
                    Heard.Silence -> {
                        silence++
                        // Nach etwa zwei Minuten Stille in den Ruhemodus, damit der Akku geschont wird
                        if (silence >= 12) { sleep(); return@launch }
                    }
                    is Heard.Failed -> {
                        failures++
                        if (result.code == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                            sleep("Ich darf das Mikrofon nicht benutzen, Sir. Bitte erlauben Sie es in den App-Einstellungen.")
                            return@launch
                        }
                        if (result.code == SpeechRecognizer.ERROR_NETWORK || result.code == SpeechRecognizer.ERROR_NETWORK_TIMEOUT) {
                            hint = "Keine Internetverbindung für die Spracherkennung."
                        }
                        if (failures >= 6) {
                            sleep("Die Spracherkennung macht gerade Probleme. Tippen Sie auf den Kern, um es erneut zu versuchen.")
                            return@launch
                        }
                        ears.destroy()
                        delay(700)
                    }
                }
            }
        }
    }

    private fun sleep(message: String = "Ruhemodus – tippen Sie auf den Kern, um mit mir zu sprechen.") {
        asleep = true
        mood = Mood.Sleeping
        level = 0f
        hint = message
    }

    private fun isGoodbye(text: String): Boolean {
        val t = text.lowercase(Locale.GERMANY).trim()
        val phrases = listOf("das wäre alles", "das ist alles", "danke jarvis das", "gute nacht", "schlaf jetzt", "ruhemodus", "sei still", "stopp jarvis", "tschüss")
        return phrases.any { t.contains(it) } || t == "stopp" || t == "danke das wars" || t == "danke, das war's"
    }

    private suspend fun answer(question: String) {
        mood = Mood.Thinking
        reply = "…"
        hint = ""
        val history = conv.turns.toList()
        // Dauert es länger, sagt Jarvis kurz Bescheid, damit man nicht im Ungewissen wartet
        val filler = lifecycleScope.launch {
            delay(4000)
            if (mood == Mood.Thinking) mouth.say("Einen Moment, Sir.")
        }
        val text = withContext(Dispatchers.IO) {
            tools.quickAnswer(question) ?: run {
                tools.status("Denke nach …")
                brain.ask(history, question, conv.id)
            }
        }
        filler.cancel()
        hint = ""
        val now = System.currentTimeMillis()
        conv.turns.add(Turn("user", question, now))
        conv.turns.add(Turn("assistant", text, now))
        saveConversation()
        reply = text
        speak(text)
    }

    private suspend fun speak(text: String) {
        mood = Mood.Speaking
        reply = text
        mouth.say(text)
        mood = Mood.Idle
    }

    private fun saveConversation() {
        val snapshot = Conversation(conv.id, conv.started, conv.turns.toMutableList())
        lifecycleScope.launch(Dispatchers.IO) { store.save(snapshot) }
    }

    private fun tapCore() {
        when (mood) {
            Mood.Speaking -> mouth.stop() // unterbrechen, danach hört er wieder zu
            Mood.Sleeping, Mood.Idle -> if (loop?.isActive != true) {
                if (!greeted) begin() else {
                    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
                        startLoop("Ja, Sir?") else begin()
                }
            }
            else -> {}
        }
    }

    // ---------------- Oberflächen ----------------

    @Composable
    private fun MainScreen() {
        var clock by remember { mutableStateOf("") }
        LaunchedEffect(Unit) {
            val f = SimpleDateFormat("HH:mm", Locale.GERMANY)
            while (true) { clock = f.format(Date()); delay(10_000) }
        }
        Column(
            Modifier.fillMaxSize().safeDrawingPadding().padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).background(if (mood == Mood.Sleeping) Muted else Pink, RoundedCornerShape(50)))
                Spacer(Modifier.size(8.dp))
                Text(
                    if (mood == Mood.Sleeping) "JARVIS · RUHEMODUS" else "JARVIS · ONLINE",
                    color = Muted, fontSize = 13.sp, letterSpacing = 3.sp
                )
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { halt(); asleep = true; mood = Mood.Sleeping; screen = Screen.History }) {
                    Text("Verlauf", color = PinkSoft)
                }
                TextButton(onClick = { halt(); asleep = true; mood = Mood.Sleeping; screen = Screen.Setup }) {
                    Text("Einstellungen", color = PinkSoft)
                }
                Spacer(Modifier.size(8.dp))
                Text(clock, color = Muted, fontSize = 15.sp)
            }

            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Orb(
                    mood, level,
                    Modifier.fillMaxSize(0.92f).aspectRatio(1f)
                        .clickable(remember { MutableInteractionSource() }, indication = null) { tapCore() }
                )
            }

            Text(
                when (mood) {
                    Mood.Idle -> "BEREIT"
                    Mood.Listening -> "ICH HÖRE ZU …"
                    Mood.Thinking -> "EINEN MOMENT, SIR …"
                    Mood.Speaking -> "SPRECHE  ·  TIPPEN ZUM UNTERBRECHEN"
                    Mood.Sleeping -> "TIPPEN ZUM AUFWECKEN"
                },
                color = PinkSoft, fontSize = 13.sp, letterSpacing = 3.sp
            )
            Spacer(Modifier.height(10.dp))
            if (heard.isNotBlank()) {
                Text("„$heard“", color = Muted, fontSize = 16.sp, textAlign = TextAlign.Center)
                Spacer(Modifier.height(8.dp))
            }
            Box(Modifier.widthIn(max = 760.dp).heightIn(max = 200.dp).verticalScroll(rememberScrollState())) {
                Text(
                    reply, color = Fg, fontSize = 22.sp, lineHeight = 30.sp,
                    fontWeight = FontWeight.Medium, textAlign = TextAlign.Center
                )
            }
            if (hint.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(hint, color = Muted, fontSize = 14.sp, textAlign = TextAlign.Center)
            }
            Spacer(Modifier.height(12.dp))
        }
    }

    @Composable
    private fun SetupScreen() {
        var gKey by remember { mutableStateOf(store.geminiKey) }
        var cKey by remember { mutableStateOf(store.apiKey) }
        var city by remember { mutableStateOf(store.homeCity) }
        val canLeave = store.hasAnyKey
        BackHandler(enabled = canLeave) { backToMain() }
        val gClean = cleanGeminiKey(gKey)
        val cClean = cleanClaudeKey(cKey)
        val ok = gClean.isNotEmpty() || cClean.isNotEmpty()
        var testResult by remember { mutableStateOf("") }
        Column(
            Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Box(Modifier.size(140.dp)) { Orb(Mood.Idle, 0f, Modifier.fillMaxSize()) }
            Text(if (canLeave) "Einstellungen" else "Einrichtung", color = Fg, fontSize = 28.sp, fontWeight = FontWeight.SemiBold)

            Text(
                "Ich denke kostenlos mit Google Gemini. Claude ist nur eine freiwillige Reserve.",
                color = Muted, fontSize = 15.sp, textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 620.dp)
            )

            KeyField(
                "Gemini-Schlüssel (kostenlos)", gKey, { gKey = it },
                "Kostenlos auf aistudio.google.com: mit dem Google-Konto anmelden, „Get API key“ und dann „Create API key“ tippen, " +
                    "nur den Schlüssel selbst kopieren (beginnt mit „AIza“) und hier einfügen. Keine Kreditkarte nötig.",
                when {
                    gKey.isBlank() -> null
                    gClean.isNotEmpty() -> "✓ Schlüssel erkannt: ${gClean.take(8)}…"
                    else -> "✗ Darin ist kein gültiger Schlüssel. Bitte nur den Schlüssel kopieren, nicht den Beispielcode."
                }
            )
            KeyField(
                "Claude-Schlüssel (optional, Reserve)", cKey, { cKey = it },
                "Nicht nötig – am besten leer lassen. Nur wer Guthaben bei Anthropic hat: Claude springt dann ein, wenn Google gerade kein Gratis-Kontingent hat.",
                when {
                    cKey.isBlank() -> null
                    cClean.isNotEmpty() -> "✓ Schlüssel erkannt: ${cClean.take(10)}…"
                    else -> "✗ Darin ist kein gültiger Claude-Schlüssel (beginnt mit „sk-ant-“)."
                }
            )
            OutlinedTextField(
                value = city, onValueChange = { city = it },
                label = { Text("Wohnort (für das Wetter)") }, singleLine = true,
                colors = fieldColors(), modifier = Modifier.widthIn(max = 620.dp).fillMaxWidth()
            )
            Text(
                "Die Schlüssel bleiben nur auf diesem Tablet gespeichert. Wetter, Nachrichten und Wikipedia nutze ich über kostenlose Dienste.",
                color = Muted, fontSize = 14.sp, textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 620.dp)
            )
            Button(
                onClick = {
                    store.provider = "gemini"; store.geminiKey = gKey; store.apiKey = cKey; store.homeCity = city
                    backToMain()
                },
                enabled = ok,
                colors = ButtonDefaults.buttonColors(containerColor = Pink, contentColor = Bg)
            ) { Text("Speichern und starten") }
            if (gClean.isNotEmpty() && canLeave) ModelSettings()
            if (gClean.isNotEmpty()) {
                Button(
                    onClick = {
                        store.geminiKey = gKey
                        testResult = "Teste die Verbindung zu Google …"
                        lifecycleScope.launch {
                            testResult = withContext(Dispatchers.IO) { brain.test() }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Pink.copy(alpha = 0.2f), contentColor = PinkSoft)
                ) { Text("Verbindung testen") }
                if (testResult.isNotBlank()) {
                    Text(
                        testResult, fontSize = 15.sp, textAlign = TextAlign.Center,
                        color = if (testResult.startsWith("✓")) PinkSoft else if (testResult.startsWith("✗")) Color(0xFFFF8A80) else Muted,
                        modifier = Modifier.widthIn(max = 620.dp)
                    )
                }
            }
            if (canLeave) {
                HorizontalDivider(Modifier.widthIn(max = 620.dp), color = Pink.copy(alpha = 0.25f))
                VoiceSettings()
                HorizontalDivider(Modifier.widthIn(max = 620.dp), color = Pink.copy(alpha = 0.25f))
                UpdateSettings()
                TextButton(onClick = { backToMain() }) { Text("Zurück ohne Speichern", color = PinkSoft) }
            }
        }
    }

    @Composable
    private fun ModelSettings() {
        var models by remember { mutableStateOf(emptyList<String>()) }
        var chosen by remember { mutableStateOf(store.chosenModel) }
        LaunchedEffect(Unit) { models = withContext(Dispatchers.IO) { brain.models() } }
        Column(Modifier.widthIn(max = 620.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Gemini-Modell", color = Fg, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "Die älteren „flash“-Modelle sind kostenlos und schnell. Ganz neue Modelle sind oft nicht im Gratis-Tarif.",
                color = Muted, fontSize = 14.sp
            )
            VoiceRow("Automatisch (älteres Gratis-Modell, empfohlen)", chosen.isBlank()) { chosen = ""; store.chosenModel = "" }
            if (models.isEmpty()) Text("Lade verfügbare Modelle …", color = Muted, fontSize = 14.sp)
            models.forEach { m ->
                VoiceRow(m, chosen == m) { chosen = m; store.chosenModel = m; store.blockModel(m, 0L) }
            }
        }
    }

    @Composable
    private fun fieldColors() = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = Pink, unfocusedBorderColor = Pink.copy(alpha = 0.4f),
        focusedTextColor = Fg, unfocusedTextColor = Fg, cursorColor = Pink, focusedLabelColor = PinkSoft
    )

    @Composable
    private fun KeyField(label: String, value: String, onChange: (String) -> Unit, help: String, status: String?) {
        Column(Modifier.widthIn(max = 620.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            OutlinedTextField(
                value = value, onValueChange = { onChange(it.trim()) },
                label = { Text(label) }, singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                colors = fieldColors(), modifier = Modifier.fillMaxWidth()
            )
            if (status != null) {
                Text(status, color = if (status.startsWith("✓")) PinkSoft else Color(0xFFFF8A80), fontSize = 14.sp)
            }
            Text(help, color = Muted, fontSize = 13.sp)
        }
    }

    @Composable
    private fun HistoryScreen() {
        var list by remember { mutableStateOf(emptyList<Conversation>()) }
        var confirm by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) { list = withContext(Dispatchers.IO) { store.all() }.sortedByDescending { it.started } }
        BackHandler { backToMain() }
        val df = remember { SimpleDateFormat("EEEE, d. MMMM yyyy · HH:mm", Locale.GERMANY) }
        Column(Modifier.fillMaxSize().safeDrawingPadding().padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = { backToMain() }) { Text("‹ Zurück", color = PinkSoft) }
                Spacer(Modifier.weight(1f))
                Text("Gespräche", color = Fg, fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { confirm = true }, enabled = list.isNotEmpty()) { Text("Alle löschen", color = Muted) }
            }
            Spacer(Modifier.height(12.dp))
            if (list.isEmpty()) {
                Text(
                    "Noch keine gespeicherten Gespräche. Sobald Sie mit mir sprechen, erscheinen sie hier.",
                    color = Muted, fontSize = 16.sp, modifier = Modifier.padding(16.dp)
                )
            }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(list, key = { it.id }) { c ->
                    Column(
                        Modifier.fillMaxWidth()
                            .border(1.dp, Pink.copy(alpha = 0.28f), RoundedCornerShape(14.dp))
                            .clickable { screen = Screen.Detail(c) }
                            .padding(16.dp)
                    ) {
                        Text(df.format(Date(c.started)), color = Muted, fontSize = 13.sp)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            c.turns.firstOrNull { it.role == "user" }?.text ?: "",
                            color = Fg, fontSize = 17.sp, maxLines = 2
                        )
                        Text("${c.turns.size / 2} Fragen", color = PinkSoft, fontSize = 13.sp)
                    }
                }
            }
        }
        if (confirm) {
            AlertDialog(
                onDismissRequest = { confirm = false },
                title = { Text("Alle Gespräche löschen?") },
                text = { Text("Das lässt sich nicht rückgängig machen.") },
                confirmButton = {
                    TextButton(onClick = {
                        store.deleteAll(); conv.turns.clear(); list = emptyList(); confirm = false
                    }) { Text("Löschen", color = Pink) }
                },
                dismissButton = { TextButton(onClick = { confirm = false }) { Text("Abbrechen") } }
            )
        }
    }

    @Composable
    private fun DetailScreen(c: Conversation) {
        BackHandler { screen = Screen.History }
        val tf = remember { SimpleDateFormat("HH:mm", Locale.GERMANY) }
        Column(Modifier.fillMaxSize().safeDrawingPadding().padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = { screen = Screen.History }) { Text("‹ Gespräche", color = PinkSoft) }
                Spacer(Modifier.weight(1f))
                TextButton(onClick = {
                    store.delete(c.id)
                    if (c.id == conv.id) conv.turns.clear()
                    screen = Screen.History
                }) { Text("Löschen", color = Muted) }
            }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(c.turns) { t ->
                    val mine = t.role == "user"
                    Column(Modifier.fillMaxWidth(), horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
                        Text(
                            (if (mine) "Sie" else "Jarvis") + " · " + tf.format(Date(t.time)),
                            color = Muted, fontSize = 12.sp
                        )
                        Text(
                            t.text, color = Fg, fontSize = 17.sp,
                            modifier = Modifier.widthIn(max = 620.dp)
                                .background(if (mine) Pink.copy(alpha = 0.16f) else Color(0x14FFFFFF), RoundedCornerShape(14.dp))
                                .padding(12.dp)
                        )
                    }
                }
            }
        }
    }

    @Composable
    private fun VoiceSettings() {
        var options by remember { mutableStateOf(emptyList<VoiceOption>()) }
        var chosen by remember { mutableStateOf(store.voice) }
        var rate by remember { mutableFloatStateOf(store.speechRate) }
        LaunchedEffect(Unit) { options = mouth.options() }
        val sample = "Guten Tag, Sir. So klinge ich mit dieser Stimme. Wie kann ich Ihnen heute weiterhelfen?"
        Column(Modifier.widthIn(max = 620.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Stimme", color = Fg, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "Die Online-Stimmen klingen am natürlichsten. Fehlen Stimmen, installieren Sie in den Android-Einstellungen unter " +
                    "„Sprachausgabe“ die Google-Sprachausgabe und dort die deutschen Sprachdaten.",
                color = Muted, fontSize = 14.sp
            )
            val auto = chosen.isBlank()
            VoiceRow("Automatisch (natürlichste Stimme)", auto) {
                chosen = ""; store.voice = ""
                lifecycleScope.launch { mouth.say(sample) }
            }
            options.forEach { o ->
                VoiceRow(o.label, chosen == o.name) {
                    chosen = o.name; store.voice = o.name
                    lifecycleScope.launch { mouth.say(sample) }
                }
            }
            if (options.isEmpty()) Text("Keine deutschen Stimmen gefunden.", color = Muted, fontSize = 14.sp)
            Text("Sprechtempo: ${"%.0f".format(rate * 100)} %", color = Muted, fontSize = 14.sp)
            Slider(
                value = rate, onValueChange = { rate = it }, valueRange = 0.8f..1.25f,
                onValueChangeFinished = { store.speechRate = rate; lifecycleScope.launch { mouth.say(sample) } },
                colors = SliderDefaults.colors(thumbColor = Pink, activeTrackColor = Pink)
            )
        }
    }

    @Composable
    private fun VoiceRow(label: String, selected: Boolean, onClick: () -> Unit) {
        Row(
            Modifier.fillMaxWidth()
                .border(1.dp, if (selected) Pink else Pink.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
                .background(if (selected) Pink.copy(alpha = 0.14f) else Color.Transparent, RoundedCornerShape(12.dp))
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(label, color = Fg, fontSize = 16.sp, modifier = Modifier.weight(1f))
            Text(if (selected) "● gewählt" else "Probehören", color = PinkSoft, fontSize = 13.sp)
        }
    }

    @Composable
    private fun UpdateSettings() {
        Column(Modifier.widthIn(max = 620.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Updates", color = Fg, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "Installiert: Version ${updater.installedName}. Jarvis sucht bei jedem Start automatisch nach einer neuen Version.",
                color = Muted, fontSize = 14.sp
            )
            Button(
                onClick = { checkForUpdate(silent = false) },
                colors = ButtonDefaults.buttonColors(containerColor = Pink.copy(alpha = 0.2f), contentColor = PinkSoft)
            ) { Text("Jetzt nach Updates suchen") }
            if (updateNote.isNotBlank()) Text(updateNote, color = Muted, fontSize = 14.sp)
        }
    }

    @Composable
    private fun UpdateDialog() {
        val info = update ?: return
        val progress = updateProgress
        AlertDialog(
            onDismissRequest = { if (progress == null) update = null },
            title = { Text("Neue Version ${info.versionName}") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Sir, es gibt eine neue Version von Jarvis. Ihre Gespräche und Einstellungen bleiben erhalten.")
                    if (progress != null) {
                        LinearProgressIndicator(progress = { progress }, color = Pink, modifier = Modifier.fillMaxWidth())
                        Text("Wird heruntergeladen … ${(progress * 100).toInt()} %", color = Muted, fontSize = 13.sp)
                    }
                    if (updateNote.isNotBlank()) Text(updateNote, color = Muted, fontSize = 13.sp)
                }
            },
            confirmButton = {
                TextButton(enabled = progress == null, onClick = { startUpdate(info) }) { Text("Jetzt aktualisieren", color = Pink) }
            },
            dismissButton = {
                TextButton(enabled = progress == null, onClick = { update = null }) { Text("Später") }
            }
        )
    }

    private fun checkForUpdate(silent: Boolean) {
        if (!silent) updateNote = "Suche nach Updates …"
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) { runCatching { updater.check() } }
            result.onSuccess { info ->
                if (info != null) { updateNote = ""; update = info }
                else if (!silent) updateNote = "Jarvis ist auf dem neuesten Stand."
            }.onFailure {
                if (!silent) updateNote = "Update-Suche fehlgeschlagen: ${it.message ?: "keine Verbindung"}"
            }
        }
    }

    private fun startUpdate(info: UpdateInfo) {
        if (!updater.mayInstall()) {
            // Android verlangt einmalig die Freigabe "Apps aus dieser Quelle installieren"
            installAfterPermission = true
            updateNote = "Bitte erlauben Sie Jarvis im nächsten Fenster, Updates zu installieren, und kommen Sie dann zurück."
            updater.openInstallPermission()
            return
        }
        updateNote = ""
        updateProgress = 0f
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching { updater.download(info) { p -> lifecycleScope.launch { updateProgress = p } } }
            }
            updateProgress = null
            result.onSuccess { apk ->
                saveConversation()
                updater.install(apk)
            }.onFailure {
                updateNote = "Download fehlgeschlagen: ${it.message ?: "keine Verbindung"}. Bitte später erneut versuchen."
            }
        }
    }

    private fun backToMain() {
        screen = Screen.Main
        asleep = false
        begin()
    }
}
