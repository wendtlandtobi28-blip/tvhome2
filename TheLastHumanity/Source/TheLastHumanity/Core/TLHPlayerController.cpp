#include "Core/TLHPlayerController.h"
#include "TheLastHumanity.h"
#include "Core/TLHCharacter.h"
#include "Core/TLHGameMode.h"
#include "Core/TLHGameSubsystem.h"
#include "UI/TLHWidgets.h"
#include "World/TLHInfoPoint.h"

#include "Components/InputComponent.h"
#include "Engine/GameViewportClient.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "InputCoreTypes.h"
#include "Kismet/KismetSystemLibrary.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/SNullWidget.h"
#include "Widgets/SOverlay.h"

ATLHPlayerController::ATLHPlayerController()
{
	bShowMouseCursor = true;
}

void ATLHPlayerController::BeginPlay()
{
	Super::BeginPlay();

	if (!IsLocalController())
	{
		return;
	}

	SAssignNew(RootWidget, SOverlay)
		.Visibility(EVisibility::SelfHitTestInvisible)
		+ SOverlay::Slot()
		[
			TLHWidgets::MakeHud(this)
		]
		+ SOverlay::Slot()
		[
			SAssignNew(OverlaySlot, SBox)
			.Visibility(EVisibility::SelfHitTestInvisible)
		];

	if (UGameViewportClient* Viewport = GetWorld()->GetGameViewport())
	{
		Viewport->AddViewportWidgetContent(RootWidget.ToSharedRef(), 10);
	}

	const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	if (!Sub || !Sub->IsContentLoaded())
	{
		UE_LOG(LogTLH, Error, TEXT("Inhalte konnten nicht geladen werden - Texte fehlen."));
	}

	SetUIState(ETLHUIState::MainMenu);
}

void ATLHPlayerController::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (RootWidget.IsValid())
	{
		if (UWorld* World = GetWorld())
		{
			if (UGameViewportClient* Viewport = World->GetGameViewport())
			{
				Viewport->RemoveViewportWidgetContent(RootWidget.ToSharedRef());
			}
		}
		RootWidget.Reset();
		OverlaySlot.Reset();
	}
	Super::EndPlay(EndPlayReason);
}

void ATLHPlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();

	InputComponent->BindKey(EKeys::E, IE_Pressed, this, &ATLHPlayerController::OnInteractPressed);
	InputComponent->BindKey(EKeys::Escape, IE_Pressed, this, &ATLHPlayerController::OnMenuPressed);
	// P als Alternative: im Editor (PIE) beendet Escape die Vorschau
	InputComponent->BindKey(EKeys::P, IE_Pressed, this, &ATLHPlayerController::OnMenuPressed);
	InputComponent->BindKey(EKeys::Tab, IE_Pressed, this, &ATLHPlayerController::OnOverviewPressed);
	InputComponent->BindKey(EKeys::K, IE_Pressed, this, &ATLHPlayerController::OnOverviewPressed);
	InputComponent->BindKey(EKeys::F5, IE_Pressed, this, &ATLHPlayerController::OnQuickSavePressed);
}

void ATLHPlayerController::PlayerTick(float DeltaTime)
{
	Super::PlayerTick(DeltaTime);

	if (ToastTimeLeft > 0.f)
	{
		ToastTimeLeft -= DeltaTime;
	}

	if (UIState == ETLHUIState::Playing)
	{
		UpdateFocusedInfoPoint();
	}
}

void ATLHPlayerController::UpdateFocusedInfoPoint()
{
	FVector ViewLocation;
	FRotator ViewRotation;
	GetPlayerViewPoint(ViewLocation, ViewRotation);
	const FVector Forward = ViewRotation.Vector();

	ATLHInfoPoint* Best = nullptr;
	float BestDot = 0.55f; // ca. 56 Grad Blickkegel
	for (TActorIterator<ATLHInfoPoint> It(GetWorld()); It; ++It)
	{
		const FVector ToPoint = It->GetInteractionLocation() - ViewLocation;
		const float Distance = ToPoint.Size();
		if (Distance > InteractDistance || Distance < KINDA_SMALL_NUMBER)
		{
			continue;
		}
		const float Dot = FVector::DotProduct(Forward, ToPoint / Distance);
		if (Dot > BestDot)
		{
			BestDot = Dot;
			Best = *It;
		}
	}

	if (FocusedInfoPoint.Get() != Best)
	{
		if (ATLHInfoPoint* Old = FocusedInfoPoint.Get())
		{
			Old->SetFocused(false);
		}
		if (Best)
		{
			Best->SetFocused(true);
		}
		FocusedInfoPoint = Best;
	}
}

