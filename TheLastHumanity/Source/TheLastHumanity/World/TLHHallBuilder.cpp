#include "World/TLHHallBuilder.h"
#include "TheLastHumanity.h"
#include "Core/TLHTypes.h"
#include "World/TLHInfoPoint.h"

#include "Components/DirectionalLightComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/CollisionProfile.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	const FLinearColor Stone(0.32f, 0.29f, 0.25f);
	const FLinearColor DarkStone(0.16f, 0.15f, 0.13f);
	const FLinearColor Sand(0.55f, 0.47f, 0.36f);
}

ATLHHallBuilder::ATLHHallBuilder()
{
	PrimaryActorTick.bCanEverTick = false;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cylinder(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> ShapeMaterial(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	CubeMesh = Cube.Object;
	CylinderMesh = Cylinder.Object;
	BaseMaterial = ShapeMaterial.Object;

	SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("Wurzel"));
	SceneRoot->SetMobility(EComponentMobility::Movable);
	RootComponent = SceneRoot;
}

UStaticMeshComponent* ATLHHallBuilder::AddMesh(UStaticMesh* Mesh, const FVector& Location, const FVector& Scale,
	const FLinearColor& Color, const FRotator& Rotation)
{
	if (!Mesh)
	{
		return nullptr;
	}
	UStaticMeshComponent* Comp = NewObject<UStaticMeshComponent>(this);
	Comp->SetMobility(EComponentMobility::Movable);
	Comp->SetStaticMesh(Mesh);
	Comp->SetupAttachment(SceneRoot);
	Comp->SetRelativeLocationAndRotation(Location, Rotation);
	Comp->SetRelativeScale3D(Scale);
	Comp->SetCollisionProfileName(UCollisionProfile::BlockAll_ProfileName);
	Comp->RegisterComponent();
	AddInstanceComponent(Comp);

	if (BaseMaterial)
	{
		if (UMaterialInstanceDynamic* Mat = Comp->CreateDynamicMaterialInstance(0, BaseMaterial))
		{
			Mat->SetVectorParameterValue(TEXT("Color"), Color);
		}
	}
	return Comp;
}

void ATLHHallBuilder::AddBox(const FVector& Center, const FVector& SizeCm, const FLinearColor& Color)
{
	// Engine-Wuerfel ist 100 cm gross, Pivot in der Mitte
	AddMesh(CubeMesh, Center, SizeCm / 100.f, Color);
}

void ATLHHallBuilder::BuildLighting()
{
	UDirectionalLightComponent* Sun = NewObject<UDirectionalLightComponent>(this);
	Sun->SetMobility(EComponentMobility::Movable);
	Sun->SetupAttachment(SceneRoot);
	Sun->SetRelativeRotation(FRotator(-38.f, 35.f, 0.f));
	Sun->SetIntensity(7.f);
	Sun->SetLightColor(FLinearColor(1.0f, 0.88f, 0.72f));
	Sun->SetAtmosphereSunLight(true);
	Sun->RegisterComponent();
	AddInstanceComponent(Sun);

	USkyAtmosphereComponent* Atmosphere = NewObject<USkyAtmosphereComponent>(this);
	Atmosphere->SetupAttachment(SceneRoot);
	Atmosphere->RegisterComponent();
	AddInstanceComponent(Atmosphere);

	USkyLightComponent* SkyLight = NewObject<USkyLightComponent>(this);
	SkyLight->SetMobility(EComponentMobility::Movable);
	SkyLight->SetupAttachment(SceneRoot);
	SkyLight->SetIntensity(1.0f);
	SkyLight->RegisterComponent();
	AddInstanceComponent(SkyLight);
	SkyLight->RecaptureSky();

	UExponentialHeightFogComponent* Fog = NewObject<UExponentialHeightFogComponent>(this);
	Fog->SetupAttachment(SceneRoot);
	Fog->SetFogDensity(0.015f);
	Fog->RegisterComponent();
	AddInstanceComponent(Fog);

	// Warme Fackel-Lichter entlang der Waende
	for (int32 i = -3; i <= 3; ++i)
	{
		for (const float Side : { -1.f, 1.f })
		{
			UPointLightComponent* Torch = NewObject<UPointLightComponent>(this);
			Torch->SetMobility(EComponentMobility::Movable);
			Torch->SetupAttachment(SceneRoot);
			Torch->SetRelativeLocation(FVector(i * 550.f, Side * (HalfWidth - 80.f), 380.f));
			Torch->SetIntensityUnits(ELightUnits::Candelas);
			Torch->SetIntensity(25.f);
			Torch->SetAttenuationRadius(900.f);
			Torch->SetLightColor(FLinearColor(1.0f, 0.55f, 0.25f));
			Torch->RegisterComponent();
			AddInstanceComponent(Torch);
		}
	}
}

void ATLHHallBuilder::BuildHall(const FTLHChapter* Chapter)
{
	const float Thickness = 60.f;

	// Boden (Oberkante bei Z = 0)
	AddBox(FVector(0.f, 0.f, -Thickness * 0.5f), FVector(HalfLength * 2.f, HalfWidth * 2.f, Thickness), Sand);

	// Laengswaende
	for (const float Side : { -1.f, 1.f })
	{
		AddBox(FVector(0.f, Side * (HalfWidth + Thickness * 0.5f), WallHeight * 0.5f),
			FVector(HalfLength * 2.f, Thickness, WallHeight), Stone);
	}
	// Stirnwaende
	for (const float Side : { -1.f, 1.f })
	{
		AddBox(FVector(Side * (HalfLength + Thickness * 0.5f), 0.f, WallHeight * 0.5f),
			FVector(Thickness, HalfWidth * 2.f + Thickness * 2.f, WallHeight), Stone);
	}

	// Saeulenreihen (Halle ist nach oben offen: Himmel als Symbol des Ursprungs)
	for (int32 i = -3; i <= 3; ++i)
	{
		for (const float Side : { -1.f, 1.f })
		{
			AddMesh(CylinderMesh, FVector(i * 550.f + 275.f, Side * (HalfWidth - 220.f), WallHeight * 0.5f),
				FVector(0.9f, 0.9f, WallHeight / 100.f), DarkStone);
		}
	}

	// Mittelweg
	AddBox(FVector(0.f, 0.f, 1.f), FVector(HalfLength * 2.f - 200.f, 260.f, 2.f), DarkStone);

	BuildLighting();

	if (!Chapter)
	{
		UE_LOG(LogTLH, Warning, TEXT("Kein spielbares Kapitel in den Inhalten gefunden - Halle bleibt leer."));
		return;
	}

	// Kapitel-Inschrift an der Stirnwand
	UTextRenderComponent* Inscription = NewObject<UTextRenderComponent>(this);
	Inscription->SetupAttachment(SceneRoot);
	Inscription->SetRelativeLocationAndRotation(FVector(HalfLength - 5.f, 0.f, 560.f), FRotator(0.f, 180.f, 0.f));
	Inscription->SetHorizontalAlignment(EHTA_Center);
	Inscription->SetWorldSize(70.f);
	Inscription->SetTextRenderColor(FColor(240, 215, 160));
	Inscription->SetText(FText::Format(FText::FromString(TEXT("{0}. {1}")), FText::AsNumber(Chapter->Number), Chapter->Title));
	Inscription->RegisterComponent();
	AddInstanceComponent(Inscription);

	UWorld* World = GetWorld();
	for (const FTLHInfoEntry& Entry : Chapter->InfoPoints)
	{
		FActorSpawnParameters Params;
		Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		if (ATLHInfoPoint* Point = World->SpawnActor<ATLHInfoPoint>(Entry.Location, FRotator::ZeroRotator, Params))
		{
			Point->Setup(Entry.Id, Entry.Title);
		}
	}
	UE_LOG(LogTLH, Log, TEXT("Halle erzeugt: Kapitel %d mit %d Informationspunkten."), Chapter->Number, Chapter->InfoPoints.Num());
}
