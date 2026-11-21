#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "TLHGameMode.generated.h"

UCLASS()
class THELASTHUMANITY_API ATLHGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ATLHGameMode();

	virtual void StartPlay() override;
	virtual APawn* SpawnDefaultPawnAtTransform_Implementation(AController* NewPlayer, const FTransform& SpawnTransform) override;

	/** Startpunkt in der Prototyp-Halle (Eingang, Blick in die Halle). */
	static FVector GetStartLocation() { return FVector(-1700.f, 0.f, 110.f); }
	static FRotator GetStartRotation() { return FRotator(0.f, 0.f, 0.f); }
};