FText ATLHPlayerController::GetInteractPrompt() const
{
	const ATLHInfoPoint* Point = FocusedInfoPoint.Get();
	const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	if (!Point || !Sub || UIState != ETLHUIState::Playing)
	{
		return FText::GetEmpty();
	}
	FFormatOrderedArguments Args;
	Args.Add(Point->GetTitle());
	return Sub->UIFormat(Sub->IsDiscovered(Point->GetInfoId()) ? TEXT("hud.interact_again") : TEXT("hud.interact"), Args);
}

void ATLHPlayerController::ShowToast(const FText& Text, float Seconds)
{
	ToastText = Text;
	ToastTimeLeft = Seconds;
}

void ATLHPlayerController::SetUIState(ETLHUIState NewState, FName InfoId)
{
	UIState = NewState;

	if (OverlaySlot.IsValid())
	{
		switch (NewState)
		{
		case ETLHUIState::MainMenu:
			OverlaySlot->SetContent(TLHWidgets::MakeMenu(this, false));
			break;
		case ETLHUIState::PauseMenu:
			OverlaySlot->SetContent(TLHWidgets::MakeMenu(this, true));
			break;
		case ETLHUIState::InfoPanel:
			OverlaySlot->SetContent(TLHWidgets::MakeInfoPanel(this, InfoId));
			break;
		case ETLHUIState::ChapterOverview:
			OverlaySlot->SetContent(TLHWidgets::MakeChapterOverview(this));
			break;
		case ETLHUIState::Playing:
		default:
			OverlaySlot->SetContent(SNullWidget::NullWidget);
			break;
		}
	}

	const bool bGameplay = (NewState == ETLHUIState::Playing);
	if (ATLHCharacter* Character = GetPawn<ATLHCharacter>())
	{
		Character->SetGameplayInputEnabled(bGameplay);
	}

	if (bGameplay)
	{
		FInputModeGameOnly Mode;
		SetInputMode(Mode);
		bShowMouseCursor = false;
	}
	else
	{
		if (ATLHInfoPoint* Old = FocusedInfoPoint.Get())
		{
			Old->SetFocused(false);
		}
		FocusedInfoPoint = nullptr;

		// GameAndUI: Tastenkuerzel (E, Esc, Tab) funktionieren weiter, Maus bedient die Knoepfe
		FInputModeGameAndUI Mode;
		Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
		Mode.SetHideCursorDuringCapture(false);
		SetInputMode(Mode);
		bShowMouseCursor = true;
	}
}

void ATLHPlayerController::MovePawnTo(const FVector& Location, const FRotator& Rotation)
{
	if (APawn* MyPawn = GetPawn())
	{
		MyPawn->SetActorLocation(Location, false, nullptr, ETeleportType::TeleportPhysics);
	}
	SetControlRotation(FRotator(Rotation.Pitch, Rotation.Yaw, 0.f));
}

void ATLHPlayerController::RefreshInfoPoints()
{
	const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	for (TActorIterator<ATLHInfoPoint> It(GetWorld()); It; ++It)
	{
		It->SetDiscovered(Sub && Sub->IsDiscovered(It->GetInfoId()));
	}
}

void ATLHPlayerController::StartNewGame()
{
	if (UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this))
	{
		Sub->ResetProgress();
		ShowToast(Sub->UI(TEXT("toast.newgame")), 4.f);
	}
	MovePawnTo(ATLHGameMode::GetStartLocation(), ATLHGameMode::GetStartRotation());
	RefreshInfoPoints();
	bGameStarted = true;
	SetUIState(ETLHUIState::Playing);
}

