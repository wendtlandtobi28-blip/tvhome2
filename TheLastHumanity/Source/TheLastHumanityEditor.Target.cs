using UnrealBuildTool;

public class TheLastHumanityEditorTarget : TargetRules
{
	public TheLastHumanityEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("TheLastHumanity");
	}
}
