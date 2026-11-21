using UnrealBuildTool;

public class TheLastHumanity : ModuleRules
{
	public TheLastHumanity(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		// Unterordner (Core/, World/, UI/, Save/) relativ zum Modul einbinden
		PublicIncludePaths.Add(ModuleDirectory);

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core", "CoreUObject", "Engine", "InputCore"
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"Slate", "SlateCore", "Json"
		});
	}
}
