#include "Core/TLHPlayerController.h"
#include "TheLastHumanity.h"
#include "Core/TLHCharacter.h"
#include "Core/TLHGameMode.h"
#include "Core/TLHGameSubsystem.h"
#include "UI/TLHWidgets.h"
#include "World/TLHHallBuilder.h"
#include "World/TLHInfoPoint.h"
#include "World/TLHPortal.h"

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

	if (const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this))
	{
		if (!Sub->IsContentLoaded())
		{
			UE_LOG(LogTLH, Error, TEXT("Inhalte konnten nicht geladen werden - Texte fehlen."));
		}
		ApplySettings(Sub->GetSettings());
	}

	RefreshWorldState();
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
		UpdateFocus();
	}
}

// ------------------------------------------------------------------ Welt

ATLHHallBuilder* ATLHPlayerController::FindHallBuilder() const
{
	for (TActorIterator<ATLHHallBuilder> It(GetWorld()); It; ++It)
	{
		return *It;
	}
	return nullptr;
}

void ATLHPlayerController::EnsureHallForCurrentChapter()
{
	const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	ATLHHallBuilder* Builder = FindHallBuilder();
	if (!Sub || !Builder)
	{
		return;
	}
	const FTLHChapter* Chapter = Sub->GetCurrentChapter();
	if (Chapter && Builder->GetBuiltChapterId() != Chapter->Id)
	{
		Focused = nullptr;
		Builder->BuildHall(Chapter);
	}
}

void ATLHPlayerController::RefreshWorldState()
{
	const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	if (!Sub)
	{
		return;
	}
	for (TActorIterator<ATLHInfoPoint> It(GetWorld()); It; ++It)
	{
		It->SetDiscovered(Sub->IsDiscovered(It->GetInfoId()));
	}

	const FTLHChapter* Current = Sub->GetCurrentChapter();
	ATLHHallBuilder* Builder = FindHallBuilder();
	ATLHPortal* Portal = Builder ? Builder->GetPortal() : nullptr;
	if (!Current || !Portal)
	{
		return;
	}
	const FTLHChapter* Next = Sub->GetNextChapter(*Current);
	const bool bNextPlayable = Next && Next->bAvailable;
	const bool bOpen = bNextPlayable ? Sub->IsChapterUnlocked(*Next) : Sub->IsChapterComplete(*Current);
	Portal->SetOpen(bOpen);

	if (bNextPlayable)
	{
		FFormatOrderedArguments Args;
		Args.Add(FText::AsNumber(Next->Number));
		Args.Add(Next->Title);
		Portal->SetLabel(Sub->UIFormat(TEXT("portal.label_next"), Args));
	}
	else
	{
		Portal->SetLabel(Sub->UI(TEXT("portal.label_end")));
	}
}

