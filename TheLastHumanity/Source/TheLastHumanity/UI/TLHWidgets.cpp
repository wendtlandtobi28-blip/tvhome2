#include "UI/TLHWidgets.h"
#include "Core/TLHGameSubsystem.h"
#include "Core/TLHPlayerController.h"

#include "Styling/CoreStyle.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SCheckBox.h"
#include "Widgets/Input/SSlider.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/SNullWidget.h"
#include "Widgets/SOverlay.h"
#include "Widgets/Text/STextBlock.h"

namespace
{
	using FWeakPC = TWeakObjectPtr<ATLHPlayerController>;

	const FLinearColor Gold(0.96f, 0.82f, 0.55f);
	const FLinearColor Paper(0.93f, 0.91f, 0.86f);
	const FLinearColor Muted(0.62f, 0.60f, 0.56f);
	const FLinearColor Cyan(0.45f, 0.82f, 1.0f);

	FLinearColor WithAlpha(const FLinearColor& C, float A)
	{
		return FLinearColor(C.R, C.G, C.B, A);
	}

	FText T(const ATLHPlayerController* PC, const TCHAR* Key)
	{
		const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(PC);
		return Sub ? Sub->UI(Key) : FText::FromString(Key);
	}

	FSlateFontInfo Font(const ANSICHAR* Style, int32 Size)
	{
		return FCoreStyle::GetDefaultFontStyle(Style, Size);
	}

	const FSlateBrush* White()
	{
		return FCoreStyle::Get().GetBrush("WhiteBrush");
	}

	TSharedRef<SWidget> MakeButton(TAttribute<FText> Label, TFunction<void()> OnClick, bool bEnabled = true,
		float Width = 380.f, int32 FontSize = 17)
	{
		return SNew(SBox)
			.WidthOverride(Width)
			[
				SNew(SButton)
				.IsEnabled(bEnabled)
				.HAlign(HAlign_Center)
				.VAlign(VAlign_Center)
				.ContentPadding(FMargin(16.f, FontSize > 15 ? 10.f : 5.f))
				.OnClicked_Lambda([OnClick]()
				{
					if (OnClick)
					{
						OnClick();
					}
					return FReply::Handled();
				})
				[
					SNew(STextBlock)
					.Text(Label)
					.Font(Font("Bold", FontSize))
				]
			];
	}

	/** Abgedunkelter Vollbild-Hintergrund mit zentriertem Inhalt. */
	TSharedRef<SWidget> MakeScreen(TSharedRef<SWidget> Content, float Alpha)
	{
		return SNew(SBorder)
			.BorderImage(White())
			.BorderBackgroundColor(FLinearColor(0.01f, 0.012f, 0.02f, Alpha))
			.HAlign(HAlign_Center)
			.VAlign(VAlign_Center)
			.Padding(32.f)
			[
				Content
			];
	}

	/** Panel mit dunklem Hintergrund und farbigem Rahmen. */
	TSharedRef<SWidget> MakePanel(TSharedRef<SWidget> Content, const FLinearColor& Accent)
	{
		return SNew(SBorder)
			.BorderImage(White())
			.BorderBackgroundColor(Accent)
			.Padding(2.f)
			[
				SNew(SBorder)
				.BorderImage(White())
				.BorderBackgroundColor(FLinearColor(0.035f, 0.035f, 0.045f, 0.97f))
				.Padding(FMargin(36.f, 28.f))
				[
					Content
				]
			];
	}

	/** Zeile im Optionsmenue: Beschriftung links, Bedienelement rechts. */
	TSharedRef<SWidget> MakeOptionRow(const FText& Label, TSharedRef<SWidget> Control)
	{
		return SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
			[
				SNew(STextBlock).Text(Label).Font(Font("Regular", 17)).ColorAndOpacity(Paper)
			]
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
			[
				SNew(SBox).WidthOverride(320.f)
				[
					Control
				]
			];
	}
}

// ====================================================================== HUD

