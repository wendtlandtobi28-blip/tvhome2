#include "Core/TLHGameSubsystem.h"
#include "TheLastHumanity.h"
#include "Save/TLHSaveGame.h"

#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Engine/World.h"
#include "Engine/GameInstance.h"
#include "Kismet/GameplayStatics.h"

const FString UTLHGameSubsystem::SaveSlotName = TEXT("TLH_Spielstand_1");
const FString UTLHGameSubsystem::SettingsSlotName = TEXT("TLH_Einstellungen");
const FString UTLHGameSubsystem::ContentFile = TEXT("Data/content_de.json");

namespace
{
	FText JsonText(const TSharedPtr<FJsonObject>& Obj, const TCHAR* Field)
	{
		FString Value;
		Obj->TryGetStringField(Field, Value);
		return FText::FromString(Value);
	}

	void JsonColor(const TSharedPtr<FJsonObject>& Obj, const TCHAR* Field, FLinearColor& InOut)
	{
		const TArray<TSharedPtr<FJsonValue>>* Arr = nullptr;
		if (Obj->TryGetArrayField(Field, Arr) && Arr && Arr->Num() == 3)
		{
			InOut = FLinearColor((float)(*Arr)[0]->AsNumber(), (float)(*Arr)[1]->AsNumber(), (float)(*Arr)[2]->AsNumber());
		}
	}

	void JsonFloat(const TSharedPtr<FJsonObject>& Obj, const TCHAR* Field, float& InOut)
	{
		double Value = 0.0;
		if (Obj->TryGetNumberField(Field, Value))
		{
			InOut = (float)Value;
		}
	}

	void JsonName(const TSharedPtr<FJsonObject>& Obj, const TCHAR* Field, FName& InOut)
	{
		FString Value;
		if (Obj->TryGetStringField(Field, Value) && !Value.IsEmpty())
		{
			InOut = FName(*Value);
		}
	}
}

void UTLHGameSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	bContentLoaded = LoadContent();
	LoadSettings();
	ResetProgress();
}

UTLHGameSubsystem* UTLHGameSubsystem::Get(const UObject* WorldContext)
{
	if (!WorldContext)
	{
		return nullptr;
	}
	const UWorld* World = WorldContext->GetWorld();
	UGameInstance* GameInstance = World ? World->GetGameInstance() : nullptr;
	return GameInstance ? GameInstance->GetSubsystem<UTLHGameSubsystem>() : nullptr;
}

bool UTLHGameSubsystem::LoadContent()
{
	Chapters.Reset();
	UIStrings.Reset();

	const FString Path = FPaths::ProjectContentDir() / ContentFile;
	FString Json;
	if (!FFileHelper::LoadFileToString(Json, *Path))
	{
		UE_LOG(LogTLH, Error, TEXT("Inhaltsdatei nicht gefunden: %s"), *Path);
		return false;
	}

	TSharedPtr<FJsonObject> Root;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		UE_LOG(LogTLH, Error, TEXT("Inhaltsdatei ist kein gueltiges JSON: %s"), *Path);
		return false;
	}

	const TSharedPtr<FJsonObject>* UIObject = nullptr;
	if (Root->TryGetObjectField(TEXT("ui"), UIObject) && UIObject)
	{
		for (const TPair<FString, TSharedPtr<FJsonValue>>& Pair : (*UIObject)->Values)
		{
			UIStrings.Add(Pair.Key, FText::FromString(Pair.Value->AsString()));
		}
	}

	const TSharedPtr<FJsonObject>* EndingObject = nullptr;
	if (Root->TryGetObjectField(TEXT("ending"), EndingObject) && EndingObject)
	{
		EndingTitle = JsonText(*EndingObject, TEXT("title"));
		EndingText = JsonText(*EndingObject, TEXT("text"));
	}

	const TArray<TSharedPtr<FJsonValue>>* ChapterArray = nullptr;
	if (!Root->TryGetArrayField(TEXT("chapters"), ChapterArray) || !ChapterArray)
	{
		UE_LOG(LogTLH, Error, TEXT("Inhaltsdatei enthaelt kein Feld 'chapters'."));
		return false;
	}

	for (const TSharedPtr<FJsonValue>& ChapterValue : *ChapterArray)
	{
		const TSharedPtr<FJsonObject> C = ChapterValue->AsObject();
		if (!C.IsValid())
		{
			continue;
		}

		FTLHChapter Chapter;
		JsonName(C, TEXT("id"), Chapter.Id);
		C->TryGetNumberField(TEXT("number"), Chapter.Number);
		C->TryGetBoolField(TEXT("available"), Chapter.bAvailable);
		Chapter.Title = JsonText(C, TEXT("title"));
		Chapter.Era = JsonText(C, TEXT("era"));
		Chapter.Summary = JsonText(C, TEXT("summary"));

		const TSharedPtr<FJsonObject>* ThemeObject = nullptr;
		if (C->TryGetObjectField(TEXT("theme"), ThemeObject) && ThemeObject)
		{
			const TSharedPtr<FJsonObject>& Th = *ThemeObject;
			JsonColor(Th, TEXT("floor"), Chapter.Theme.Floor);
			JsonColor(Th, TEXT("wall"), Chapter.Theme.Wall);
			JsonColor(Th, TEXT("column"), Chapter.Theme.Column);
			JsonColor(Th, TEXT("torch"), Chapter.Theme.Torch);
			JsonName(Th, TEXT("columnShape"), Chapter.Theme.ColumnShape);
			JsonName(Th, TEXT("monument"), Chapter.Theme.Monument);
			JsonFloat(Th, TEXT("sunPitch"), Chapter.Theme.SunPitch);
			JsonFloat(Th, TEXT("sunIntensity"), Chapter.Theme.SunIntensity);
			JsonFloat(Th, TEXT("fog"), Chapter.Theme.FogDensity);
		}

		const TArray<TSharedPtr<FJsonValue>>* Points = nullptr;
		if (C->TryGetArrayField(TEXT("infoPoints"), Points) && Points)
		{
			for (const TSharedPtr<FJsonValue>& PointValue : *Points)
			{
				const TSharedPtr<FJsonObject> P = PointValue->AsObject();
				if (!P.IsValid())
				{
					continue;
				}
				FTLHInfoEntry Entry;
				Entry.Kind = TEXT("fakt");
				JsonName(P, TEXT("id"), Entry.Id);
				JsonName(P, TEXT("kind"), Entry.Kind);
				Entry.Title = JsonText(P, TEXT("title"));
				Entry.ShortText = JsonText(P, TEXT("short"));
				Entry.LongText = JsonText(P, TEXT("long"));

				const TArray<TSharedPtr<FJsonValue>>* Loc = nullptr;
				if (P->TryGetArrayField(TEXT("location"), Loc) && Loc && Loc->Num() == 3)
				{
					Entry.Location = FVector((*Loc)[0]->AsNumber(), (*Loc)[1]->AsNumber(), (*Loc)[2]->AsNumber());
					Entry.bHasLocation = true;
				}
				Chapter.InfoPoints.Add(MoveTemp(Entry));
			}
		}
		Chapters.Add(MoveTemp(Chapter));
	}

	UE_LOG(LogTLH, Log, TEXT("Inhalte geladen: %d Kapitel, %d Erkenntnisse, %d UI-Texte."),
		Chapters.Num(), GetTotalInfoCount(), UIStrings.Num());
	return Chapters.Num() > 0;
}

