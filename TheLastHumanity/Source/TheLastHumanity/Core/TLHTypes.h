#pragma once

#include "CoreMinimal.h"
#include "TLHTypes.generated.h"

/** Ein interaktiver Informationspunkt (Inhalt kommt aus Content/Data/content_de.json). */
USTRUCT(BlueprintType)
struct FTLHInfoEntry
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FName Id;

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FText Title;

	/** Kurzfassung (2-3 Saetze). */
	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FText ShortText;

	/** Ausfuehrlicher Text. */
	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FText LongText;

	/** "fakt" = historisch belegt, "fiktion" = Rahmenhandlung des Spiels. */
	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FName Kind;

	/** true, wenn die JSON-Datei eine feste Position vorgibt; sonst automatische Anordnung. */
	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	bool bHasLocation = false;

	/** Position in der Halle (cm, Weltkoordinaten). */
	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FVector Location = FVector::ZeroVector;
};

/** Gestaltung einer Kapitelhalle. */
USTRUCT(BlueprintType)
struct FTLHChapterTheme
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FLinearColor Floor = FLinearColor(0.55f, 0.47f, 0.36f);

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FLinearColor Wall = FLinearColor(0.32f, 0.29f, 0.25f);

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FLinearColor Column = FLinearColor(0.16f, 0.15f, 0.13f);

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FLinearColor Torch = FLinearColor(1.0f, 0.55f, 0.25f);

	/** "rund" oder "eckig". */
	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FName ColumnShape = TEXT("rund");

	/** "feuer", "obelisk", "zikkurat", "kugel", "bogen", "turm" oder "keiner". */
	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FName Monument = TEXT("keiner");

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	float SunPitch = -38.f;

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	float SunIntensity = 7.f;

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	float FogDensity = 0.015f;
};

/** Ein Kapitel der Menschheitsgeschichte. */
USTRUCT(BlueprintType)
struct FTLHChapter
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FName Id;

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	int32 Number = 0;

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FText Title;

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FText Era;

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FText Summary;

	/** Inhalte vorhanden und spielbar? */
	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	bool bAvailable = false;

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FTLHChapterTheme Theme;

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	TArray<FTLHInfoEntry> InfoPoints;
};

/** Spieler-Einstellungen (eigener Speicherplatz, unabhaengig vom Spielstand). */
USTRUCT(BlueprintType)
struct FTLHSettings
{
	GENERATED_BODY()

	UPROPERTY()
	float MouseSensitivity = 2.5f;

	UPROPERTY()
	bool bInvertY = false;

	UPROPERTY()
	float FieldOfView = 90.f;

	UPROPERTY()
	bool bShowControlsHint = true;

	/** Alle Kapitel ohne Vorbedingung betretbar (z. B. zum Testen oder fuer den Unterricht). */
	UPROPERTY()
	bool bUnlockAllChapters = false;

	static constexpr float MinSensitivity = 0.5f;
	static constexpr float MaxSensitivity = 6.f;
	static constexpr float MinFov = 70.f;
	static constexpr float MaxFov = 110.f;
};