TSharedRef<SWidget> TLHWidgets::MakeHud(ATLHPlayerController* PC)
{
	const FWeakPC W(PC);
	const FText ControlsHint = T(PC, TEXT("hud.controls"));

	auto WhenPlaying = [W]()
	{
		return (W.IsValid() && W->GetUIState() == ETLHUIState::Playing) ? EVisibility::HitTestInvisible : EVisibility::Collapsed;
	};

	return SNew(SOverlay)
		.Visibility(EVisibility::SelfHitTestInvisible)

		// Fadenkreuz
		+ SOverlay::Slot().HAlign(HAlign_Center).VAlign(VAlign_Center)
		[
			SNew(SBox)
			.WidthOverride(6.f)
			.HeightOverride(6.f)
			.Visibility_Lambda(WhenPlaying)
			[
				SNew(SBorder)
				.BorderImage(White())
				.BorderBackgroundColor(FLinearColor(1.f, 1.f, 1.f, 0.75f))
			]
		]

		// Kapitel und Fortschritt (oben links)
		+ SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Top).Padding(24.f)
		[
			SNew(STextBlock)
			.Font(Font("Bold", 15))
			.ColorAndOpacity(WithAlpha(Gold, 0.85f))
			.Visibility_Lambda(WhenPlaying)
			.Text_Lambda([W]() { return W.IsValid() ? W->GetChapterLine() : FText::GetEmpty(); })
		]

		// Interaktionshinweis
		+ SOverlay::Slot().HAlign(HAlign_Center).VAlign(VAlign_Bottom).Padding(FMargin(0.f, 0.f, 0.f, 140.f))
		[
			SNew(SBorder)
			.BorderImage(White())
			.BorderBackgroundColor(FLinearColor(0.f, 0.f, 0.f, 0.6f))
			.Padding(FMargin(18.f, 8.f))
			.Visibility_Lambda([W]()
			{
				return (W.IsValid() && !W->GetInteractPrompt().IsEmpty()) ? EVisibility::HitTestInvisible : EVisibility::Collapsed;
			})
			[
				SNew(STextBlock)
				.Font(Font("Bold", 18))
				.ColorAndOpacity(Gold)
				.Text_Lambda([W]() { return W.IsValid() ? W->GetInteractPrompt() : FText::GetEmpty(); })
			]
		]

		// Meldungen (Speichern, Entdeckung, Kapitelwechsel ...)
		+ SOverlay::Slot().HAlign(HAlign_Center).VAlign(VAlign_Top).Padding(FMargin(0.f, 48.f, 0.f, 0.f))
		[
			SNew(SBorder)
			.BorderImage(White())
			.BorderBackgroundColor(FLinearColor(0.02f, 0.06f, 0.09f, 0.85f))
			.Padding(FMargin(22.f, 10.f))
			.Visibility_Lambda([W]() { return (W.IsValid() && W->HasToast()) ? EVisibility::HitTestInvisible : EVisibility::Collapsed; })
			[
				SNew(STextBlock)
				.Font(Font("Regular", 16))
				.ColorAndOpacity(Cyan)
				.Text_Lambda([W]() { return W.IsValid() ? W->GetToastText() : FText::GetEmpty(); })
			]
		]

		// Steuerungshinweis (abschaltbar in den Optionen)
		+ SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Bottom).Padding(24.f)
		[
			SNew(STextBlock)
			.Font(Font("Regular", 12))
			.ColorAndOpacity(FLinearColor(1.f, 1.f, 1.f, 0.55f))
			.Text(ControlsHint)
			.Visibility_Lambda([W]()
			{
				const UTLHGameSubsystem* Sub = W.IsValid() ? UTLHGameSubsystem::Get(W.Get()) : nullptr;
				const bool bShow = W.IsValid() && W->GetUIState() == ETLHUIState::Playing && Sub && Sub->GetSettings().bShowControlsHint;
				return bShow ? EVisibility::HitTestInvisible : EVisibility::Collapsed;
			})
		];
}

// ====================================================================== Menue

