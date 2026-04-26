import type { GraphNode, GraphNodeType } from "@/shared/types";

export type NodeCategory = "trigger" | "action" | "data";

export interface NodeCatalogEntry {
  /** Discriminator on GraphNode — also used as the serialized type. */
  type: GraphNodeType;
  category: NodeCategory;
  /** Display label shown to the user. */
  label: string;
  /** Tooltip / palette description. */
  description: string;
  /**
   * Whether this node is exposed in the MVP 3 palette.
   *  - true:  shown in palette + editable on canvas
   *  - false: defined in schema but disabled for now (e.g. scene change before multi-scene support).
   */
  enabled: boolean;
  /** Defaults for required fields (id / graphPosition / label are filled by callers). */
  defaultPayload: () => Omit<GraphNode, "id" | "graphPosition" | "label">;
}

const entries: NodeCatalogEntry[] = [
  // --- Trigger ---
  {
    type: "event.targetFound",
    category: "trigger",
    label: "Target Found",
    description: "Image target detected by camera",
    enabled: true,
    defaultPayload: () => ({ type: "event.targetFound" }),
  },
  {
    type: "event.targetLost",
    category: "trigger",
    label: "Target Lost",
    description: "Image target left the camera frame",
    enabled: true,
    defaultPayload: () => ({ type: "event.targetLost" }),
  },
  {
    type: "event.tap",
    category: "trigger",
    label: "Object Tap",
    description: "User tapped a specific scene object",
    enabled: true,
    defaultPayload: () => ({ type: "event.tap", objectId: "" }),
  },
  {
    type: "event.timeElapsed",
    category: "trigger",
    label: "Time Elapsed",
    description: "N seconds after target was found",
    enabled: true,
    defaultPayload: () => ({ type: "event.timeElapsed", seconds: 1 }),
  },
  {
    type: "event.videoEnded",
    category: "trigger",
    label: "Video Ended",
    description: "A video object finished playback",
    enabled: true,
    defaultPayload: () => ({ type: "event.videoEnded", objectId: "" }),
  },
  {
    type: "event.soundEnded",
    category: "trigger",
    label: "Sound Ended",
    description: "A sound object finished playback",
    enabled: true,
    defaultPayload: () => ({ type: "event.soundEnded", objectId: "" }),
  },

  // --- Action ---
  {
    type: "action.show",
    category: "action",
    label: "Show",
    description: "Make the object visible",
    enabled: true,
    defaultPayload: () => ({ type: "action.show", objectId: "" }),
  },
  {
    type: "action.hide",
    category: "action",
    label: "Hide",
    description: "Hide the object",
    enabled: true,
    defaultPayload: () => ({ type: "action.hide", objectId: "" }),
  },
  {
    type: "action.playVideo",
    category: "action",
    label: "Play Video",
    description: "Play the video bound to this object",
    enabled: true,
    defaultPayload: () => ({ type: "action.playVideo", objectId: "" }),
  },
  {
    type: "action.playSound",
    category: "action",
    label: "Play Sound",
    description: "Play an audio asset once",
    enabled: true,
    defaultPayload: () => ({ type: "action.playSound", src: "" }),
  },
  {
    type: "action.playAnimation",
    category: "action",
    label: "Play Animation",
    description: "Play an animation track on the GLB model",
    enabled: true,
    defaultPayload: () => ({ type: "action.playAnimation", objectId: "" }),
  },
  {
    type: "action.openURL",
    category: "action",
    label: "Open URL",
    description: "Open an external web page",
    enabled: true,
    defaultPayload: () => ({ type: "action.openURL", url: "https://" }),
  },
  {
    type: "action.sceneChange",
    category: "action",
    label: "Scene Change",
    description: "Switch to another scene (disabled until multi-scene support lands)",
    enabled: false,
    defaultPayload: () => ({ type: "action.sceneChange", sceneId: "" }),
  },

  // --- Data (MVP 4 preview — visible but not connectable yet) ---
  {
    type: "data.time",
    category: "data",
    label: "Time",
    description: "Seconds elapsed since target was found",
    enabled: true,
    defaultPayload: () => ({ type: "data.time", seconds: 0 }),
  },
  {
    type: "data.random",
    category: "data",
    label: "Random",
    description: "Random number between min and max",
    enabled: true,
    defaultPayload: () => ({ type: "data.random" }),
  },
];

const byType: Map<GraphNodeType, NodeCatalogEntry> = new Map(
  entries.map((e) => [e.type, e]),
);

export const NODE_CATALOG: ReadonlyArray<NodeCatalogEntry> = entries;

export function getNodeMeta(type: GraphNodeType): NodeCatalogEntry | undefined {
  return byType.get(type);
}

export function getNodeMetaOrThrow(type: GraphNodeType): NodeCatalogEntry {
  const meta = byType.get(type);
  if (!meta) throw new Error(`Unknown GraphNode type: ${type}`);
  return meta;
}