void ATLHPlayerController::UpdateFocus()
{
	FVector ViewLocation;
	FRotator ViewRotation;
	GetPlayerViewPoint(ViewLocation, ViewRotation);
	const FVector Forward = ViewRotation.Vector();

	ATLHInteractable* Best = nullptr;
	float BestDot = 0.55f; // ca. 56 Grad Blickkegel
	for (TActorIterator<ATLHInteractable> It(GetWorld()); It; ++It)
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

	if (Focused.Get() != Best)
	{
		if (ATLHInteractable* Old = Focused.Get())
		{
			Old->SetFocused(false);
		}
		if (Best)
		{
			Best->SetFocused(true);
		}
		Focused = Best;
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

// ------------------------------------------------------------------ HUD-Texte

FText ATLHPlayerController::GetInteractPrompt() const
{
	const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	const ATLHInteractable* Target = Focused.Get();
	if (!Target || !Sub || UIState != ETLHUIState::Playing)
	{
		return FText::GetEmpty();
	}

	if (const ATLHInfoPoint* Point = Cast<ATLHInfoPoint>(Target))
	{
		FFormatOrderedArguments Args;
		Args.Add(Point->GetTitle());
		return Sub->UIFormat(Sub->IsDiscovered(Point->GetInfoId()) ? TEXT("hud.interact_again") : TEXT("hud.interact"), Args);
	}

	if (const ATLHPortal* Portal = Cast<ATLHPortal>(Target))
	{
		const FTLHChapter* Current = Sub->GetCurrentChapter();
		if (!Current)
		{
			return FText::GetEmpty();
		}
		if (!Portal->IsOpen())
		{
			FFormatOrderedArguments Args;
			Args.Add(FText::AsNumber(Sub->CountDiscovered(*Current)));
			Args.Add(FText::AsNumber(Current->InfoPoints.Num()));
			return Sub->UIFormat(TEXT("hud.portal_locked"), Args);
		}
		const FTLHChapter* Next = Sub->GetNextChapter(*Current);
		if (Next && Next->bAvailable)
		{
			FFormatOrderedArguments Args;
			Args.Add(FText::AsNumber(Next->Number));
			Args.Add(Next->Title);
			return Sub->UIFormat(TEXT("hud.portal_next"), Args);
		}
		return Sub->UI(TEXT("hud.portal_ending"));
	}
	return FText::GetEmpty();
}

FText ATLHPlayerController::GetChapterLine() const
{
	const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	const FTLHChapter* Current = Sub ? Sub->GetCurrentChapter() : nullptr;
	if (!Current)
	{
		return FText::GetEmpty();
	}
	FFormatOrderedArguments Args;
	Args.Add(FText::AsNumber(Current->Number));
	Args.Add(Current->Title);
	Args.Add(FText::AsNumber(Sub->CountDiscovered(*Current)));
	Args.Add(FText::AsNumber(Current->InfoPoints.Num()));
	return Sub->UIFormat(TEXT("hud.chapter"), Args);
}

void ATLHPlayerController::ShowToast(const FText& Text, float Seconds)
{
	ToastText = Text;
	ToastTimeLeft = Seconds;
}

// ------------------------------------------------------------------ Zustand

void ATLHPlayerController::SetUIState(ETLHUIState NewState)
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
			OverlaySlot->SetContent(TLHWidgets::MakeInfoPanel(this, OpenInfoId));
			break;
		case ETLHUIState::ChapterOverview:
			OverlaySlot->SetContent(TLHWidgets::MakeChapterOverview(this));
			break;
		case ETLHUIState::Options:
			OverlaySlot->SetContent(TLHWidgets::MakeOptions(this));
			break;
		case ETLHUIState::Ending:
			OverlaySlot->SetContent(TLHWidgets::MakeEnding(this));
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
		if (ATLHInteractable* Old = Focused.Get())
		{
			Old->SetFocused(false);
		}
		Focused = nullptr;

		// GameAndUI: Tastenkuerzel (E, Esc, Tab) funktionieren weiter, Maus bedient die Knoepfe
		FInputModeGameAndUI Mode;
		Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
		Mode.SetHideCursorDuringCapture(false);
		SetInputMode(Mode);
		bShowMouseCursor = true;
	}
}

// ------------------------------------------------------------------ Aktionen

void ATLHPlayerController::StartNewGame()
{
	UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	if (!Sub)
	{
		return;
	}
	Sub->ResetProgress();
	EnsureHallForCurrentChapter();
	MovePawnTo(ATLHGameMode::GetStartLocation(), ATLHGameMode::GetStartRotation());
	RefreshWorldState();
	bGameStarted = true;
	ShowToast(Sub->UI(TEXT("toast.newgame")), 5.f);
	SetUIState(ETLHUIState::Playing);
}