TSharedRef<SWidget> TLHWidgets::MakeMenu(ATLHPlayerController* PC, bool bPauseMenu)
{
	const FWeakPC W(PC);
	const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(PC);
	const bool bHasSave = Sub && Sub->HasSaveGame();

	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);

	Box->AddSlot().AutoHeight().HAlign(HAlign_Center)
	[
		SNew(STextBlock).Text(T(PC, TEXT("menu.title"))).Font(Font("Bold", 54)).ColorAndOpacity(Gold)
	];
	Box->AddSlot().AutoHeight().HAlign(HAlign_Center).Padding(FMargin(0.f, 4.f, 0.f, 36.f))
	[
		SNew(STextBlock).Text(T(PC, bPauseMenu ? TEXT("menu.pause_subtitle") : TEXT("menu.subtitle"))).Font(Font("Regular", 20)).ColorAndOpacity(Paper)
	];

	auto Add = [&Box](TSharedRef<SWidget> Widget)
	{
		Box->AddSlot().AutoHeight().HAlign(HAlign_Center).Padding(FMargin(0.f, 5.f))[Widget];
	};

	if (bPauseMenu)
	{
		Add(MakeButton(T(PC, TEXT("menu.resume")), [W]() { if (W.IsValid()) { W->CloseOverlay(); } }));
		Add(MakeButton(T(PC, TEXT("menu.save")), [W]() { if (W.IsValid()) { W->SaveCurrentGame(true); } }));
		Add(MakeButton(T(PC, TEXT("menu.load")), [W]() { if (W.IsValid()) { W->ContinueGame(); } }, bHasSave));
		Add(MakeButton(T(PC, TEXT("menu.chapters")), [W]() { if (W.IsValid()) { W->OpenChapterOverview(); } }));
		Add(MakeButton(T(PC, TEXT("menu.options")), [W]() { if (W.IsValid()) { W->OpenOptions(); } }));
		Add(MakeButton(T(PC, TEXT("menu.mainmenu")), [W]() { if (W.IsValid()) { W->ReturnToMainMenu(); } }));
	}
	else
	{
		Add(MakeButton(T(PC, TEXT("menu.new")), [W]() { if (W.IsValid()) { W->StartNewGame(); } }));
		Add(MakeButton(T(PC, TEXT("menu.continue")), [W]() { if (W.IsValid()) { W->ContinueGame(); } }, bHasSave));
		Add(MakeButton(T(PC, TEXT("menu.chapters")), [W]() { if (W.IsValid()) { W->OpenChapterOverview(); } }));
		Add(MakeButton(T(PC, TEXT("menu.options")), [W]() { if (W.IsValid()) { W->OpenOptions(); } }));
	}
	Add(MakeButton(T(PC, TEXT("menu.quit")), [W]() { if (W.IsValid()) { W->QuitToDesktop(); } }));

	Box->AddSlot().AutoHeight().HAlign(HAlign_Center).Padding(FMargin(0.f, 36.f, 0.f, 0.f))
	[
		SNew(STextBlock).Text(T(PC, TEXT("menu.controls"))).Font(Font("Regular", 13)).ColorAndOpacity(Muted).Justification(ETextJustify::Center)
	];

	if (!bPauseMenu)
	{
		Box->AddSlot().AutoHeight().HAlign(HAlign_Center).Padding(FMargin(0.f, 8.f, 0.f, 0.f))
		[
			SNew(STextBlock)
			.Text(T(PC, bHasSave ? TEXT("menu.newgame_warning") : TEXT("menu.nosave_hint")))
			.Font(Font("Italic", 12))
			.ColorAndOpacity(Muted)
		];
	}

	return MakeScreen(Box, bPauseMenu ? 0.7f : 0.82f);
}

// ====================================================================== Informationsfenster

