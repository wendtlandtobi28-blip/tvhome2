# Hinweise für Claude

- Antworte auf Deutsch, einfach und ohne Fachjargon.
- **Jede App bekommt eine eingebaute Update-Funktion.** Die App prüft beim Start (und auf Knopfdruck in den
  Einstellungen) automatisch, ob es eine neuere Version gibt, lädt sie herunter und öffnet den Installer.
  Die Versionsnummer wird beim Bauen automatisch hochgezählt (GitHub-Laufnummer), und der Bau veröffentlicht
  neben der APK eine `version.json`. Vorbild: `Jarvis/app/src/main/java/de/tobi/jarvis/Updater.kt` und
  `.github/workflows/jarvis.yml`.
- Android-Apps werden über GitHub Actions gebaut und als Release veröffentlicht (in der Cloud-Umgebung ist
  das Android-SDK nicht erreichbar). Immer denselben Signaturschlüssel behalten, damit Updates sich über die
  alte Version installieren lassen.
