#include "Core/TLHCharacter.h"
#include "Core/TLHTypes.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/InputComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "InputCoreTypes.h"

ATLHCharacter::ATLHCharacter()
{
	PrimaryActorTick.bCanEverTick = true;

	GetCapsuleComponent()->InitCapsuleSize(42.f, 96.f);

	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Kamera"));
	Camera->SetupAttachment(GetCapsuleComponent());
	Camera->SetRelativeLocation(FVector(0.f, 0.f, 64.f));
	Camera->bUsePawnControlRotation = true;

	bUseControllerRotationYaw = true;
	bUseControllerRotationPitch = false;
	bUseControllerRotationRoll = false;

	GetCharacterMovement()->MaxWalkSpeed = WalkSpeed;
	GetCharacterMovement()->JumpZVelocity = 420.f;
	GetCharacterMovement()->AirControl = 0.3f;
}

void ATLHCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	PlayerInputComponent->BindKey(EKeys::SpaceBar, IE_Pressed, this, &ATLHCharacter::OnJumpPressed);
	PlayerInputComponent->BindKey(EKeys::SpaceBar, IE_Released, this, &ATLHCharacter::OnJumpReleased);
}

void ATLHCharacter::ApplySettings(const FTLHSettings& Settings)
{
	MouseSensitivity = Settings.MouseSensitivity;
	bInvertMouseY = Settings.bInvertY;
	Camera->SetFieldOfView(Settings.FieldOfView);
}

void ATLHCharacter::OnJumpPressed()
{
	if (bGameplayInput)
	{
		Jump();
	}
}

void ATLHCharacter::OnJumpReleased()
{
	StopJumping();
}

void ATLHCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	APlayerController* PC = Cast<APlayerController>(GetController());
	if (!PC || !bGameplayInput)
	{
		return;
	}

	auto Axis = [PC](const FKey& Positive, const FKey& Negative, const FKey& AltPositive, const FKey& AltNegative)
	{
		const float Pos = (PC->IsInputKeyDown(Positive) || PC->IsInputKeyDown(AltPositive)) ? 1.f : 0.f;
		const float Neg = (PC->IsInputKeyDown(Negative) || PC->IsInputKeyDown(AltNegative)) ? 1.f : 0.f;
		return Pos - Neg;
	};

	const float Forward = Axis(EKeys::W, EKeys::S, EKeys::Up, EKeys::Down);
	const float Right = Axis(EKeys::D, EKeys::A, EKeys::Right, EKeys::Left);

	const FRotator YawRotation(0.f, PC->GetControlRotation().Yaw, 0.f);
	const FRotationMatrix YawMatrix(YawRotation);
	AddMovementInput(YawMatrix.GetUnitAxis(EAxis::X), Forward);
	AddMovementInput(YawMatrix.GetUnitAxis(EAxis::Y), Right);

	const bool bSprint = PC->IsInputKeyDown(EKeys::LeftShift) || PC->IsInputKeyDown(EKeys::RightShift);
	GetCharacterMovement()->MaxWalkSpeed = bSprint ? SprintSpeed : WalkSpeed;

	// Blickrichtung direkt setzen (unabhaengig von Legacy-Eingabeskalierung)
	float MouseX = 0.f;
	float MouseY = 0.f;
	PC->GetInputMouseDelta(MouseX, MouseY);
	if (!FMath::IsNearlyZero(MouseX) || !FMath::IsNearlyZero(MouseY))
	{
		FRotator Control = PC->GetControlRotation();
		Control.Yaw += MouseX * MouseSensitivity;
		const float PitchDelta = MouseY * MouseSensitivity * (bInvertMouseY ? -1.f : 1.f);
		Control.Pitch = FMath::Clamp(FRotator::NormalizeAxis(Control.Pitch + PitchDelta), -85.f, 85.f);
		Control.Roll = 0.f;
		PC->SetControlRotation(Control);
	}
}
