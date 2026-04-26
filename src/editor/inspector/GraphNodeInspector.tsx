import { useProjectStore } from "@/state/projectStore";
import type { Asset, GraphNode, SceneObject } from "@/shared/types";
import { getNodeMeta } from "@/editor/node-graph/nodeCatalog";

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
}

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="inspector__section">
      <span className="inspector__section-title">{label}</span>
      {children}
      {hint && <p className="inspector__hint">{hint}</p>}
    </div>
  );
}

interface SceneObjectSelectProps {
  value: string;
  onChange: (id: string) => void;
  objects: SceneObject[];
  emptyHint: string;
}

function SceneObjectSelect({ value, onChange, objects, emptyHint }: SceneObjectSelectProps) {
  return (
    <>
      <select
        className="inspector__number-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Select —</option>
        {objects.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label || o.id} ({o.type})
          </option>
        ))}
      </select>
      {objects.length === 0 && <p className="inspector__hint">{emptyHint}</p>}
    </>
  );
}

interface AssetSelectProps {
  value: string;
  onChange: (path: string) => void;
  assets: Asset[];
  emptyHint: string;
}

function AssetSelect({ value, onChange, assets, emptyHint }: AssetSelectProps) {
  return (
    <>
      <select
        className="inspector__number-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Select —</option>
        {assets.map((a) => (
          <option key={a.id} value={a.path}>
            {basename(a.path)}
          </option>
        ))}
      </select>
      {assets.length === 0 && <p className="inspector__hint">{emptyHint}</p>}
    </>
  );
}

function NodeBody({ node }: { node: GraphNode }) {
  const { project, updateGraphNode } = useProjectStore();
  const objects = project?.scene.objects ?? [];
  const assets = project?.assets ?? [];

  switch (node.type) {
    case "event.targetFound":
    case "event.targetLost":
      return (
        <Field label="Trigger">
          <p className="inspector__hint">
            Fires when MindAR detects (or loses) the configured image target. No parameters.
          </p>
        </Field>
      );

    case "event.timeElapsed":
      return (
        <Field label="Seconds after target found">
          <input
            type="number"
            className="inspector__number-input"
            value={node.seconds}
            min={0}
            step={0.1}
            onChange={(e) => updateGraphNode(node.id, { seconds: parseFloat(e.target.value) || 0 })}
          />
        </Field>
      );

    case "event.tap":
    case "event.videoEnded":
    case "event.soundEnded":
    case "action.show":
    case "action.hide":
    case "action.toggle":
    case "action.pauseSound":
    case "action.pauseVideo":
    case "action.playAnimation":
      return (
        <Field
          label="Object"
          hint="Pick a scene object this action targets."
        >
          <SceneObjectSelect
            value={node.objectId}
            onChange={(id) => updateGraphNode(node.id, { objectId: id })}
            objects={objects}
            emptyHint="No scene objects yet. Drag an asset into the viewport first."
          />
        </Field>
      );

    case "action.playSound": {
      const audioAssets = assets.filter((a) => a.type === "audio");
      const currentSrc = "src" in node ? (node.src ?? "") : "";
      return (
        <>
          <Field
            label="Audio asset"
            hint="Pick an imported audio file. The runtime fetches and plays it once."
          >
            <AssetSelect
              value={currentSrc}
              onChange={(path) =>
                updateGraphNode(node.id, { src: path, objectId: undefined } as Partial<GraphNode>)
              }
              assets={audioAssets}
              emptyHint="No audio assets. Import an .mp3/.wav/.ogg via the asset panel."
            />
          </Field>

          <Field label="Loop">
            <label className="inspector__checkbox-row">
              <input
                type="checkbox"
                checked={node.loop ?? false}
                onChange={(e) => updateGraphNode(node.id, { loop: e.target.checked })}
                className="inspector__checkbox"
              />
              <span className="inspector__checkbox-label">Loop playback</span>
            </label>
          </Field>
        </>
      );
    }

    case "action.playVideo": {
      const videoObjects = objects.filter((o) => o.type === "video");
      return (
        <Field label="Video object">
          <SceneObjectSelect
            value={"objectId" in node ? (node.objectId ?? "") : ""}
            onChange={(id) =>
              updateGraphNode(node.id, { objectId: id } as Partial<GraphNode>)
            }
            objects={videoObjects}
            emptyHint="No video objects in the scene."
          />
        </Field>
      );
    }

    case "action.openURL":
      return (
        <Field label="URL">
          <input
            type="text"
            className="inspector__number-input"
            value={node.url}
            placeholder="https://..."
            onChange={(e) => updateGraphNode(node.id, { url: e.target.value })}
          />
        </Field>
      );

    default:
      return (
        <Field label="Parameters">
          <p className="inspector__hint">No editable parameters for this node type yet.</p>
        </Field>
      );
  }
}

function GraphNodeInspector({ node }: { node: GraphNode }) {
  const meta = getNodeMeta(node.type);
  return (
    <div className="inspector">
      <div className="inspector__header">
        <span className="inspector__title">{meta?.label ?? node.type}</span>
      </div>

      <div className="inspector__body">
        <div className="inspector__section">
          <span className="inspector__section-title">Node info</span>
          <div className="inspector__info-row">
            <span className="inspector__info-label">ID</span>
            <span className="inspector__info-value">{node.id}</span>
          </div>
          <div className="inspector__info-row">
            <span className="inspector__info-label">Type</span>
            <span className="inspector__info-value">{node.type}</span>
          </div>
          {meta?.description && (
            <p className="inspector__hint">{meta.description}</p>
          )}
        </div>

        <NodeBody node={node} />
      </div>
    </div>
  );
}

export default GraphNodeInspector;
