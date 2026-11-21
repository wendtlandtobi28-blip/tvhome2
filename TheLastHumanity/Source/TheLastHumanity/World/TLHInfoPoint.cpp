#include "World/TLHInfoPoint.h"

#include "Components/PointLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Camera/PlayerCameraManager.h"
#include "Engine/StaticMesh.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	const FLinearColor ColorUndiscovered(1.0f, 0.68f, 0.22f);
	const FLinearColor ColorDiscovered(0.30f, 0.78f, 1.0f);
}

ATLHInfoPoint::ATLHInfoPoint()
{
	PrimaryActorTick.bCanEverTick = true;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderMesh(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> ShapeMaterial(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));

	SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("Wurzel"));
	RootComponent = SceneRoot;

	Pedestal = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Sockel"));
	Pedestal->SetupAttachment(SceneRoot);
	Pedestal->SetStaticMesh(CylinderMesh.Object);
	Pedestal->SetRelativeLocation(FVector(0.f, 0.f, 50.f));
	Pedestal->SetRelativeScale3D(FVector(0.7f, 0.7f, 1.0f));

	Orb = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Lichtkugel"));
	Orb->SetupAttachment(SceneRoot);
	Orb->SetStaticMesh(SphereMesh.Object);
	Orb->SetRelativeLocation(FVector(0.f, 0.f, OrbHeight));
	Orb->SetRelativeScale3D(FVector(0.3f));
	Orb->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Orb->SetCastShadow(false);

	Light = CreateDefaultSubobject<UPointLightComponent>(TEXT("Licht"));
	Light->SetupAttachment(SceneRoot);
	Light->SetRelativeLocation(FVector(0.f, 0.f, OrbHeight + 40.f));
	Light->SetIntensityUnits(ELightUnits::Candelas);
	Light->SetIntensity(30.f);
	Light->SetAttenuationRadius(450.f);
	Light->SetLightColor(ColorUndiscovered);

	Label = CreateDefaultSubobject<UTextRenderComponent>(TEXT("Titel"));
	Label->SetupAttachment(SceneRoot);
	Label->SetRelativeLocation(FVector(0.f, 0.f, 215.f));
	Label->SetHorizontalAlignment(EHTA_Center);
	Label->SetVerticalAlignment(EVRTA_TextCenter);
	Label->SetWorldSize(20.f);
	Label->SetTextRenderColor(FColor(255, 235, 200));

	BaseMaterial = ShapeMaterial.Object;
}

void ATLHInfoPoint::BeginPlay()
{
	Super::BeginPlay();

	if (BaseMaterial)
	{
		if (UMaterialInstanceDynamic* PedestalMat = Pedestal->CreateDynamicMaterialInstance(0, BaseMaterial))
		{
			PedestalMat->SetVectorParameterValue(TEXT("Color"), FLinearColor(0.12f, 0.11f, 0.10f));
		}
		OrbMaterial = Orb->CreateDynamicMaterialInstance(0, BaseMaterial);
	}
	UpdateVisuals();
}

void ATLHInfoPoint::Setup(FName InInfoId, const FText& InTitle)
{
	InfoId = InInfoId;
	Title = InTitle;
	Label->SetText(Title);
}

FVector ATLHInfoPoint::GetInteractionLocation() const
{
	return GetActorLocation() + FVector(0.f, 0.f, OrbHeight);
}

void ATLHInfoPoint::SetDiscovered(bool bInDiscovered)
{
	bDiscovered = bInDiscovered;
	UpdateVisuals();
}

void ATLHInfoPoint::SetFocused(bool bInFocused)
{
	bFocused = bInFocused;
	UpdateVisuals();
}

void ATLHInfoPoint::UpdateVisuals()
{
	const FLinearColor Color = bDiscovered ? ColorDiscovered : ColorUndiscovered;
	Light->SetLightColor(Color);
	Light->SetIntensity(bFocused ? 80.f : 30.f);
	if (OrbMaterial)
	{
		OrbMaterial->SetVectorParameterValue(TEXT("Color"), Color);
	}
}

void ATLHInfoPoint::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Time += DeltaSeconds;

	// Schweben und pulsieren
	Orb->SetRelativeLocation(FVector(0.f, 0.f, OrbHeight + 6.f * FMath::Sin(Time * 1.8f)));
	const float Scale = (bFocused ? 0.36f : 0.3f) + 0.015f * FMath::Sin(Time * 3.1f);
	Orb->SetRelativeScale3D(FVector(Scale));

	// Titel immer zur Kamera drehen
	if (const APlayerCameraManager* Cam = UGameplayStatics::GetPlayerCameraManager(this, 0))
	{
		const FVector ToCamera = Cam->GetCameraLocation() - Label->GetComponentLocation();
		Label->SetWorldRotation(FRotator(0.f, ToCamera.Rotation().Yaw, 0.f));
	}
}