TSharedRef<SWidget> TLHWidgets::MakeInfoPanel(ATLHPlayerController* PC, FName InfoId)
{
	const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(PC);
	const FTLHChapter* Chapter = nullptr;
	const FTLHInfoEntry* Info = Sub ? Sub->FindInfo(InfoId, &Chapter) : nullptr;
	if (!Info || !Chapter)
	{
		return SNullWidget::NullWidget;
	}

	const FWeakPC W(PC);
	const FText ShortText = Info->ShortText;
	const FText LongText = Info->LongText;
	const FText LabelShort = T(PC, TEXT("info.label_short"));
	const FText LabelLong = T(PC, TEXT("info.label_long"));
	const FText ToggleToLong = T(PC, TEXT("info.toggle_long"));
	const FText ToggleToShort = T(PC, TEXT("info.toggle_short"));
	const bool bFiction = Info->Kind == FName(TEXT("fiktion"));
	const FText KindText = T(PC, bFiction ? TEXT("info.kind_fiction") : TEXT("info.kind_fact"));

	FFormatOrderedArguments ChapterArgs;
	ChapterArgs.Add(FText::AsNumber(Chapter->Number));
	ChapterArgs.Add(Chapter->Title);
	const FText ChapterLine = Sub->UIFormat(TEXT("info.chapter"), ChapterArgs);

	TSharedRef<SWidget> Content =
		SNew(SBox)
		.WidthOverride(920.f)
		.MaxDesiredHeight(720.f)
		[
			SNew(SVerticalBox)

			+ SVerticalBox::Slot().AutoHeight()
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().FillWidth(1.f)
				[
					SNew(STextBlock).Text(ChapterLine).Font(Font("Regular", 14)).ColorAndOpacity(Muted)
				]
				+ SHorizontalBox::Slot().AutoWidth()
				[
					SNew(STextBlock).Text(KindText).Font(Font("Bold", 13)).ColorAndOpacity(bFiction ? Gold : Cyan)
				]
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(FMargin(0.f, 6.f, 0.f, 4.f))
			[
				SNew(STextBlock).Text(Info->Title).Font(Font("Bold", 32)).ColorAndOpacity(Gold).AutoWrapText(true)
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(FMargin(0.f, 0.f, 0.f, 14.f))
			[
				SNew(STextBlock)
				.Font(Font("Italic", 14))
				.ColorAndOpacity(Muted)
				.Text_Lambda([W, LabelShort, LabelLong]() { return (W.IsValid() && W->IsShowingLongText()) ? LabelLong : LabelShort; })
			]

			+ SVerticalBox::Slot().FillHeight(1.f)
			[
				SNew(SScrollBox)
				+ SScrollBox::Slot()
				[
					SNew(STextBlock)
					.Font(Font("Regular", 18))
					.ColorAndOpacity(Paper)
					.AutoWrapText(true)
					.LineHeightPercentage(1.15f)
					.Text_Lambda([W, ShortText, LongText]() { return (W.IsValid() && W->IsShowingLongText()) ? LongText : ShortText; })
				]
			]

			+ SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Right).Padding(FMargin(0.f, 20.f, 0.f, 0.f))
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth().Padding(FMargin(0.f, 0.f, 12.f, 0.f))
				[
					MakeButton(
						TAttribute<FText>::CreateLambda([W, ToggleToLong, ToggleToShort]()
						{
							return (W.IsValid() && W->IsShowingLongText()) ? ToggleToShort : ToggleToLong;
						}),
						[W]() { if (W.IsValid()) { W->ToggleLongText(); } }, true, 300.f)
				]
				+ SHorizontalBox::Slot().AutoWidth()
				[
					MakeButton(T(PC, TEXT("info.close")), [W]() { if (W.IsValid()) { W->CloseOverlay(); } }, true, 220.f)
				]
			]
		];

	return MakeScreen(MakePanel(Content, Gold), 0.55f);
}

// ====================================================================== Kapiteluebersicht

