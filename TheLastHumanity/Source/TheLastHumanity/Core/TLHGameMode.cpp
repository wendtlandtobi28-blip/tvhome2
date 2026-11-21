#include "Core/TLHGameMode.h"
#include "TheLastHumanity.h"
#include "Core/TLHCharacter.h"
#include "Core/TLHPlayerController.h"
#include "Core/TLHGameSubsystem.h"
#include "World/TLHHallBuilder.h"

#include "EngineUtils.h"
#include "Engine/World.h"

ATLHGameMode::ATLHGameMode()
{
	DefaultPawnClass = ATLHCharacter::StaticClass();
	PlayerControllerClass = ATLHPlayerController::StaticClass();
}

void ATLHGameMode::StartPlay()
{
	// Umgebung VOR Super::StartPlay aufbauen, damit Boden und Waende
	// existieren, bevor die Spielfigur zum ersten Mal tickt.
	UWorld* World = GetWorld();
	bool bHasBuilder = false;
	for (TActorIterator<ATLHHallBuilder> It(World); It; ++It)
	{
		bHasBuilder = true;
		break;
	}

	if (!bHasBuilder)
	{
		FActorSpawnParameters Params;
		Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		if (ATLHHallBuilder* Builder = World->SpawnActor<ATLHHallBuilder>(FVector::ZeroVector, FRotator::ZeroRotator, Params))
		{
			const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
			const FTLHChapter* Chapter = Sub ? Sub->GetFirstAvailableChapter() : nullptr;
			Builder->BuildHall(Chapter);
		}
	}
	else
	{
		UE_LOG(LogTLH, Log, TEXT("Hallen-Erzeuger bereits in der Karte vorhanden."));
	}

	Super::StartPlay();
}

APawn* ATLHGameMode::SpawnDefaultPawnAtTransform_Implementation(AController* NewPlayer, const FTransform& SpawnTransform)
{
	// Die Traegerkarte hat keinen PlayerStart: festen Startpunkt verwenden.
	const FTransform Start(GetStartRotation(), GetStartLocation());
	return Super::SpawnDefaultPawnAtTransform_Implementation(NewPlayer, Start);
}