void ATLHPlayerController::ContinueGame()
{
	UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	FVector Location;
	FRotator Rotation;
	if (Sub && Sub->LoadGame(Location, Rotation))
	{
		MovePawnTo(Location, Rotation);
		RefreshInfoPoints();
		bGameStarted = true;
		ShowToast(Sub->UI(TEXT("toast.loaded")));
		SetUIState(ETLHUIState::Playing);
	}
	else if (Sub)
	{
		ShowToast(Sub->UI(TEXT("toast.nosave")));
	}
}

void ATLHPlayerController::SaveCurrentGame(bool bShowMessage)
{
	UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	const APawn* MyPawn = GetPawn();
	if (!Sub || !MyPawn || !bGameStarted)
	{
		return;
	}
	const bool bOk = Sub->SaveGame(MyPawn->GetActorLocation(), GetControlRotation());
	if (bShowMessage || !bOk)
	{
		ShowToast(Sub->UI(bOk ? TEXT("toast.saved") : TEXT("toast.save_failed")));
	}
	// Pausenmenue neu aufbauen, damit "Spielstand laden" aktiv wird
	if (UIState == ETLHUIState::PauseMenu)
	{
		SetUIState(ETLHUIState::PauseMenu);
	}
}

void ATLHPlayerController::OpenChapterOverview()
{
	if (UIState != ETLHUIState::ChapterOverview)
	{
		StateBeforeOverview = UIState;
		SetUIState(ETLHUIState::ChapterOverview);
	}
}

void ATLHPlayerController::ReturnToMainMenu()
{
	SetUIState(ETLHUIState::MainMenu);
}

void ATLHPlayerController::CloseOverlay()
{
	switch (UIState)
	{
	case ETLHUIState::InfoPanel:
	case ETLHUIState::PauseMenu:
		SetUIState(ETLHUIState::Playing);
		break;
	case ETLHUIState::ChapterOverview:
		SetUIState(StateBeforeOverview == ETLHUIState::ChapterOverview ? ETLHUIState::MainMenu : StateBeforeOverview);
		break;
	default:
		break;
	}
}

void ATLHPlayerController::QuitToDesktop()
{
	UKismetSystemLibrary::QuitGame(this, this, EQuitPreference::Quit, false);
}

void ATLHPlayerController::OnInteractPressed()
{
	if (UIState == ETLHUIState::InfoPanel)
	{
		CloseOverlay();
		return;
	}
	if (UIState != ETLHUIState::Playing)
	{
		return;
	}
	ATLHInfoPoint* Point = FocusedInfoPoint.Get();
	UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	if (!Point || !Sub)
	{
		return;
	}

	const FName InfoId = Point->GetInfoId();
	if (Sub->MarkDiscovered(InfoId))
	{
		Point->SetDiscovered(true);
		SaveCurrentGame(false); // automatische Speicherung bei neuer Erkenntnis
		ShowToast(Sub->UI(TEXT("toast.discovered")));
	}
	SetUIState(ETLHUIState::InfoPanel, InfoId);
}

void ATLHPlayerController::OnMenuPressed()
{
	switch (UIState)
	{
	case ETLHUIState::Playing:
		SetUIState(ETLHUIState::PauseMenu);
		break;
	case ETLHUIState::PauseMenu:
	case ETLHUIState::InfoPanel:
	case ETLHUIState::ChapterOverview:
		CloseOverlay();
		break;
	default:
		break;
	}
}

void ATLHPlayerController::OnOverviewPressed()
{
	if (UIState == ETLHUIState::ChapterOverview)
	{
		CloseOverlay();
	}
	else if (UIState == ETLHUIState::Playing || UIState == ETLHUIState::PauseMenu)
	{
		OpenChapterOverview();
	}
}

void ATLHPlayerController::OnQuickSavePressed()
{
	if (UIState == ETLHUIState::Playing)
	{
		SaveCurrentGame(true);
	}
}
