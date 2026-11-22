#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TLHHallBuilder.generated.h"

class UStaticMesh;
class UStaticMeshComponent;
class UMaterialInterface;
class ATLHPortal;
struct FTLHChapter;
struct FTLHChapterTheme;

/**
 * Erzeugt die begehbare Halle eines Kapitels zur Laufzeit aus Engine-Grundformen:
 * Boden, Waende, Saeulen, Monument, Licht, Himmel, Informationspunkte und Portal.
 * BuildHall() kann beliebig oft aufgerufen werden (Kapitelwechsel).
 */
UCLASS()
class THELASTHUMANITY_API ATLHHallBuilder : public AActor
{
	GENERATED_BODY()

public:
	ATLHHallBuilder();

	/** Entfernt die bisherige Halle und baut die Halle des Kapitels neu auf. */
	void BuildHall(const FTLHChapter* Chapter);

	FName GetBuiltChapterId() const { return BuiltChapterId; }
	ATLHPortal* GetPortal() const { return Portal; }

	/** Automatische Position des Informationspunkts Index von Count (wenn die JSON-Datei keine vorgibt). */
	static FVector GetAutoLocation(int32 Index, int32 Count);

	static constexpr float HalfLength = 2000.f; // X
	static constexpr float HalfWidth = 900.f;   // Y
	static constexpr float WallHeight = 800.f;
	static constexpr float PortalX = 1800.f;

protected:
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	void ClearHall();
	UStaticMeshComponent* AddMesh(UStaticMesh* Mesh, const FVector& Location, const FVector& Scale,
		const FLinearColor& Color, bool bCollision = true);
	void AddBox(const FVector& Center, const FVector& SizeCm, const FLinearColor& Color, bool bCollision = true);
	void AddTorch(const FVector& Location, const FLinearColor& Color, float Intensity = 25.f);
	void BuildLighting(const FTLHChapterTheme& Theme);
	void BuildMonument(const FTLHChapterTheme& Theme);

	UPROPERTY(VisibleAnywhere, Category = "TLH")
	TObjectPtr<USceneComponent> SceneRoot;

	UPROPERTY()
	TObjectPtr<UStaticMesh> CubeMesh;

	UPROPERTY()
	TObjectPtr<UStaticMesh> CylinderMesh;

	UPROPERTY()
	TObjectPtr<UStaticMesh> SphereMesh;

	UPROPERTY()
	TObjectPtr<UMaterialInterface> BaseMaterial;

	UPROPERTY()
	TArray<TObjectPtr<UActorComponent>> BuiltComponents;

	UPROPERTY()
	TArray<TObjectPtr<AActor>> SpawnedActors;

	UPROPERTY()
	TObjectPtr<ATLHPortal> Portal;

	FName BuiltChapterId;
};
