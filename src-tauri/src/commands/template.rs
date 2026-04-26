// open-ar-editor — index.html 템플릿 / custom.js 스텁 / sentinel-marked managed section 헬퍼
//
// "project-as-site" 아키텍처 Phase 1:
// - project_new 시 프로젝트 폴더에 index.html 과 custom.js 를 직접 머터리얼라이즈한다.
// - 작가가 VS Code 등으로 index.html / custom.js 를 직접 편집할 수 있도록 한다.
// - importmap, bootstrap 같은 "런타임이 관리해야 할 영역" 은
//   `<!-- editor:managed-<name> START --> ... <!-- editor:managed-<name> END -->`
//   sentinel 사이에 넣어, 런타임 업데이트 시 사용자 편집을 보존하면서 갱신한다.
//
// runtime/ 엔진 파일들은 여기서 다루지 않는다 — 그것들은 여전히 export/preview 시점에
// runtime-prototype/runtime/ 에서 복사된다 (Unity 엔진처럼 "도구가 들고 있는" 영역).

use std::path::PathBuf;

/// custom.js 초기 스텁 — 작가가 작성하는 사용자 코드의 시작점.
///
/// 이 파일은 한 번만 생성되며, 이후 에디터가 절대 덮어쓰지 않는다.
const CUSTOM_JS_STUB: &str = r#"// custom.js — your hook into the runtime.
//
// `register(api)` is called once during runtime startup. Use it to:
//   - register custom action types (api.onAction)
//   - listen to target events (api.onTargetFound / onTargetLost)
//   - run code each frame (api.onFrame)
//   - augment the Three.js scene before AR starts (api.beforeStart)
//
// `ctx` provided to handlers exposes:
//   - getObject(id)        — return the Three.js object for a scene-object id
//   - playSound(src)       — play an audio file path
//   - scene / camera / anchor  — the MindAR Three.js trio

export function register(api) {
  // Example (uncomment to try):
  //
  // api.onAction('action.shake', (node, ctx) => {
  //   const obj = ctx.getObject(node.objectId);
  //   if (!obj) return;
  //   const t0 = performance.now();
  //   const original = obj.position.clone();
  //   const tick = () => {
  //     const t = (performance.now() - t0) / 1000;
  //     if (t > 0.5) { obj.position.copy(original); return; }
  //     obj.position.x = original.x + Math.sin(t * 30) * 0.02;
  //     requestAnimationFrame(tick);
  //   };
  //   tick();
  // });
}
"#;

/// runtime-prototype/index.html 템플릿 파일의 절대 경로.
///
/// `commands::export::resolve_runtime_prototype_path()` 와 같은 dev/release 경로
/// 해결 전략을 따른다. dev 시 cwd 가 src-tauri/ 라 가정하고 ../runtime-prototype/
/// 로 거슬러 올라간다.
pub fn template_index_path() -> PathBuf {
    // export.rs 의 resolve_runtime_prototype_path 와 동일한 후보 탐색.
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let candidate_a = cwd.join("../runtime-prototype/index.html");
    let candidate_b = cwd.join("runtime-prototype/index.html");
    if candidate_a.exists() {
        candidate_a
    } else {
        candidate_b
    }
}

/// 새 프로젝트의 초기 index.html 본문을 만든다.
///
/// 1. runtime-prototype/index.html 을 읽는다.
/// 2. `<title>...</title>` 안의 텍스트를 프로젝트 제목으로 치환한다.
///
/// 템플릿 파일이 없으면 (릴리스 번들 등) Err 를 반환한다 — 호출자가 graceful 하게
/// skip 하도록 처리해야 한다.
pub fn render_initial_index_html(title: &str) -> Result<String, String> {
    let path = template_index_path();
    if !path.exists() {
        return Err(format!(
            "템플릿 파일을 찾을 수 없습니다: {}",
            path.display()
        ));
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("템플릿 파일을 읽을 수 없습니다 ({}): {e}", path.display()))?;

    // <title>...</title> 치환.
    // runtime-prototype/index.html 의 현재 리터럴은 "<title>WebAR 런타임</title>" 이지만,
    // 템플릿이 손대지 않은 상태로 변할 수도 있으므로 "open-ar-editor" 와 "WebAR 런타임"
    // 두 케이스를 모두 시도한다. 둘 다 없으면 첫 <title>...</title> 를 정규식 없이
    // substring 으로 잡아 치환한다.
    let new_title_tag = format!("<title>{}</title>", title);

    let known_literals = [
        "<title>open-ar-editor</title>",
        "<title>WebAR 런타임</title>",
    ];

    for lit in &known_literals {
        if content.contains(lit) {
            return Ok(content.replacen(lit, &new_title_tag, 1));
        }
    }

    // fallback — 첫 <title>..</title> 블록을 substring 으로 잡아 치환.
    if let (Some(start), Some(rel_end)) = (
        content.find("<title>"),
        content[content.find("<title>").unwrap_or(0)..].find("</title>"),
    ) {
        let end = start + rel_end + "</title>".len();
        let mut out = String::with_capacity(content.len());
        out.push_str(&content[..start]);
        out.push_str(&new_title_tag);
        out.push_str(&content[end..]);
        return Ok(out);
    }

    // <title> 가 아예 없으면 원본 그대로 — 실패시키지 않는다.
    Ok(content)
}