const FTLHChapter* UTLHGameSubsystem::FindChapter(FName ChapterId) const
{
	return Chapters.FindByPredicate([ChapterId](const FTLHChapter& C) { return C.Id == ChapterId; });
}

const FTLHChapter* UTLHGameSubsystem::GetFirstAvailableChapter() const
{
	return Chapters.FindByPredicate([](const FTLHChapter& C) { return C.bAvailable; });
}

const FTLHChapter* UTLHGameSubsystem::GetNextChapter(const FTLHChapter& Chapter) const
{
	for (int32 i = 0; i + 1 < Chapters.Num(); ++i)
	{
		if (Chapters[i].Id == Chapter.Id)
		{
			return &Chapters[i + 1];
		}
	}
	return nullptr;
}

const FTLHInfoEntry* UTLHGameSubsystem::FindInfo(FName InfoId, const FTLHChapter** OutChapter) const
{
	for (const FTLHChapter& Chapter : Chapters)
	{
		for (const FTLHInfoEntry& Entry : Chapter.InfoPoints)
		{
			if (Entry.Id == InfoId)
			{
				if (OutChapter)
				{
					*OutChapter = &Chapter;
				}
				return &Entry;
			}
		}
	}
	return nullptr;
}

int32 UTLHGameSubsystem::GetTotalInfoCount() const
{
	int32 Count = 0;
	for (const FTLHChapter& Chapter : Chapters)
	{
		Count += Chapter.InfoPoints.Num();
	}
	return Count;
}

FText UTLHGameSubsystem::UI(const TCHAR* Key) const
{
	if (const FText* Found = UIStrings.Find(FString(Key)))
	{
		return *Found;
	}
	return FText::FromString(Key);
}

FText UTLHGameSubsystem::UIFormat(const TCHAR* Key, const FFormatOrderedArguments& Args) const
{
	return FText::Format(FTextFormat(UI(Key)), Args);
}

bool UTLHGameSubsystem::MarkDiscovered(FName InfoId)
{
	bool bAlreadyInSet = false;
	Discovered.Add(InfoId, &bAlreadyInSet);
	return !bAlreadyInSet;
}

int32 UTLHGameSubsystem::CountDiscovered(const FTLHChapter& Chapter) const
{
	int32 Count = 0;
	for (const FTLHInfoEntry& Entry : Chapter.InfoPoints)
	{
		Count += Discovered.Contains(Entry.Id) ? 1 : 0;
	}
	return Count;
}

bool UTLHGameSubsystem::IsChapterComplete(const FTLHChapter& Chapter) const
{
	return Chapter.InfoPoints.Num() > 0 && CountDiscovered(Chapter) == Chapter.InfoPoints.Num();
}

