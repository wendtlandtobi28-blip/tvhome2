#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TLHInteractable.generated.h"

/** Basisklasse fuer alles, was mit E benutzt werden kann (Informationspunkt, Portal). */
UCLASS(Abstract)
class THELASTHUMANITY_API ATLHInteractable : public AActor
{
	GENERATED_BODY()

public:
	/** Punkt, auf den die Kamera zielen muss. */
	virtual FVector GetInteractionLocation() const { return GetActorLocation(); }

	virtual void SetFocused(bool bInFocused) { bFocused = bInFocused; }
	bool IsFocused() const { return bFocused; }

protected:
	bool bFocused = false;
};
