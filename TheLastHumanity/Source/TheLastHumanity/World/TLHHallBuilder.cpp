#include "World/TLHHallBuilder.h"
#include "TheLastHumanity.h"
#include "Core/TLHTypes.h"
#include "World/TLHInfoPoint.h"
#include "World/TLHPortal.h"

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

ATLHHallBuilder::ATLHHallBuilder()
{
	PrimaryActorTick.bCanEverTick = false;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cylinder(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Sphere(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> ShapeMaterial(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	CubeMesh = Cube.Object;
	CylinderMesh = Cylinder.Object;
	SphereMesh = Sphere.Object;
	BaseMaterial = ShapeMaterial.Object;

	SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("Wurzel"));
	SceneRoot->SetMobility(EComponentMobility::Movable);
	RootComponent = SceneRoot;
}

FVector ATLHHallBuilder::GetAutoLocation(int32 Index, int32 Count)
{
	// Abwechselnd links/rechts entlang der Halle, von -1400 bis +1200 cm.
	// Muss mit Tools/validate_project.py (auto_location) uebereinstimmen.
	const float StartX = -HalfLength + 600.f;
	const float EndX = HalfLength - 800.f;
	const float Step = Count > 1 ? (EndX - StartX) / (Count - 1) : 0.f;
	const float Y = (Index % 2 == 0) ? -450.f : 450.f;
	return FVector(StartX + Index * Step, Y, 0.f);
}

void ATLHHallBuilder::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	// Beim Beenden der Welt raeumt die Engine selbst auf
	if (EndPlayReason == EEndPlayReason::Destroyed)
	{
		ClearHall();
	}
	Super::EndPlay(EndPlayReason);
}

void ATLHHallBuilder::ClearHall()
{
	for (UActorComponent* Comp : BuiltComponents)
	{
		if (IsValid(Comp))
		{
			Comp->DestroyComponent();
		}
	}
	BuiltComponents.Reset();

	for (AActor* Actor : SpawnedActors)
	{
		if (IsValid(Actor))
		{
			Actor->Destroy();
		}
	}
	SpawnedActors.Reset();
	Portal = nullptr;
	BuiltChapterId = NAME_None;
}

UStaticMeshComponent* ATLHHallBuilder::AddMesh(UStaticMesh* Mesh, const FVector& Location, const FVector& Scale,
	const FLinearColor& Color, bool bCollision)
{
	if (!Mesh)
	{
		return nullptr;
	}
	UStaticMeshComponent* Comp = NewObject<UStaticMeshComponent>(this);
	Comp->SetMobility(EComponentMobility::Movable);
	Comp->SetStaticMesh(Mesh);
	Comp->SetupAttachment(SceneRoot);
	Comp->SetRelativeLocation(Location);
	Comp->SetRelativeScale3D(Scale);
	if (bCollision)
	{
		Comp->SetCollisionProfileName(UCollisionProfile::BlockAll_ProfileName);
	}
	else
	{
		Comp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	}
	Comp->RegisterComponent();
	AddInstanceComponent(Comp);
	BuiltComponents.Add(Comp);

	if (BaseMaterial)
	{
		if (UMaterialInstanceDynamic* Mat = Comp->CreateDynamicMaterialInstance(0, BaseMaterial))
		{
			Mat->SetVectorParameterValue(TEXT("Color"), Color);
		}
	}
	return Comp;
}

void ATLHHallBuilder::AddBox(const FVector& Center, const FVector& SizeCm, const FLinearColor& Color, bool bCollision)
{
	// Engine-Wuerfel ist 100 cm gross, Pivot in der Mitte
	AddMesh(CubeMesh, Center, SizeCm / 100.f, Color, bCollision);
}

void ATLHHallBuilder::AddTorch(const FVector& Location, const FLinearColor& Color, float Intensity)
{
	UPointLightComponent* Torch = NewObject<UPointLightComponent>(this);
	Torch->SetMobility(EComponentMobility::Movable);
	Torch->SetupAttachment(SceneRoot);
	Torch->SetRelativeLocation(Location);
	Torch->SetIntensityUnits(ELightUnits::Candelas);
	Torch->SetIntensity(Intensity);
	Torch->SetAttenuationRadius(900.f);
	Torch->SetLightColor(Color);
	Torch->RegisterComponent();
	AddInstanceComponent(Torch);
	BuiltComponents.Add(Torch);
}

void ATLHHallBuilder::BuildLighting(const FTLHChapterTheme& Theme)
{
	UDirectionalLightComponent* Sun = NewObject<UDirectionalLightComponent>(this);
	Sun->SetMobility(EComponentMobility::Movable);
	Sun->SetupAttachment(SceneRoot);
	Sun->SetRelativeRotation(FRotator(Theme.SunPitch, 35.f, 0.f));
	Sun->SetIntensity(Theme.SunIntensity);
	Sun->SetLightColor(FLinearColor(1.0f, 0.9f, 0.76f));
	Sun->SetAtmosphereSunLight(true);
	Sun->RegisterComponent();
	AddInstanceComponent(Sun);
	BuiltComponents.Add(Sun);

	USkyAtmosphereComponent* Atmosphere = NewObject<USkyAtmosphereComponent>(this);
	Atmosphere->SetupAttachment(SceneRoot);
	Atmosphere->RegisterComponent();
	AddInstanceComponent(Atmosphere);
	BuiltComponents.Add(Atmosphere);

	USkyLightComponent* SkyLight = NewObject<USkyLightComponent>(this);
	SkyLight->SetMobility(EComponentMobility::Movable);
	SkyLight->SetupAttachment(SceneRoot);
	SkyLight->SetIntensity(1.0f);
	SkyLight->RegisterComponent();
	AddInstanceComponent(SkyLight);
	BuiltComponents.Add(SkyLight);
	SkyLight->RecaptureSky();

	UExponentialHeightFogComponent* Fog = NewObject<UExponentialHeightFogComponent>(this);
	Fog->SetupAttachment(SceneRoot);
	Fog->SetFogDensity(Theme.FogDensity);
	Fog->RegisterComponent();
	AddInstanceComponent(Fog);
	BuiltComponents.Add(Fog);

	// Lichter entlang der Waende
	for (int32 i = -3; i <= 3; ++i)
	{
		for (const float Side : { -1.f, 1.f })
		{
			AddTorch(FVector(i * 550.f, Side * (HalfWidth - 80.f), 380.f), Theme.Torch);
		}
	}
}

void ATLHHallBuilder::BuildMonument(const FTLHChapterTheme& Theme)
{
	const FLinearColor Stone = Theme.Column;
	const FLinearColor Light = Theme.Wall * 1.4f;
	const FName M = Theme.Monument;

	if (M == TEXT("feuer"))
	{
		// Steinkreis mit Feuerstelle
		for (int32 i = 0; i < 10; ++i)
		{
			const float A = i * (2.f * UE_PI / 10.f);
			AddBox(FVector(FMath::Cos(A) * 140.f, FMath::Sin(A) * 140.f, 20.f), FVector(50.f, 50.f, 40.f), Stone);
		}
		AddMesh(SphereMesh, FVector(0.f, 0.f, 20.f), FVector(0.9f, 0.9f, 0.35f), FLinearColor(1.0f, 0.45f, 0.1f), false);
		AddTorch(FVector(0.f, 0.f, 90.f), FLinearColor(1.0f, 0.5f, 0.15f), 60.f);
	}
	else if (M == TEXT("obelisk"))
	{
		AddBox(FVector(0.f, 0.f, 30.f), FVector(220.f, 220.f, 60.f), Stone);
		AddBox(FVector(0.f, 0.f, 330.f), FVector(90.f, 90.f, 540.f), Light);
		AddBox(FVector(0.f, 0.f, 630.f), FVector(55.f, 55.f, 60.f), FLinearColor(0.85f, 0.7f, 0.3f));
	}
	else if (M == TEXT("zikkurat"))
	{
		AddBox(FVector(0.f, 0.f, 50.f), FVector(320.f, 320.f, 100.f), Stone);
		AddBox(FVector(0.f, 0.f, 150.f), FVector(230.f, 230.f, 100.f), Light);
		AddBox(FVector(0.f, 0.f, 250.f), FVector(140.f, 140.f, 100.f), Stone);
	}
	else if (M == TEXT("kugel"))
	{
		AddMesh(CylinderMesh, FVector(0.f, 0.f, 60.f), FVector(1.6f, 1.6f, 1.2f), Stone);
		AddMesh(SphereMesh, FVector(0.f, 0.f, 230.f), FVector(2.2f), FLinearColor(0.25f, 0.5f, 0.85f));
	}
	else if (M == TEXT("bogen"))
	{
		AddBox(FVector(0.f, -150.f, 200.f), FVector(60.f, 60.f, 400.f), Stone);
		AddBox(FVector(0.f, 150.f, 200.f), FVector(60.f, 60.f, 400.f), Stone);
		AddBox(FVector(0.f, 0.f, 430.f), FVector(80.f, 380.f, 60.f), Light);
	}
	else if (M == TEXT("turm"))
	{
		// Stahlgeruest: vier Stuetzen, Querstreben, Spitze
		for (const float X : { -110.f, 110.f })
		{
			for (const float Y : { -110.f, 110.f })
			{
				AddBox(FVector(X, Y, 300.f), FVector(24.f, 24.f, 600.f), Stone);
			}
		}
		for (const float Z : { 150.f, 330.f, 510.f })
		{
			AddBox(FVector(0.f, 0.f, Z), FVector(244.f, 244.f, 14.f), Light, false);
		}
		AddBox(FVector(0.f, 0.f, 680.f), FVector(30.f, 30.f, 160.f), FLinearColor(0.8f, 0.2f, 0.15f));
	}
}

void ATLHHallBuilder::BuildHall(const FTLHChapter* Chapter)
{
	ClearHall();

	const FTLHChapterTheme Theme = Chapter ? Chapter->Theme : FTLHChapterTheme();
	const float Thickness = 60.f;

	// Boden (Oberkante bei Z = 0) und Mittelweg
	AddBox(FVector(0.f, 0.f, -Thickness * 0.5f), FVector(HalfLength * 2.f, HalfWidth * 2.f, Thickness), Theme.Floor);
	AddBox(FVector(0.f, 0.f, 1.f), FVector(HalfLength * 2.f - 200.f, 260.f, 2.f), Theme.Column, false);

	// Laengs- und Stirnwaende (Halle nach oben offen)
	for (const float Side : { -1.f, 1.f })
	{
		AddBox(FVector(0.f, Side * (HalfWidth + Thickness * 0.5f), WallHeight * 0.5f),
			FVector(HalfLength * 2.f, Thickness, WallHeight), Theme.Wall);
		AddBox(FVector(Side * (HalfLength + Thickness * 0.5f), 0.f, WallHeight * 0.5f),
			FVector(Thickness, HalfWidth * 2.f + Thickness * 2.f, WallHeight), Theme.Wall);
		// Gesims oben
		AddBox(FVector(0.f, Side * (HalfWidth - 20.f), WallHeight - 30.f), FVector(HalfLength * 2.f, 80.f, 60.f), Theme.Column, false);
	}

	// Saeulenreihen
	const bool bRound = Theme.ColumnShape != TEXT("eckig");
	for (int32 i = -3; i <= 3; ++i)
	{
		for (const float Side : { -1.f, 1.f })
		{
			const FVector Pos(i * 550.f + 275.f, Side * (HalfWidth - 220.f), WallHeight * 0.5f);
			if (bRound)
			{
				AddMesh(CylinderMesh, Pos, FVector(0.9f, 0.9f, WallHeight / 100.f), Theme.Column);
			}
			else
			{
				AddBox(Pos, FVector(80.f, 80.f, WallHeight), Theme.Column);
			}
		}
	}

	BuildMonument(Theme);
	BuildLighting(Theme);

	if (!Chapter)
	{
		UE_LOG(LogTLH, Warning, TEXT("Kein Kapitel uebergeben - Halle bleibt leer."));
		return;
	}
	BuiltChapterId = Chapter->Id;

	// Kapitel-Inschrift an der Eingangswand (hinter dem Startpunkt) und ueber dem Portal
	auto AddInscription = [this](const FVector& Location, float Yaw, const FText& Text, float Size)
	{
		UTextRenderComponent* Inscription = NewObject<UTextRenderComponent>(this);
		Inscription->SetupAttachment(SceneRoot);
		Inscription->SetRelativeLocationAndRotation(Location, FRotator(0.f, Yaw, 0.f));
		Inscription->SetHorizontalAlignment(EHTA_Center);
		Inscription->SetVerticalAlignment(EVRTA_TextCenter);
		Inscription->SetWorldSize(Size);
		Inscription->SetTextRenderColor(FColor(240, 215, 160));
		Inscription->SetText(Text);
		Inscription->RegisterComponent();
		AddInstanceComponent(Inscription);
		BuiltComponents.Add(Inscription);
	};
	const FText Heading = FText::Format(FText::FromString(TEXT("{0}. {1}")), FText::AsNumber(Chapter->Number), Chapter->Title);
	AddInscription(FVector(HalfLength - 5.f, 0.f, 640.f), 180.f, Heading, 64.f);
	AddInscription(FVector(HalfLength - 5.f, 0.f, 560.f), 180.f, Chapter->Era, 30.f);

	UWorld* World = GetWorld();
	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	const int32 Count = Chapter->InfoPoints.Num();
	for (int32 i = 0; i < Count; ++i)
	{
		const FTLHInfoEntry& Entry = Chapter->InfoPoints[i];
		const FVector Location = Entry.bHasLocation ? Entry.Location : GetAutoLocation(i, Count);
		if (ATLHInfoPoint* Point = World->SpawnActor<ATLHInfoPoint>(Location, FRotator::ZeroRotator, Params))
		{
			Point->Setup(Entry.Id, Entry.Title);
			SpawnedActors.Add(Point);
		}
	}

	Portal = World->SpawnActor<ATLHPortal>(FVector(PortalX, 0.f, 0.f), FRotator::ZeroRotator, Params);
	if (Portal)
	{
		SpawnedActors.Add(Portal);
	}

	UE_LOG(LogTLH, Log, TEXT("Halle erzeugt: Kapitel %d (%s) mit %d Informationspunkten."),
		Chapter->Number, *Chapter->Id.ToString(), Count);
}
