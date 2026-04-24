/**
 * SceneObject3D — 장면 오브젝트를 타입별로 3D 렌더하는 컴포넌트.
 * Viewport 가 project.scene.objects.map 하며 사용.
 */

import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { useGLTF, Text, Outlines } from "@react-three/drei";
import type { SceneObject, Vector3OrScalar } from "@/shared/types";

// ────────────────────────────────────────────────────────
// 유틸: Vector3OrScalar → [x, y, z]
// ────────────────────────────────────────────────────────
function resolveScale(scale: Vector3OrScalar): [number, number, number] {
  if (typeof scale === "number") return [scale, scale, scale];
  return [scale[0], scale[1], scale[2]];
}

// ────────────────────────────────────────────────────────
// props
// ────────────────────────────────────────────────────────
interface SceneObject3DProps {
  obj: SceneObject;
  isSelected: boolean;
  onSelect: (id: string) => void;
  assetUrl: (relative: string) => string;
  /** TransformControls 연결용 ref 수신 콜백 */
  onMeshReady?: (id: string, mesh: THREE.Object3D | null) => void;
}

// ────────────────────────────────────────────────────────
// 개별 타입 렌더러
// ────────────────────────────────────────────────────────

/** GLB 모델 */
function ModelObject({
  obj,
  isSelected,
  onSelect,
  assetUrl,
  onMeshReady,
}: SceneObject3DProps) {
  const url = assetUrl(obj.src);
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(), [scene]);

  return (
    <group
      ref={(ref) => onMeshReady?.(obj.id, ref)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(obj.id);
      }}
    >
      <primitive object={cloned} />
      {isSelected && (
        <mesh>
          <Outlines thickness={2} color="#4a9eff" />
        </mesh>
      )}
    </group>
  );
}

/** 이미지 plane (텍스처 로드 성공; Suspense 안에서 사용) */
function ImageWithTexture({
  obj,
  isSelected,
  onSelect,
  assetUrl,
  onMeshReady,
}: SceneObject3DProps) {
  const url = assetUrl(obj.src);
  const texture = useLoader(THREE.TextureLoader, url);

  return (
    <mesh
      ref={(ref) => onMeshReady?.(obj.id, ref)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(obj.id);
      }}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent />
      {isSelected && <Outlines thickness={2} color="#4a9eff" />}
    </mesh>
  );
}

/** 이미지 로드 실패 fallback */
function ImageFallback({
  obj,
  isSelected,
  onSelect,
  onMeshReady,
}: SceneObject3DProps) {
  return (
    <mesh
      ref={(ref) => onMeshReady?.(obj.id, ref)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(obj.id);
      }}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#6699cc" side={THREE.DoubleSide} />
      {isSelected && <Outlines thickness={2} color="#4a9eff" />}
    </mesh>
  );
}

/** 이미지 plane */
function ImageObject(props: SceneObject3DProps) {
  return (
    <Suspense fallback={<ImageFallback {...props} />}>
      <ImageWithTexture {...props} />
    </Suspense>
  );
}

/** 비디오 plane — MVP2 는 첫 프레임만 */
function VideoObject({
  obj,
  isSelected,
  onSelect,
  assetUrl,
  onMeshReady,
}: SceneObject3DProps) {
  const url = assetUrl(obj.src);

  const videoTexture = useMemo(() => {
    try {
      const video = document.createElement("video");
      video.src = url;
      video.crossOrigin = "anonymous";
      video.preload = "metadata";
      video.muted = true;
      // 첫 프레임만 (iOS 정책 준수 — 자동재생 안 함)
      return new THREE.VideoTexture(video);
    } catch {
      return null;
    }
  }, [url]);

  return (
    <mesh
      ref={(ref) => onMeshReady?.(obj.id, ref)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(obj.id);
      }}
    >
      <planeGeometry args={[1, 1]} />
      {videoTexture ? (
        <meshBasicMaterial map={videoTexture} side={THREE.DoubleSide} />
      ) : (
        <meshBasicMaterial color="#334455" side={THREE.DoubleSide} />
      )}
      {isSelected && <Outlines thickness={2} color="#4a9eff" />}
    </mesh>
  );
}

/** 텍스트 */
function TextObject({
  obj,
  isSelected,
  onSelect,
  onMeshReady,
}: SceneObject3DProps) {
  return (
    <group
      ref={(ref) => onMeshReady?.(obj.id, ref)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(obj.id);
      }}
    >
      <Text
        color="#ffffff"
        fontSize={0.1}
        maxWidth={2}
        anchorX="center"
        anchorY="middle"
      >
        {obj.content ?? obj.label ?? "텍스트"}
      </Text>
      {isSelected && (
        <mesh>
          <boxGeometry args={[0.5, 0.12, 0.01]} />
          <meshBasicMaterial color="#4a9eff" wireframe />
        </mesh>
      )}
    </group>
  );
}

/** 에러 fallback */
function ErrorBox({
  obj,
  onSelect,
  onMeshReady,
}: Pick<SceneObject3DProps, "obj" | "onSelect" | "onMeshReady">) {
  return (
    <mesh
      ref={(ref) => onMeshReady?.(obj.id, ref)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(obj.id);
      }}
    >
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshBasicMaterial color="#cc3333" />
    </mesh>
  );
}

// ────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────

export function SceneObject3D(props: SceneObject3DProps) {
  const { obj } = props;

  if (!obj.visible) return null;

  const pos = obj.position as [number, number, number];
  const rot = obj.rotation as [number, number, number];
  const scl = resolveScale(obj.scale);
  const euler = new THREE.Euler(rot[0], rot[1], rot[2], "XYZ");

  const inner = (() => {
    switch (obj.type) {
      case "model":
        return (
          <Suspense
            fallback={
              <ErrorBox
                obj={obj}
                onSelect={props.onSelect}
                onMeshReady={props.onMeshReady}
              />
            }
          >
            <ModelObject {...props} />
          </Suspense>
        );
      case "image":
        // ImageObject 내부에서 Suspense 처리
        return <ImageObject {...props} />;
      case "video":
        return <VideoObject {...props} />;
      case "text":
        return <TextObject {...props} />;
      case "audio":
        // 오디오는 뷰포트에서 시각 표현 없음
        return null;
      case "button":
        // button 타입은 MVP2 뷰포트 미지원
        return (
          <mesh
            ref={(ref) => props.onMeshReady?.(obj.id, ref)}
            onClick={(e) => {
              e.stopPropagation();
              props.onSelect(obj.id);
            }}
          >
            <boxGeometry args={[0.5, 0.15, 0.05]} />
            <meshBasicMaterial color="#555566" />
          </mesh>
        );
      default: {
        // exhaustive check
        const _never: never = obj.type;
        console.warn(
          "이 오브젝트 타입은 아직 뷰포트에 표시되지 않습니다:",
          _never
        );
        return null;
      }
    }
  })();

  if (inner === null) return null;

  return (
    <group position={pos} rotation={euler} scale={scl}>
      {inner}
    </group>
  );
}

export default SceneObject3D;