TSharedRef<SWidget> TLHWidgets::MakeChapterOverview(ATLHPlayerController* PC)
{
	const FWeakPC W(PC);
	const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(PC);
	const bool bInGame = PC && PC->HasActiveGame();

	TSharedRef<SVerticalBox> List = SNew(SVerticalBox);
	if (Sub)
	{
		FFormatOrderedArguments TotalArgs;
		TotalArgs.Add(FText::AsNumber(Sub->GetTotalDiscovered()));
		TotalArgs.Add(FText::AsNumber(Sub->GetTotalInfoCount()));
		List->AddSlot().AutoHeight().Padding(FMargin(0.f, 0.f, 0.f, 12.f))
		[
			SNew(STextBlock).Text(Sub->UIFormat(TEXT("chapters.total"), TotalArgs)).Font(Font("Regular", 15)).ColorAndOpacity(Cyan)
		];

		const TArray<FTLHChapter>& Chapters = Sub->GetChapters();
		for (int32 Index = 0; Index < Chapters.Num(); ++Index)
		{
			const FTLHChapter& Chapter = Chapters[Index];
			const bool bUnlocked = Sub->IsChapterUnlocked(Chapter);
			const bool bComplete = Sub->IsChapterComplete(Chapter);
			const bool bCurrent = bInGame && Sub->GetCurrentChapterId() == Chapter.Id;
			const float Alpha = bUnlocked ? 1.f : 0.45f;

			FFormatOrderedArguments HeadArgs;
			HeadArgs.Add(FText::AsNumber(Chapter.Number));
			HeadArgs.Add(Chapter.Title);

			FText Status;
			if (!Chapter.bAvailable)
			{
				Status = Sub->UI(TEXT("chapters.unavailable"));
			}
			else if (!bUnlocked)
			{
				FFormatOrderedArguments PrevArgs;
				PrevArgs.Add(FText::AsNumber(Index > 0 ? Chapters[Index - 1].Number : 0));
				Status = Sub->UIFormat(TEXT("chapters.locked"), PrevArgs);
			}
			else
			{
				FFormatOrderedArguments CountArgs;
				CountArgs.Add(FText::AsNumber(Sub->CountDiscovered(Chapter)));
				CountArgs.Add(FText::AsNumber(Chapter.InfoPoints.Num()));
				Status = Sub->UIFormat(bComplete ? TEXT("chapters.complete") : TEXT("chapters.discovered"), CountArgs);
			}

			TSharedRef<SVerticalBox> Card = SNew(SVerticalBox);
			Card->AddSlot().AutoHeight()
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
				[
					SNew(STextBlock).Text(Sub->UIFormat(TEXT("chapters.heading"), HeadArgs)).Font(Font("Bold", 20))
					.ColorAndOpacity(WithAlpha(Gold, Alpha))
				]
				+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(FMargin(12.f, 0.f, 0.f, 0.f))
				[
					SNew(STextBlock).Text(bCurrent ? Sub->UI(TEXT("chapters.current")) : Status).Font(Font("Regular", 14))
					.ColorAndOpacity(bUnlocked ? Cyan : Muted)
				]
			];
			Card->AddSlot().AutoHeight().Padding(FMargin(0.f, 2.f))
			[
				SNew(STextBlock).Text(Chapter.Era).Font(Font("Italic", 13)).ColorAndOpacity(WithAlpha(Muted, Alpha))
			];
			Card->AddSlot().AutoHeight()
			[
				SNew(STextBlock).Text(Chapter.Summary).Font(Font("Regular", 15)).AutoWrapText(true)
				.ColorAndOpacity(WithAlpha(Paper, Alpha))
			];

			// Bereits entdeckte Erkenntnisse: anklicken zum erneuten Lesen
			for (const FTLHInfoEntry& Entry : Chapter.InfoPoints)
			{
				if (!Sub->IsDiscovered(Entry.Id))
				{
					continue;
				}
				const FName EntryId = Entry.Id;
				Card->AddSlot().AutoHeight().HAlign(HAlign_Left).Padding(FMargin(0.f, 3.f, 0.f, 0.f))
				[
					MakeButton(Entry.Title, [W, EntryId]() { if (W.IsValid()) { W->OpenInfo(EntryId); } }, true, 520.f, 13)
				];
			}

			if (bInGame && bUnlocked && !bCurrent)
			{
				const FName ChapterId = Chapter.Id;
				Card->AddSlot().AutoHeight().HAlign(HAlign_Right).Padding(FMargin(0.f, 8.f, 0.f, 0.f))
				[
					MakeButton(T(PC, TEXT("chapters.enter")), [W, ChapterId]() { if (W.IsValid()) { W->TravelToChapter(ChapterId); } }, true, 260.f, 15)
				];
			}

			List->AddSlot().AutoHeight().Padding(FMargin(0.f, 0.f, 0.f, 10.f))
			[
				SNew(SBorder)
				.BorderImage(White())
				.BorderBackgroundColor(bCurrent ? FLinearColor(0.10f, 0.12f, 0.14f, 0.95f)
					: (bUnlocked ? FLinearColor(0.09f, 0.08f, 0.06f, 0.95f) : FLinearColor(0.05f, 0.05f, 0.06f, 0.9f)))
				.Padding(FMargin(18.f, 12.f))
				[
					Card
				]
			];
		}
	}

	TSharedRef<SWidget> Content =
		SNew(SBox)
		.WidthOverride(960.f)
		.MaxDesiredHeight(780.f)
		[
			SNew(SVerticalBox)
			+ SVerticalBox::Slot().AutoHeight().Padding(FMargin(0.f, 0.f, 0.f, 8.f))
			[
				SNew(STextBlock).Text(T(PC, TEXT("chapters.title"))).Font(Font("Bold", 34)).ColorAndOpacity(Gold)
			]
			+ SVerticalBox::Slot().FillHeight(1.f)
			[
				SNew(SScrollBox)
				+ SScrollBox::Slot()
				[
					List
				]
			]
			+ SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Right).Padding(FMargin(0.f, 16.f, 0.f, 0.f))
			[
				MakeButton(T(PC, TEXT("chapters.back")), [W]() { if (W.IsValid()) { W->CloseOverlay(); } }, true, 220.f)
			]
		];

	return MakeScreen(MakePanel(Content, Gold), 0.78f);
}