/// custom.js 초기 스텁 본문.
pub fn render_initial_custom_js() -> &'static str {
    CUSTOM_JS_STUB
}

// ── sentinel-marked managed section helpers ──────────────────────────────────

fn start_marker(section_name: &str) -> String {
    format!("<!-- editor:managed-{} START -->", section_name)
}

fn end_marker(section_name: &str) -> String {
    format!("<!-- editor:managed-{} END -->", section_name)
}

/// `<!-- editor:managed-<name> START -->` 와 `<!-- editor:managed-<name> END -->`
/// 사이의 영역을 `new_content` 로 교체한다 (마커는 그대로 유지).
///
/// new_content 는 마커 없이 내부 콘텐츠만 전달해야 한다. 마커 라인 자체는
/// 함수가 출력 시 다시 써준다. 마커가 없거나 순서가 잘못된 경우 Err.
pub fn replace_managed_section(
    html: &str,
    section_name: &str,
    new_content: &str,
) -> Result<String, String> {
    let start = start_marker(section_name);
    let end = end_marker(section_name);

    let start_idx = html
        .find(&start)
        .ok_or_else(|| format!("managed section 시작 마커를 찾을 수 없습니다: {start}"))?;
    let end_idx = html
        .find(&end)
        .ok_or_else(|| format!("managed section 끝 마커를 찾을 수 없습니다: {end}"))?;

    if end_idx < start_idx {
        return Err(format!(
            "managed section 마커 순서가 잘못되었습니다 ({section_name}): END 가 START 앞에 있습니다."
        ));
    }

    let before = &html[..start_idx];
    let after = &html[end_idx + end.len()..];

    // 출력 형식:
    //   <START>
    //   <new_content>
    //   <END>
    // new_content 가 개행으로 시작/끝나는지 알 수 없으므로, 보기 좋게 강제 정규화한다.
    let mut out = String::with_capacity(html.len());
    out.push_str(before);
    out.push_str(&start);
    out.push('\n');
    out.push_str(new_content.trim_end_matches('\n').trim_start_matches('\n'));
    out.push('\n');
    out.push_str(&end);
    out.push_str(after);

    Ok(out)
}

/// `<!-- editor:managed-<name> START -->` 와 END 사이의 콘텐츠 (마커 제외) 를 반환.
/// 마커가 없으면 None.
pub fn extract_managed_section(html: &str, section_name: &str) -> Option<String> {
    let start = start_marker(section_name);
    let end = end_marker(section_name);

    let start_idx = html.find(&start)?;
    let end_idx = html.find(&end)?;

    if end_idx < start_idx + start.len() {
        return None;
    }

    let inner_start = start_idx + start.len();
    let inner = &html[inner_start..end_idx];

    // 앞뒤 한 줄씩의 마커 인접 개행은 정리해 반환.
    Some(
        inner
            .trim_start_matches('\n')
            .trim_end_matches('\n')
            .to_string(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replace_managed_section_basic() {
        let html = "before\n<!-- editor:managed-imports START -->\nold\n<!-- editor:managed-imports END -->\nafter\n";
        let out = replace_managed_section(html, "imports", "new content").unwrap();
        assert!(out.contains("new content"));
        assert!(!out.contains("old"));
        assert!(out.contains("<!-- editor:managed-imports START -->"));
        assert!(out.contains("<!-- editor:managed-imports END -->"));
    }

    #[test]
    fn extract_managed_section_basic() {
        let html = "x\n<!-- editor:managed-bootstrap START -->\nA\nB\n<!-- editor:managed-bootstrap END -->\ny";
        let inner = extract_managed_section(html, "bootstrap").unwrap();
        assert_eq!(inner, "A\nB");
    }

    #[test]
    fn extract_missing_section_is_none() {
        let html = "<html></html>";
        assert!(extract_managed_section(html, "imports").is_none());
    }

    #[test]
    fn replace_missing_section_errors() {
        let html = "<html></html>";
        assert!(replace_managed_section(html, "imports", "x").is_err());
    }
}
