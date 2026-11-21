#pragma once

#include "CoreMinimal.h"
#include "TLHTypes.generated.h"

/** Ein interaktiver Informationspunkt (Inhalt kommt aus Content/Data/*.json). */
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

	/** Position in der Prototyp-Halle (cm, Weltkoordinaten). */
	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	FVector Location = FVector::ZeroVector;
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

	/** Im aktuellen Entwicklungsstand spielbar? */
	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	bool bAvailable = false;

	UPROPERTY(BlueprintReadOnly, Category = "TLH")
	TArray<FTLHInfoEntry> InfoPoints;
};
