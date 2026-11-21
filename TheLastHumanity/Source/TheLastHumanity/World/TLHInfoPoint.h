#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TLHInfoPoint.generated.h"

class UStaticMeshComponent;
class UPointLightComponent;
class UTextRenderComponent;
class UMaterialInterface;
class UMaterialInstanceDynamic;

/** Interaktiver Informationspunkt: Sockel, schwebende Lichtkugel, Titel. */
UCLASS()
class THELASTHUMANITY_API ATLHInfoPoint : public AActor
{
	GENERATED_BODY()

public:
	ATLHInfoPoint();

	void Setup(FName InInfoId, const FText& InTitle);

	FName GetInfoId() const { return InfoId; }
	const FText& GetTitle() const { return Title; }
	FVector GetInteractionLocation() const;

	void SetDiscovered(bool bInDiscovered);
	void SetFocused(bool bInFocused);

	virtual void Tick(float DeltaSeconds) override;

protected:
	virtual void BeginPlay() override;

	UPROPERTY(VisibleAnywhere, Category = "TLH")
	TObjectPtr<USceneComponent> SceneRoot;

	UPROPERTY(VisibleAnywhere, Category = "TLH")
	TObjectPtr<UStaticMeshComponent> Pedestal;

	UPROPERTY(VisibleAnywhere, Category = "TLH")
	TObjectPtr<UStaticMeshComponent> Orb;

	UPROPERTY(VisibleAnywhere, Category = "TLH")
	TObjectPtr<UPointLightComponent> Light;

	UPROPERTY(VisibleAnywhere, Category = "TLH")
	TObjectPtr<UTextRenderComponent> Label;

	UPROPERTY()
	TObjectPtr<UMaterialInterface> BaseMaterial;

	UPROPERTY()
	TObjectPtr<UMaterialInstanceDynamic> OrbMaterial;

private:
	void UpdateVisuals();

	FName InfoId;
	FText Title;
	bool bDiscovered = false;
	bool bFocused = false;
	float Time = 0.f;

	static constexpr float OrbHeight = 135.f;
};
