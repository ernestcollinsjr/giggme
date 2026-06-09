// Centralized crew type list used across the Tours feature.
// The DB `crew_type` enum has the values below; ordering here drives UI.
export const CREW_TYPES = [
  "band_member",
  "band_members",
  "singer",
  "sound_tech",
  "sound_crew",
  "lighting_tech",
  "lighting_crew",
  "load_handler",
  "rigger",
] as const;

export type CrewType = (typeof CREW_TYPES)[number];

export const CREW_TYPE_LABELS: Record<CrewType, string> = {
  band_member: "Band Member",
  band_members: "Group Members",
  singer: "Singer",
  sound_tech: "Sound Tech",
  sound_crew: "Sound Crew",
  lighting_tech: "Lighting Tech",
  lighting_crew: "Lighting Crew",
  load_handler: "Load Handler",
  rigger: "Rigger",
};

// Options shown in dropdowns when assigning a new crew member.
// Legacy plural/crew values stay supported in the DB but are hidden from new picks.
export const CREW_TYPE_OPTIONS: CrewType[] = [
  "band_member",
  "singer",
  "sound_tech",
  "lighting_tech",
  "load_handler",
  "rigger",
];