void ATLHPlayerController::ContinueGame()
{
	UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	FVector Location;
	FRotator Rotation;
	if (Sub && Sub->LoadGame(Location, Rotation))
	{
		EnsureHallForCurrentChapter();
		MovePawnTo(Location, Rotation);
		RefreshWorldState();
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

void ATLHPlayerController::TravelToChapter(FName ChapterId)
{
	UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	const FTLHChapter* Chapter = Sub ? Sub->FindChapter(ChapterId) : nullptr;
	if (!Chapter || !Sub->IsChapterUnlocked(*Chapter))
	{
		return;
	}
	Sub->SetCurrentChapter(ChapterId);
	EnsureHallForCurrentChapter();
	MovePawnTo(ATLHGameMode::GetStartLocation(), ATLHGameMode::GetStartRotation());
	RefreshWorldState();
	bGameStarted = true;

	FFormatOrderedArguments Args;
	Args.Add(FText::AsNumber(Chapter->Number));
	Args.Add(Chapter->Title);
	ShowToast(Sub->UIFormat(TEXT("toast.chapter"), Args), 5.f);

	SetUIState(ETLHUIState::Playing);
	SaveCurrentGame(false);
}

void ATLHPlayerController::OpenChapterOverview()
{
	if (UIState != ETLHUIState::ChapterOverview)
	{
		ReturnFromOverview = UIState;
		SetUIState(ETLHUIState::ChapterOverview);
	}
}

void ATLHPlayerController::OpenOptions()
{
	if (UIState != ETLHUIState::Options)
	{
		ReturnFromOptions = UIState;
		SetUIState(ETLHUIState::Options);
	}
}

void ATLHPlayerController::OpenInfo(FName InfoId)
{
	const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	if (!Sub || !Sub->FindInfo(InfoId))
	{
		return;
	}
	if (UIState != ETLHUIState::InfoPanel)
	{
		ReturnFromInfo = UIState;
	}
	OpenInfoId = InfoId;
	SetUIState(ETLHUIState::InfoPanel);
}

void ATLHPlayerController::ApplySettings(const FTLHSettings& NewSettings)
{
	if (UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this))
	{
		Sub->SetSettings(NewSettings);
		if (ATLHCharacter* Character = GetPawn<ATLHCharacter>())
		{
			Character->ApplySettings(Sub->GetSettings());
		}
	}
	RefreshWorldState(); // "alle Kapitel freischalten" beeinflusst das Portal
}

void ATLHPlayerController::ReturnToMainMenu()
{
	SetUIState(ETLHUIState::MainMenu);
}

void ATLHPlayerController::CloseOverlay()
{
	switch (UIState)
	{
	case ETLHUIState::PauseMenu:
	case ETLHUIState::Ending:
		SetUIState(ETLHUIState::Playing);
		break;
	case ETLHUIState::InfoPanel:
		SetUIState(ReturnFromInfo == ETLHUIState::InfoPanel ? ETLHUIState::Playing : ReturnFromInfo);
		break;
	case ETLHUIState::ChapterOverview:
		SetUIState(ReturnFromOverview == ETLHUIState::ChapterOverview ? ETLHUIState::MainMenu : ReturnFromOverview);
		break;
	case ETLHUIState::Options:
		if (UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this))
		{
			Sub->SaveSettings();
		}
		SetUIState(ReturnFromOptions == ETLHUIState::Options ? ETLHUIState::MainMenu : ReturnFromOptions);
		break;
	default:
		break;
	}
}

void ATLHPlayerController::QuitToDesktop()
{
	if (UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this))
	{
		Sub->SaveSettings();
	}
	UKismetSystemLibrary::QuitGame(this, this, EQuitPreference::Quit, false);
}

void ATLHPlayerController::UsePortal()
{
	UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	const FTLHChapter* Current = Sub ? Sub->GetCurrentChapter() : nullptr;
	if (!Current)
	{
		return;
	}
	const FTLHChapter* Next = Sub->GetNextChapter(*Current);
	if (Next && Next->bAvailable)
	{
		if (Sub->IsChapterUnlocked(*Next))
		{
			TravelToChapter(Next->Id);
		}
		else
		{
			ShowToast(Sub->UI(TEXT("toast.portal_locked")));
		}
		return;
	}
	if (Sub->IsChapterComplete(*Current))
	{
		ShowEnding();
	}
	else
	{
		ShowToast(Sub->UI(TEXT("toast.portal_locked")));
	}
}

void ATLHPlayerController::ShowEnding()
{
	if (UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this))
	{
		Sub->SetEndingSeen();
		SaveCurrentGame(false);
	}
	SetUIState(ETLHUIState::Ending);
}

// ------------------------------------------------------------------ Tasten

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
	UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(this);
	ATLHInteractable* Target = Focused.Get();
	if (!Sub || !Target)
	{
		return;
	}

	if (ATLHInfoPoint* Point = Cast<ATLHInfoPoint>(Target))
	{
		const FName InfoId = Point->GetInfoId();
		if (Sub->MarkDiscovered(InfoId))
		{
			Point->SetDiscovered(true);
			RefreshWorldState();
			SaveCurrentGame(false); // automatische Speicherung bei neuer Erkenntnis

			const FTLHChapter* Current = Sub->GetCurrentChapter();
			ShowToast(Sub->UI(Current && Sub->IsChapterComplete(*Current) ? TEXT("toast.chapter_complete") : TEXT("toast.discovered")), 4.f);
		}
		OpenInfo(InfoId);
	}
	else if (Cast<ATLHPortal>(Target))
	{
		UsePortal();
	}
}

void ATLHPlayerController::OnMenuPressed()
{
	switch (UIState)
	{
	case ETLHUIState::Playing:
		SetUIState(ETLHUIState::PauseMenu);
		break;
	case ETLHUIState::MainMenu:
		break;
	default:
		CloseOverlay();
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
