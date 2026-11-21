using UnrealBuildTool;

public class TheLastHumanityTarget : TargetRules
{
	public TheLastHumanityTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("TheLastHumanity");
	}
}
