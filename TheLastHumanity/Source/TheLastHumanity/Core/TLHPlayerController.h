#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "TLHPlayerController.generated.h"

class ATLHInteractable;
class ATLHHallBuilder;
class SBox;
class SOverlay;
struct FTLHSettings;

UENUM()
enum class ETLHUIState : uint8
{
	MainMenu,
	Playing,
	PauseMenu,
	InfoPanel,
	ChapterOverview,
	Options,
	Ending
};

/**
 * Steuert Spielzustand und Benutzeroberflaeche:
 * Haupt-/Pausenmenue, Informationsfenster, Kapiteluebersicht, Optionen, Abspann, HUD,
 * Interaktion (Informationspunkte, Portal) und Kapitelwechsel.
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
	void OpenOptions();
	void OpenInfo(FName InfoId);
	void TravelToChapter(FName ChapterId);
	void ReturnToMainMenu();
	void CloseOverlay();
	void QuitToDesktop();
	void ToggleLongText() { bShowLongText = !bShowLongText; }
	void ApplySettings(const FTLHSettings& NewSettings);

	// --- Abfragen fuer die Oberflaeche ---
	ETLHUIState GetUIState() const { return UIState; }
	bool HasActiveGame() const { return bGameStarted; }
	bool IsShowingLongText() const { return bShowLongText; }
	FText GetInteractPrompt() const;
	FText GetChapterLine() const;
	FText GetToastText() const { return ToastText; }
	bool HasToast() const { return ToastTimeLeft > 0.f; }
	void ShowToast(const FText& Text, float Seconds = 3.f);

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	virtual void SetupInputComponent() override;
	virtual void PlayerTick(float DeltaTime) override;

	/** Maximale Entfernung (cm) zwischen Kamera und Interaktionsobjekt. */
	UPROPERTY(EditDefaultsOnly, Category = "TLH")
	float InteractDistance = 380.f;

private:
	void OnInteractPressed();
	void OnMenuPressed();
	void OnOverviewPressed();
	void OnQuickSavePressed();

	void SetUIState(ETLHUIState NewState);
	void UpdateFocus();
	void RefreshWorldState();
	void UsePortal();
	void ShowEnding();
	void EnsureHallForCurrentChapter();
	ATLHHallBuilder* FindHallBuilder() const;
	void MovePawnTo(const FVector& Location, const FRotator& Rotation);

	ETLHUIState UIState = ETLHUIState::MainMenu;
	ETLHUIState ReturnFromOverview = ETLHUIState::MainMenu;
	ETLHUIState ReturnFromOptions = ETLHUIState::MainMenu;
	ETLHUIState ReturnFromInfo = ETLHUIState::Playing;
	FName OpenInfoId;
	TWeakObjectPtr<ATLHInteractable> Focused;

	TSharedPtr<SOverlay> RootWidget;
	TSharedPtr<SBox> OverlaySlot;

	FText ToastText;
	float ToastTimeLeft = 0.f;
	bool bShowLongText = false;
	bool bGameStarted = false;
};