bool UTLHGameSubsystem::IsChapterUnlocked(const FTLHChapter& Chapter) const
{
	if (!Chapter.bAvailable)
	{
		return false;
	}
	if (Settings.bUnlockAllChapters)
	{
		return true;
	}
	for (int32 i = 0; i < Chapters.Num(); ++i)
	{
		if (Chapters[i].Id == Chapter.Id)
		{
			return i == 0 || IsChapterComplete(Chapters[i - 1]);
		}
	}
	return false;
}

bool UTLHGameSubsystem::IsGameComplete() const
{
	for (const FTLHChapter& Chapter : Chapters)
	{
		if (Chapter.bAvailable && !IsChapterComplete(Chapter))
		{
			return false;
		}
	}
	return Chapters.Num() > 0;
}

const FTLHChapter* UTLHGameSubsystem::GetCurrentChapter() const
{
	const FTLHChapter* Chapter = FindChapter(CurrentChapter);
	return Chapter ? Chapter : GetFirstAvailableChapter();
}

void UTLHGameSubsystem::ResetProgress()
{
	Discovered.Reset();
	bEndingSeen = false;
	const FTLHChapter* First = GetFirstAvailableChapter();
	CurrentChapter = First ? First->Id : NAME_None;
}

bool UTLHGameSubsystem::HasSaveGame() const
{
	return UGameplayStatics::DoesSaveGameExist(SaveSlotName, 0);
}

bool UTLHGameSubsystem::SaveGame(const FVector& PlayerLocation, const FRotator& PlayerRotation)
{
	UTLHSaveGame* Save = Cast<UTLHSaveGame>(UGameplayStatics::CreateSaveGameObject(UTLHSaveGame::StaticClass()));
	if (!Save)
	{
		return false;
	}
	Save->SaveVersion = UTLHSaveGame::CurrentVersion;
	Save->PlayerLocation = PlayerLocation;
	Save->PlayerRotation = PlayerRotation;
	Save->DiscoveredInfoPoints = Discovered.Array();
	Save->CurrentChapter = CurrentChapter;
	Save->bEndingSeen = bEndingSeen;
	Save->SavedAt = FDateTime::Now();

	const bool bOk = UGameplayStatics::SaveGameToSlot(Save, SaveSlotName, 0);
	UE_LOG(LogTLH, Log, TEXT("Spielstand speichern: %s"), bOk ? TEXT("OK") : TEXT("FEHLER"));
	return bOk;
}

bool UTLHGameSubsystem::LoadGame(FVector& OutLocation, FRotator& OutRotation)
{
	UTLHSaveGame* Save = Cast<UTLHSaveGame>(UGameplayStatics::LoadGameFromSlot(SaveSlotName, 0));
	if (!Save)
	{
		UE_LOG(LogTLH, Warning, TEXT("Kein lesbarer Spielstand im Slot %s."), *SaveSlotName);
		return false;
	}
	if (Save->SaveVersion > UTLHSaveGame::CurrentVersion)
	{
		UE_LOG(LogTLH, Error, TEXT("Spielstand-Version %d ist neuer als dieses Spiel (%d)."),
			Save->SaveVersion, UTLHSaveGame::CurrentVersion);
		return false;
	}

	Discovered.Reset();
	for (const FName& Id : Save->DiscoveredInfoPoints)
	{
		// Nur IDs uebernehmen, die es in den aktuellen Inhalten noch gibt
		if (FindInfo(Id))
		{
			Discovered.Add(Id);
		}
	}
	const FTLHChapter* Saved = FindChapter(Save->CurrentChapter);
	CurrentChapter = (Saved && Saved->bAvailable) ? Saved->Id : (GetFirstAvailableChapter() ? GetFirstAvailableChapter()->Id : NAME_None);
	bEndingSeen = Save->SaveVersion >= 2 ? Save->bEndingSeen : false;
	OutLocation = Save->PlayerLocation;
	OutRotation = Save->PlayerRotation;
	return true;
}

void UTLHGameSubsystem::LoadSettings()
{
	if (UGameplayStatics::DoesSaveGameExist(SettingsSlotName, 0))
	{
		if (const UTLHSettingsSave* Save = Cast<UTLHSettingsSave>(UGameplayStatics::LoadGameFromSlot(SettingsSlotName, 0)))
		{
			SetSettings(Save->Settings);
		}
	}
}

void UTLHGameSubsystem::SetSettings(const FTLHSettings& NewSettings)
{
	Settings = NewSettings;
	Settings.MouseSensitivity = FMath::Clamp(Settings.MouseSensitivity, FTLHSettings::MinSensitivity, FTLHSettings::MaxSensitivity);
	Settings.FieldOfView = FMath::Clamp(Settings.FieldOfView, FTLHSettings::MinFov, FTLHSettings::MaxFov);
}

bool UTLHGameSubsystem::SaveSettings()
{
	UTLHSettingsSave* Save = Cast<UTLHSettingsSave>(UGameplayStatics::CreateSaveGameObject(UTLHSettingsSave::StaticClass()));
	if (!Save)
	{
		return false;
	}
	Save->Settings = Settings;
	return UGameplayStatics::SaveGameToSlot(Save, SettingsSlotName, 0);
}
