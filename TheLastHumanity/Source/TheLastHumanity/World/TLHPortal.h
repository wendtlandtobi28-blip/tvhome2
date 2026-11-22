#pragma once

#include "CoreMinimal.h"
#include "World/TLHInteractable.h"
#include "TLHPortal.generated.h"

class UStaticMeshComponent;
class UPointLightComponent;
class UTextRenderComponent;
class UMaterialInterface;
class UMaterialInstanceDynamic;

/**
 * Tor am Ende jeder Halle. Fuehrt zum naechsten Kapitel bzw. im letzten
 * Kapitel zum Abspann. Gesperrt (rot, dunkel), bis alle Erkenntnisse der
 * Halle gefunden sind.
 */
UCLASS()
class THELASTHUMANITY_API ATLHPortal : public ATLHInteractable
{
	GENERATED_BODY()

public:
	ATLHPortal();

	void SetOpen(bool bInOpen);
	bool IsOpen() const { return bOpen; }
	void SetLabel(const FText& Text);

	virtual FVector GetInteractionLocation() const override;
	virtual void SetFocused(bool bInFocused) override;
	virtual void Tick(float DeltaSeconds) override;

protected:
	virtual void BeginPlay() override;

	UPROPERTY(VisibleAnywhere, Category = "TLH")
	TObjectPtr<USceneComponent> SceneRoot;

	UPROPERTY(VisibleAnywhere, Category = "TLH")
	TObjectPtr<UStaticMeshComponent> PillarLeft;

	UPROPERTY(VisibleAnywhere, Category = "TLH")
	TObjectPtr<UStaticMeshComponent> PillarRight;

	UPROPERTY(VisibleAnywhere, Category = "TLH")
	TObjectPtr<UStaticMeshComponent> Lintel;

	UPROPERTY(VisibleAnywhere, Category = "TLH")
	TObjectPtr<UStaticMeshComponent> Veil;

	UPROPERTY(VisibleAnywhere, Category = "TLH")
	TObjectPtr<UPointLightComponent> Light;

	UPROPERTY(VisibleAnywhere, Category = "TLH")
	TObjectPtr<UTextRenderComponent> Label;

	UPROPERTY()
	TObjectPtr<UMaterialInterface> BaseMaterial;

	UPROPERTY()
	TObjectPtr<UMaterialInstanceDynamic> VeilMaterial;

private:
	void UpdateVisuals();

	bool bOpen = false;
	float Time = 0.f;
};
