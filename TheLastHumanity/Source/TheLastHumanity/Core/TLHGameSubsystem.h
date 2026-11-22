#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Core/TLHTypes.h"
#include "TLHGameSubsystem.generated.h"

/**
 * Zentrale Spiellogik ohne Darstellung:
 *  - laedt Kapitel, Informationspunkte, Abspann und UI-Texte aus Content/Data/content_de.json
 *  - verwaltet Fortschritt (entdeckte Informationspunkte, aktuelles Kapitel, Freischaltung)
 *  - speichert und laedt Spielstand und Einstellungen
 */
UCLASS()
class THELASTHUMANITY_API UTLHGameSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	static const FString SaveSlotName;
	static const FString SettingsSlotName;
	static const FString ContentFile;

	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	static UTLHGameSubsystem* Get(const UObject* WorldContext);

	// --- Inhalte ---
	bool IsContentLoaded() const { return bContentLoaded; }
	const TArray<FTLHChapter>& GetChapters() const { return Chapters; }
	const FTLHChapter* FindChapter(FName ChapterId) const;
	const FTLHChapter* GetFirstAvailableChapter() const;
	const FTLHChapter* GetNextChapter(const FTLHChapter& Chapter) const;
	const FTLHInfoEntry* FindInfo(FName InfoId, const FTLHChapter** OutChapter = nullptr) const;
	const FText& GetEndingTitle() const { return EndingTitle; }
	const FText& GetEndingText() const { return EndingText; }
	int32 GetTotalInfoCount() const;

	/** UI-Text aus dem Abschnitt "ui" der Inhaltsdatei; bei fehlendem Schluessel der Schluessel selbst. */
	FText UI(const TCHAR* Key) const;
	FText UIFormat(const TCHAR* Key, const FFormatOrderedArguments& Args) const;

	// --- Fortschritt ---
	bool IsDiscovered(FName InfoId) const { return Discovered.Contains(InfoId); }
	/** Gibt true zurueck, wenn der Punkt neu entdeckt wurde. */
	bool MarkDiscovered(FName InfoId);
	int32 CountDiscovered(const FTLHChapter& Chapter) const;
	int32 GetTotalDiscovered() const { return Discovered.Num(); }
	bool IsChapterComplete(const FTLHChapter& Chapter) const;
	/** Erstes Kapitel immer; sonst wenn das vorige abgeschlossen ist (oder "alle freischalten" aktiv). */
	bool IsChapterUnlocked(const FTLHChapter& Chapter) const;
	bool IsGameComplete() const;
	FName GetCurrentChapterId() const { return CurrentChapter; }
	const FTLHChapter* GetCurrentChapter() const;
	void SetCurrentChapter(FName ChapterId) { CurrentChapter = ChapterId; }
	bool HasSeenEnding() const { return bEndingSeen; }
	void SetEndingSeen() { bEndingSeen = true; }
	void ResetProgress();

	// --- Spielstand ---
	bool HasSaveGame() const;
	bool SaveGame(const FVector& PlayerLocation, const FRotator& PlayerRotation);
	bool LoadGame(FVector& OutLocation, FRotator& OutRotation);

	// --- Einstellungen ---
	const FTLHSettings& GetSettings() const { return Settings; }
	void SetSettings(const FTLHSettings& NewSettings);
	bool SaveSettings();

private:
	bool LoadContent();
	void LoadSettings();

	TArray<FTLHChapter> Chapters;
	TMap<FString, FText> UIStrings;
	FText EndingTitle;
	FText EndingText;
	TSet<FName> Discovered;
	FName CurrentChapter;
	FTLHSettings Settings;
	bool bEndingSeen = false;
	bool bContentLoaded = false;
};
