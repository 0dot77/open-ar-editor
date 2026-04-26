// graph-runtime.js — Event Graph 해석기.
//
// 입력: graph.webar.json 의 { nodes, edges } + 호스트가 제공하는 bus / runAction / objects
// 동작:
//   1. trigger 노드 (event.*) 를 type 별로 인덱싱
//   2. bus 의 targetFound / targetLost / tap / timeElapsed 시점에 매칭 트리거 발화
//   3. 트리거에서 outgoing edges 따라 action 노드 chain 실행 (edge.delay 지원)

export function attachGraphRuntime({ graph, bus, runAction }) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    console.log('[graph-runtime] 그래프가 비어있어 attach 안 함');
    return { detach: () => {} };
  }

  // type → 트리거 노드 배열 인덱스
  const triggersByType = new Map();
  for (const node of graph.nodes) {
    if (typeof node.type !== 'string' || !node.type.startsWith('event.')) continue;
    const list = triggersByType.get(node.type) || [];
    list.push(node);
    triggersByType.set(node.type, list);
  }

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  /** 노드 id 부터 outgoing 따라가며 action 실행. delay 는 edge 기준. */
  function walkFrom(nodeId) {
    const outgoing = graph.edges.filter((e) => e.from === nodeId);
    for (const edge of outgoing) {
      const target = nodeById.get(edge.to);
      if (!target) continue;
      const fire = () => {
        if (typeof target.type === 'string' && target.type.startsWith('action.')) {
          try {
            runAction(target);
          } catch (e) {
            console.warn(`[graph-runtime] action 실행 실패 (${target.type}):`, e);
          }
        }
        // 체이닝: action 다음에 또 다른 노드가 연결돼 있으면 따라감
        walkFrom(target.id);
      };
      const delayMs = (edge.delay || 0) * 1000;
      if (delayMs > 0) setTimeout(fire, delayMs);
      else fire();
    }
  }

  function fireTriggers(triggerType) {
    const triggers = triggersByType.get(triggerType) || [];
    for (const trigger of triggers) walkFrom(trigger.id);
  }

  // --- bus 이벤트 → 트리거 발화 매핑 ---

  const onTargetFound = () => {
    fireTriggers('event.targetFound');

    // event.timeElapsed 는 targetFound 시점 기준으로 N초 후 발화
    const timed = triggersByType.get('event.timeElapsed') || [];
    for (const trigger of timed) {
      const ms = (trigger.seconds || 0) * 1000;
      setTimeout(() => walkFrom(trigger.id), ms);
    }
  };

  const onTargetLost = () => fireTriggers('event.targetLost');

  const onTap = (data) => {
    const tappedId = data?.object?.name;
    if (!tappedId) return;
    const taps = (triggersByType.get('event.tap') || []).filter((t) => t.objectId === tappedId);
    for (const trigger of taps) walkFrom(trigger.id);
  };

  bus.on('targetFound', onTargetFound);
  bus.on('targetLost', onTargetLost);
  bus.on('tap', onTap);

  console.log(
    `[graph-runtime] 부착됨 — 노드 ${graph.nodes.length}개 / 엣지 ${graph.edges.length}개 / 트리거 타입 ${triggersByType.size}종`,
  );

  return {
    detach() {
      bus.off('targetFound', onTargetFound);
      bus.off('targetLost', onTargetLost);
      bus.off('tap', onTap);
    },
  };
}
