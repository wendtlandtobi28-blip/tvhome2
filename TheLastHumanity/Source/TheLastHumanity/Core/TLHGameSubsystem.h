#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Core/TLHTypes.h"
#include "TLHGameSubsystem.generated.h"

/**
 * Zentrale Spiellogik ohne Darstellung:
 *  - laedt Kapitel, Informationspunkte und UI-Texte aus Content/Data/content_de.json
 *  - verwaltet den Fortschritt (entdeckte Informationspunkte)
 *  - speichert und laedt den Spielstand
 */
UCLASS()
class THELASTHUMANITY_API UTLHGameSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	static const FString SaveSlotName;
	static const FString ContentFile;

	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	static UTLHGameSubsystem* Get(const UObject* WorldContext);

	// --- Inhalte ---
	bool IsContentLoaded() const { return bContentLoaded; }
	const TArray<FTLHChapter>& GetChapters() const { return Chapters; }
	const FTLHChapter* FindChapter(FName ChapterId) const;
	const FTLHChapter* GetFirstAvailableChapter() const;
	const FTLHInfoEntry* FindInfo(FName InfoId, const FTLHChapter** OutChapter = nullptr) const;

	/** UI-Text aus dem Abschnitt "ui" der Inhaltsdatei; bei fehlendem Schluessel der Schluessel selbst. */
	FText UI(const TCHAR* Key) const;
	FText UIFormat(const TCHAR* Key, const FFormatOrderedArguments& Args) const;

	// --- Fortschritt ---
	bool IsDiscovered(FName InfoId) const { return Discovered.Contains(InfoId); }
	/** Gibt true zurueck, wenn der Punkt neu entdeckt wurde. */
	bool MarkDiscovered(FName InfoId);
	int32 CountDiscovered(const FTLHChapter& Chapter) const;
	void ResetProgress();

	// --- Speichern ---
	bool HasSaveGame() const;
	bool SaveGame(const FVector& PlayerLocation, const FRotator& PlayerRotation);
	bool LoadGame(FVector& OutLocation, FRotator& OutRotation);

private:
	bool LoadContent();

	TArray<FTLHChapter> Chapters;
	TMap<FString, FText> UIStrings;
	TSet<FName> Discovered;
	FName CurrentChapter;
	bool bContentLoaded = false;
};
