#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "TLHSaveGame.generated.h"

/** Spielstand. Wird unter Saved/SaveGames/<Slot>.sav abgelegt. */
UCLASS()
class THELASTHUMANITY_API UTLHSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	/** Erhoehen, wenn sich das Format aendert (Migration in UTLHGameSubsystem::LoadGame). */
	static constexpr int32 CurrentVersion = 1;

	UPROPERTY()
	int32 SaveVersion = CurrentVersion;

	UPROPERTY()
	FVector PlayerLocation = FVector::ZeroVector;

	UPROPERTY()
	FRotator PlayerRotation = FRotator::ZeroRotator;

	UPROPERTY()
	TArray<FName> DiscoveredInfoPoints;

	UPROPERTY()
	FName CurrentChapter;

	UPROPERTY()
	FDateTime SavedAt;
};
