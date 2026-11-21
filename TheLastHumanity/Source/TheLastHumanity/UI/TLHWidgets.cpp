#include "UI/TLHWidgets.h"
#include "Core/TLHGameSubsystem.h"
#include "Core/TLHPlayerController.h"

#include "Styling/CoreStyle.h"
#include "Widgets/Input/SButton.h"
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

	TSharedRef<SWidget> MakeButton(TAttribute<FText> Label, TFunction<void()> OnClick, bool bEnabled = true, float Width = 380.f)
	{
		return SNew(SBox)
			.WidthOverride(Width)
			[
				SNew(SButton)
				.IsEnabled(bEnabled)
				.HAlign(HAlign_Center)
				.VAlign(VAlign_Center)
				.ContentPadding(FMargin(16.f, 10.f))
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
					.Font(Font("Bold", 17))
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

	/** Panel mit dunklem Hintergrund und Rahmenfarbe. */
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
}

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

		// Meldungen (Speichern, Entdeckung ...)
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

		// Steuerungshinweis
		+ SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Bottom).Padding(24.f)
		[
			SNew(STextBlock)
			.Font(Font("Regular", 12))
			.ColorAndOpacity(FLinearColor(1.f, 1.f, 1.f, 0.55f))
			.Text(ControlsHint)
			.Visibility_Lambda(WhenPlaying)
		];
}

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
		Add(MakeButton(T(PC, TEXT("menu.mainmenu")), [W]() { if (W.IsValid()) { W->ReturnToMainMenu(); } }));
	}
	else
	{
		Add(MakeButton(T(PC, TEXT("menu.new")), [W]() { if (W.IsValid()) { W->StartNewGame(); } }));
		Add(MakeButton(T(PC, TEXT("menu.continue")), [W]() { if (W.IsValid()) { W->ContinueGame(); } }, bHasSave));
		Add(MakeButton(T(PC, TEXT("menu.chapters")), [W]() { if (W.IsValid()) { W->OpenChapterOverview(); } }));
	}
	Add(MakeButton(T(PC, TEXT("menu.quit")), [W]() { if (W.IsValid()) { W->QuitToDesktop(); } }));

	Box->AddSlot().AutoHeight().HAlign(HAlign_Center).Padding(FMargin(0.f, 36.f, 0.f, 0.f))
	[
		SNew(STextBlock).Text(T(PC, TEXT("menu.controls"))).Font(Font("Regular", 13)).ColorAndOpacity(Muted).Justification(ETextJustify::Center)
	];

	if (!bHasSave && !bPauseMenu)
	{
		Box->AddSlot().AutoHeight().HAlign(HAlign_Center).Padding(FMargin(0.f, 8.f, 0.f, 0.f))
		[
			SNew(STextBlock).Text(T(PC, TEXT("menu.nosave_hint"))).Font(Font("Italic", 12)).ColorAndOpacity(Muted)
		];
	}

	return MakeScreen(Box, bPauseMenu ? 0.7f : 0.82f);
}

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
	const FText KindText = T(PC, Info->Kind == FName(TEXT("fiktion")) ? TEXT("info.kind_fiction") : TEXT("info.kind_fact"));

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
					SNew(STextBlock).Text(KindText).Font(Font("Bold", 13)).ColorAndOpacity(Cyan)
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

TSharedRef<SWidget> TLHWidgets::MakeChapterOverview(ATLHPlayerController* PC)
{
	const FWeakPC W(PC);
	const UTLHGameSubsystem* Sub = UTLHGameSubsystem::Get(PC);

	TSharedRef<SVerticalBox> List = SNew(SVerticalBox);
	if (Sub)
	{
		for (const FTLHChapter& Chapter : Sub->GetChapters())
		{
			const bool bOpen = Chapter.bAvailable;
			const int32 Found = Sub->CountDiscovered(Chapter);

			FFormatOrderedArguments HeadArgs;
			HeadArgs.Add(FText::AsNumber(Chapter.Number));
			HeadArgs.Add(Chapter.Title);

			FText Status;
			if (bOpen)
			{
				FFormatOrderedArguments CountArgs;
				CountArgs.Add(FText::AsNumber(Found));
				CountArgs.Add(FText::AsNumber(Chapter.InfoPoints.Num()));
				Status = Sub->UIFormat(TEXT("chapters.discovered"), CountArgs);
			}
			else
			{
				Status = Sub->UI(TEXT("chapters.locked"));
			}

			const float Alpha = bOpen ? 1.f : 0.45f;
			List->AddSlot().AutoHeight().Padding(FMargin(0.f, 0.f, 0.f, 10.f))
			[
				SNew(SBorder)
				.BorderImage(White())
				.BorderBackgroundColor(bOpen ? FLinearColor(0.09f, 0.08f, 0.06f, 0.95f) : FLinearColor(0.05f, 0.05f, 0.06f, 0.9f))
				.Padding(FMargin(18.f, 12.f))
				[
					SNew(SVerticalBox)
					+ SVerticalBox::Slot().AutoHeight()
					[
						SNew(SHorizontalBox)
						+ SHorizontalBox::Slot().FillWidth(1.f)
						[
							SNew(STextBlock).Text(Sub->UIFormat(TEXT("chapters.heading"), HeadArgs)).Font(Font("Bold", 20))
							.ColorAndOpacity(FLinearColor(Gold.R, Gold.G, Gold.B, Alpha))
						]
						+ SHorizontalBox::Slot().AutoWidth()
						[
							SNew(STextBlock).Text(Status).Font(Font("Regular", 14))
							.ColorAndOpacity(bOpen ? Cyan : Muted)
						]
					]
					+ SVerticalBox::Slot().AutoHeight().Padding(FMargin(0.f, 2.f))
					[
						SNew(STextBlock).Text(Chapter.Era).Font(Font("Italic", 13)).ColorAndOpacity(FLinearColor(Muted.R, Muted.G, Muted.B, Alpha))
					]
					+ SVerticalBox::Slot().AutoHeight()
					[
						SNew(STextBlock).Text(Chapter.Summary).Font(Font("Regular", 15)).AutoWrapText(true)
						.ColorAndOpacity(FLinearColor(Paper.R, Paper.G, Paper.B, Alpha))
					]
				]
			];
		}
	}

	TSharedRef<SWidget> Content =
		SNew(SBox)
		.WidthOverride(940.f)
		.MaxDesiredHeight(760.f)
		[
			SNew(SVerticalBox)
			+ SVerticalBox::Slot().AutoHeight().Padding(FMargin(0.f, 0.f, 0.f, 16.f))
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

	return MakeScreen(MakePanel(Content, Gold), 0.75f);
}
