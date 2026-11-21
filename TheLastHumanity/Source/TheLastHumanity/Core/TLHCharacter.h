#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "TLHCharacter.generated.h"

class UCameraComponent;

/**
 * Ego-Spielfigur. Steuerung bewusst ohne Input-Assets (WASD/Pfeiltasten,
 * Maus, Leertaste, Shift), damit der Prototyp rein aus Quelltext entsteht.
 * Spaeter: Umstellung auf Enhanced-Input-Assets mit frei belegbaren Tasten.
 */
UCLASS()
class THELASTHUMANITY_API ATLHCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	ATLHCharacter();

	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

	/** false, solange ein Menue oder Textfenster offen ist. */
	void SetGameplayInputEnabled(bool bEnabled) { bGameplayInput = bEnabled; }
	bool IsGameplayInputEnabled() const { return bGameplayInput; }

protected:
	UPROPERTY(VisibleAnywhere, Category = "TLH")
	TObjectPtr<UCameraComponent> Camera;

	UPROPERTY(EditAnywhere, Category = "TLH|Steuerung")
	float WalkSpeed = 350.f;

	UPROPERTY(EditAnywhere, Category = "TLH|Steuerung")
	float SprintSpeed = 650.f;

	/** Grad pro Maus-Einheit. */
	UPROPERTY(EditAnywhere, Category = "TLH|Steuerung")
	float MouseSensitivity = 2.5f;

	UPROPERTY(EditAnywhere, Category = "TLH|Steuerung")
	bool bInvertMouseY = false;

private:
	void OnJumpPressed();
	void OnJumpReleased();

	bool bGameplayInput = false;
};
