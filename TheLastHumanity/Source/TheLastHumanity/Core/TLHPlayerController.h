#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "TLHPlayerController.generated.h"

class ATLHInfoPoint;
class SBox;
class SOverlay;

UENUM()
enum class ETLHUIState : uint8
{
	MainMenu,
	Playing,
	PauseMenu,
	InfoPanel,
	ChapterOverview
};

/**
 * Steuert Spielzustand und Benutzeroberflaeche:
 * Hauptmenue, Pausenmenue, Informationsfenster, Kapiteluebersicht, HUD.
 */
UCLASS()
class THELASTHUMANITY_API ATLHPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	ATLHPlayerController();

	// --- Aktionen, die von der Oberflaeche ausgeloest werden ---
	void StartNewGame();
	void ContinueGame();
	void SaveCurrentGame(bool bShowMessage = true);
	void OpenChapterOverview();
	void ReturnToMainMenu();
	void CloseOverlay();
	void QuitToDesktop();
	void ToggleLongText() { bShowLongText = !bShowLongText; }

	// --- Abfragen fuer die Oberflaeche ---
	ETLHUIState GetUIState() const { return UIState; }
	bool IsShowingLongText() const { return bShowLongText; }
	FText GetInteractPrompt() const;
	FText GetToastText() const { return ToastText; }
	bool HasToast() const { return ToastTimeLeft > 0.f; }
	void ShowToast(const FText& Text, float Seconds = 2.5f);

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	virtual void SetupInputComponent() override;
	virtual void PlayerTick(float DeltaTime) override;

	/** Maximale Entfernung (cm) zwischen Kamera und Informationspunkt. */
	UPROPERTY(EditDefaultsOnly, Category = "TLH")
	float InteractDistance = 380.f;

private:
	void OnInteractPressed();
	void OnMenuPressed();
	void OnOverviewPressed();
	void OnQuickSavePressed();

	void SetUIState(ETLHUIState NewState, FName InfoId = NAME_None);
	void UpdateFocusedInfoPoint();
	void RefreshInfoPoints();
	void MovePawnTo(const FVector& Location, const FRotator& Rotation);

	ETLHUIState UIState = ETLHUIState::MainMenu;
	ETLHUIState StateBeforeOverview = ETLHUIState::MainMenu;
	TWeakObjectPtr<ATLHInfoPoint> FocusedInfoPoint;

	TSharedPtr<SOverlay> RootWidget;
	TSharedPtr<SBox> OverlaySlot;

	FText ToastText;
	float ToastTimeLeft = 0.f;
	bool bShowLongText = false;
	bool bGameStarted = false;
};
