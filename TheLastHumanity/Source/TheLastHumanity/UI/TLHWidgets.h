#pragma once

#include "CoreMinimal.h"
#include "Widgets/SWidget.h"

class ATLHPlayerController;

/**
 * Slate-Oberflaeche des Prototyps (rein in C++, ohne UMG-Assets).
 * Alle sichtbaren Texte kommen aus dem Abschnitt "ui" der Inhaltsdatei.
 */
namespace TLHWidgets
{
	TSharedRef<SWidget> MakeHud(ATLHPlayerController* PC);
	TSharedRef<SWidget> MakeMenu(ATLHPlayerController* PC, bool bPauseMenu);
	TSharedRef<SWidget> MakeInfoPanel(ATLHPlayerController* PC, FName InfoId);
	TSharedRef<SWidget> MakeChapterOverview(ATLHPlayerController* PC);
}
