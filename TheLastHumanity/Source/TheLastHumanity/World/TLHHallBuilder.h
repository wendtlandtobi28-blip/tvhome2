#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TLHHallBuilder.generated.h"

class UStaticMesh;
class UStaticMeshComponent;
class UMaterialInterface;
struct FTLHChapter;

/**
 * Erzeugt die erste begehbare Umgebung ("Halle der Urspruenge") zur Laufzeit
 * aus Engine-Grundformen. Platzhalter, bis echte Modelle/Level vorliegen.
 */
UCLASS()
class THELASTHUMANITY_API ATLHHallBuilder : public AActor
{
	GENERATED_BODY()

public:
	ATLHHallBuilder();

	/** Baut Halle, Licht und die Informationspunkte des Kapitels. */
	void BuildHall(const FTLHChapter* Chapter);

	static constexpr float HalfLength = 2000.f; // X
	static constexpr float HalfWidth = 900.f;   // Y
	static constexpr float WallHeight = 800.f;

private:
	UStaticMeshComponent* AddMesh(UStaticMesh* Mesh, const FVector& Location, const FVector& Scale,
		const FLinearColor& Color, const FRotator& Rotation = FRotator::ZeroRotator);
	void AddBox(const FVector& Center, const FVector& SizeCm, const FLinearColor& Color);
	void BuildLighting();

	UPROPERTY(VisibleAnywhere, Category = "TLH")
	TObjectPtr<USceneComponent> SceneRoot;

	UPROPERTY()
	TObjectPtr<UStaticMesh> CubeMesh;

	UPROPERTY()
	TObjectPtr<UStaticMesh> CylinderMesh;

	UPROPERTY()
	TObjectPtr<UMaterialInterface> BaseMaterial;
};