// ====================================================================== Optionen

TSharedRef<SWidget> TLHWidgets::MakeOptions(ATLHPlayerController* PC)
{
	const FWeakPC W(PC);

	// Liest die aktuellen Einstellungen, aendert einen Wert und wendet sie an.
	auto Modify = [W](TFunction<void(FTLHSettings&)> Change)
	{
		if (!W.IsValid())
		{
			return;
		}
		if (const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(W.Get()))
		{
			FTLHSettings S = Sub->GetSettings();
			Change(S);
			W->ApplySettings(S);
		}
	};
	auto Current = [W]() -> FTLHSettings
	{
		const UTLHGameSubsystem* Sub = W.IsValid() ? UTLHGameSubsystem::Get(W.Get()) : nullptr;
		return Sub ? Sub->GetSettings() : FTLHSettings();
	};

	auto MakeCheck = [Modify, Current](TFunction<bool(const FTLHSettings&)> Get, TFunction<void(FTLHSettings&, bool)> Set) -> TSharedRef<SWidget>
	{
		return SNew(SCheckBox)
			.IsChecked_Lambda([Current, Get]() { return Get(Current()) ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
			.OnCheckStateChanged_Lambda([Modify, Set](ECheckBoxState State)
			{
				const bool bOn = State == ECheckBoxState::Checked;
				Modify([Set, bOn](FTLHSettings& S) { Set(S, bOn); });
			});
	};

	const float SensRange = FTLHSettings::MaxSensitivity - FTLHSettings::MinSensitivity;
	const float FovRange = FTLHSettings::MaxFov - FTLHSettings::MinFov;

	TSharedRef<SWidget> SensitivitySlider =
		SNew(SHorizontalBox)
		+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
		[
			SNew(SSlider)
			.Value_Lambda([Current, SensRange]() { return (Current().MouseSensitivity - FTLHSettings::MinSensitivity) / SensRange; })
			.OnValueChanged_Lambda([Modify, SensRange](float V)
			{
				Modify([V, SensRange](FTLHSettings& S) { S.MouseSensitivity = FTLHSettings::MinSensitivity + V * SensRange; });
			})
		]
		+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(FMargin(12.f, 0.f, 0.f, 0.f))
		[
			SNew(SBox).WidthOverride(50.f)
			[
				SNew(STextBlock).Font(Font("Regular", 15)).ColorAndOpacity(Gold)
				.Text_Lambda([Current]() { return FText::AsNumber(FMath::RoundToInt(Current().MouseSensitivity * 10.f) / 10.f); })
			]
		];

	TSharedRef<SWidget> FovSlider =
		SNew(SHorizontalBox)
		+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
		[
			SNew(SSlider)
			.Value_Lambda([Current, FovRange]() { return (Current().FieldOfView - FTLHSettings::MinFov) / FovRange; })
			.OnValueChanged_Lambda([Modify, FovRange](float V)
			{
				Modify([V, FovRange](FTLHSettings& S) { S.FieldOfView = FMath::RoundToFloat(FTLHSettings::MinFov + V * FovRange); });
			})
		]
		+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(FMargin(12.f, 0.f, 0.f, 0.f))
		[
			SNew(SBox).WidthOverride(50.f)
			[
				SNew(STextBlock).Font(Font("Regular", 15)).ColorAndOpacity(Gold)
				.Text_Lambda([Current]() { return FText::AsNumber(FMath::RoundToInt(Current().FieldOfView)); })
			]
		];

	TSharedRef<SVerticalBox> Box = SNew(SVerticalBox);
	Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 0.f, 0.f, 20.f))
	[
		SNew(STextBlock).Text(T(PC, TEXT("options.title"))).Font(Font("Bold", 34)).ColorAndOpacity(Gold)
	];
	auto AddRow = [&Box](const FText& Label, TSharedRef<SWidget> Control)
	{
		Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 8.f))[MakeOptionRow(Label, Control)];
	};
	AddRow(T(PC, TEXT("options.sensitivity")), SensitivitySlider);
	AddRow(T(PC, TEXT("options.fov")), FovSlider);
	AddRow(T(PC, TEXT("options.invert_y")),
		MakeCheck([](const FTLHSettings& S) { return S.bInvertY; }, [](FTLHSettings& S, bool b) { S.bInvertY = b; }));
	AddRow(T(PC, TEXT("options.controls_hint")),
		MakeCheck([](const FTLHSettings& S) { return S.bShowControlsHint; }, [](FTLHSettings& S, bool b) { S.bShowControlsHint = b; }));
	AddRow(T(PC, TEXT("options.unlock_all")),
		MakeCheck([](const FTLHSettings& S) { return S.bUnlockAllChapters; }, [](FTLHSettings& S, bool b) { S.bUnlockAllChapters = b; }));

	Box->AddSlot().AutoHeight().Padding(FMargin(0.f, 4.f, 0.f, 0.f))
	[
		SNew(STextBlock).Text(T(PC, TEXT("options.unlock_all_hint"))).Font(Font("Italic", 13)).ColorAndOpacity(Muted).AutoWrapText(true)
	];
	Box->AddSlot().AutoHeight().HAlign(HAlign_Right).Padding(FMargin(0.f, 24.f, 0.f, 0.f))
	[
		MakeButton(T(PC, TEXT("options.back")), [W]() { if (W.IsValid()) { W->CloseOverlay(); } }, true, 260.f)
	];

	TSharedRef<SWidget> Content = SNew(SBox).WidthOverride(760.f)[Box];
	return MakeScreen(MakePanel(Content, Gold), 0.8f);
}

