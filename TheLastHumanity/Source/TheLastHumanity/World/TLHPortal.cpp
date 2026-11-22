#include "World/TLHPortal.h"

#include "Components/PointLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	const FLinearColor ColorLocked(0.55f, 0.12f, 0.10f);
	const FLinearColor ColorOpen(0.35f, 0.85f, 1.0f);

	// Torgroesse (cm)
	constexpr float GateWidth = 260.f;
	constexpr float GateHeight = 360.f;
	constexpr float PillarSize = 70.f;
}

ATLHPortal::ATLHPortal()
{
	PrimaryActorTick.bCanEverTick = true;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> ShapeMaterial(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	BaseMaterial = ShapeMaterial.Object;

	SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("Wurzel"));
	RootComponent = SceneRoot;

	auto MakeBox = [this](const TCHAR* Name, const FVector& Location, const FVector& Size) -> UStaticMeshComponent*
	{
		UStaticMeshComponent* Comp = CreateDefaultSubobject<UStaticMeshComponent>(Name);
		Comp->SetupAttachment(SceneRoot);
		Comp->SetStaticMesh(CubeMesh.Object);
		Comp->SetRelativeLocation(Location);
		Comp->SetRelativeScale3D(Size / 100.f);
		return Comp;
	};

	const float HalfGap = GateWidth * 0.5f + PillarSize * 0.5f;
	PillarLeft = MakeBox(TEXT("PfeilerLinks"), FVector(0.f, -HalfGap, GateHeight * 0.5f), FVector(PillarSize, PillarSize, GateHeight));
	PillarRight = MakeBox(TEXT("PfeilerRechts"), FVector(0.f, HalfGap, GateHeight * 0.5f), FVector(PillarSize, PillarSize, GateHeight));
	Lintel = MakeBox(TEXT("Sturz"), FVector(0.f, 0.f, GateHeight + 35.f), FVector(PillarSize + 10.f, GateWidth + PillarSize * 2.f + 40.f, 70.f));
	Veil = MakeBox(TEXT("Schleier"), FVector(0.f, 0.f, GateHeight * 0.5f), FVector(6.f, GateWidth, GateHeight));
	Veil->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Veil->SetCastShadow(false);

	Light = CreateDefaultSubobject<UPointLightComponent>(TEXT("Licht"));
	Light->SetupAttachment(SceneRoot);
	Light->SetRelativeLocation(FVector(-120.f, 0.f, 220.f));
	Light->SetIntensityUnits(ELightUnits::Candelas);
	Light->SetIntensity(40.f);
	Light->SetAttenuationRadius(700.f);

	Label = CreateDefaultSubobject<UTextRenderComponent>(TEXT("Beschriftung"));
	Label->SetupAttachment(SceneRoot);
	Label->SetRelativeLocationAndRotation(FVector(-45.f, 0.f, GateHeight + 110.f), FRotator(0.f, 180.f, 0.f));
	Label->SetHorizontalAlignment(EHTA_Center);
	Label->SetVerticalAlignment(EVRTA_TextCenter);
	Label->SetWorldSize(26.f);
	Label->SetTextRenderColor(FColor(240, 220, 180));
}

void ATLHPortal::BeginPlay()
{
	Super::BeginPlay();
	if (BaseMaterial)
	{
		for (UStaticMeshComponent* Stone : { PillarLeft.Get(), PillarRight.Get(), Lintel.Get() })
		{
			if (UMaterialInstanceDynamic* Mat = Stone->CreateDynamicMaterialInstance(0, BaseMaterial))
			{
				Mat->SetVectorParameterValue(TEXT("Color"), FLinearColor(0.09f, 0.085f, 0.08f));
			}
		}
		VeilMaterial = Veil->CreateDynamicMaterialInstance(0, BaseMaterial);
	}
	UpdateVisuals();
}

void ATLHPortal::SetOpen(bool bInOpen)
{
	bOpen = bInOpen;
	UpdateVisuals();
}

void ATLHPortal::SetLabel(const FText& Text)
{
	Label->SetText(Text);
}

FVector ATLHPortal::GetInteractionLocation() const
{
	return GetActorLocation() + FVector(0.f, 0.f, 160.f);
}

void ATLHPortal::SetFocused(bool bInFocused)
{
	Super::SetFocused(bInFocused);
	UpdateVisuals();
}

void ATLHPortal::UpdateVisuals()
{
	const FLinearColor Color = bOpen ? ColorOpen : ColorLocked;
	Light->SetLightColor(Color);
	Light->SetIntensity((bOpen ? 60.f : 15.f) * (bFocused ? 1.8f : 1.f));
	if (VeilMaterial)
	{
		VeilMaterial->SetVectorParameterValue(TEXT("Color"), bOpen ? Color : Color * 0.4f);
	}
}

void ATLHPortal::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Time += DeltaSeconds;
	if (bOpen)
	{
		// Schleier "atmet" leicht
		const float Pulse = 1.f + 0.04f * FMath::Sin(Time * 2.2f);
		Veil->SetRelativeScale3D(FVector(0.06f, (GateWidth / 100.f) * Pulse, GateHeight / 100.f));
	}
}