// ====================================================================== Abspann

TSharedRef<SWidget> TLHWidgets::MakeEnding(ATLHPlayerController* PC)
{
	const FWeakPC W(PC);
	const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(PC);
	if (!Sub)
	{
		return SNullWidget::NullWidget;
	}

	FFormatOrderedArguments Args;
	Args.Add(FText::AsNumber(Sub->GetTotalDiscovered()));
	Args.Add(FText::AsNumber(Sub->GetTotalInfoCount()));
	const FText Stats = Sub->UIFormat(TEXT("ending.stats"), Args);

	TSharedRef<SWidget> Content =
		SNew(SBox)
		.WidthOverride(880.f)
		.MaxDesiredHeight(760.f)
		[
			SNew(SVerticalBox)
			+ SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center)
			[
				SNew(STextBlock).Text(Sub->GetEndingTitle()).Font(Font("Bold", 40)).ColorAndOpacity(Gold).Justification(ETextJustify::Center).AutoWrapText(true)
			]
			+ SVerticalBox::Slot().FillHeight(1.f).Padding(FMargin(0.f, 20.f))
			[
				SNew(SScrollBox)
				+ SScrollBox::Slot()
				[
					SNew(STextBlock).Text(Sub->GetEndingText()).Font(Font("Regular", 19)).ColorAndOpacity(Paper)
					.AutoWrapText(true).LineHeightPercentage(1.2f).Justification(ETextJustify::Center)
				]
			]
			+ SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center).Padding(FMargin(0.f, 0.f, 0.f, 16.f))
			[
				SNew(STextBlock).Text(Stats).Font(Font("Italic", 15)).ColorAndOpacity(Cyan)
			]
			+ SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center)
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth().Padding(FMargin(0.f, 0.f, 12.f, 0.f))
				[
					MakeButton(T(PC, TEXT("ending.continue")), [W]() { if (W.IsValid()) { W->CloseOverlay(); } }, true, 300.f)
				]
				+ SHorizontalBox::Slot().AutoWidth()
				[
					MakeButton(T(PC, TEXT("ending.mainmenu")), [W]() { if (W.IsValid()) { W->ReturnToMainMenu(); } }, true, 300.f)
				]
			]
		];

	return MakeScreen(MakePanel(Content, Cyan), 0.9f);
}
