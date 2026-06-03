# Serial Chapter Flow Design

## Scope

Improve cross-chapter reading flow for generated web-novel chapters. The goal is not only to prevent obvious continuity errors, but to make each new chapter feel like it pays off the previous chapter's promise before moving into the next scene.

This is a focused P1 extension of the existing `chapter-continuity` system. It does not add new database tables, UI screens, or a full story bible. It reuses the previous chapter ending, memory pack, planner prompt, writer prompt, and continuity audit.

## Problem Example

Chapter 1 ends with an explicit decision hook:

```text
【2. 暂时隐匿。机遇：规避即时风险，利用本地（低价值）资源缓慢恢复。风险：资源匮乏，恢复缓慢，错过灵石矿脉（可能被他人捷足先登）。】

【请宿主决策。】

石室里，只剩下林默粗重的呼吸声，以及手机屏幕上那红蓝交织、不断明灭的微光，映照着他苍白而挣扎的脸。
```

Chapter 2 then opens in a new location:

```text
柴房里的味道，说是修仙界十大酷刑之一都不冤。
```

The current continuity layer can catch some location jumps, but this still reads as broken because the reader was promised a decision and did not see the decision, its immediate effect, or the transition from the stone chamber to the woodshed.

## Assumptions

- A web-novel chapter should treat the prior chapter ending as a reader contract.
- If the prior ending contains a decision, question, countdown, system prompt, door opening, arrival, alarm, reveal, or direct threat, the next chapter opening must process it on-page.
- The opening does not need to fully resolve the hook. It may deepen or defer it, but the deferral must be explicit and visible.
- A short transition is enough. The system should not force a long recap.
- Deterministic checks should cover obvious failures first; LLM-based review can remain a later enhancement.

## Recommended Approach

Add a lightweight "serial flow contract" to the existing continuity anchor:

- Extract a compact `openingObligation` from the previous chapter ending.
- Inject the obligation into planner and writer contexts with a concrete web-novel chain:
  `接钩 -> 短兑现/反转 -> 新阻碍升级 -> 本章目标 -> 章尾再钩`.
- Require planner output to design the first scene around that obligation.
- Require writer output to spend the first 300-500 Chinese characters processing the previous hook before starting a new location or time state.
- Extend continuity audit so an unhandled prior hook becomes a blocking continuity issue.

## Data Shape

Extend the existing TypeScript interfaces in `src/lib/engine/chapter-continuity.ts`:

```ts
type OpeningObligation = {
  type: 'decision' | 'question' | 'countdown' | 'system_prompt' | 'arrival' | 'threat' | 'reveal' | 'state_change' | 'unknown'
  triggerText: string
  requiredOpeningAction: string
  canDefer: boolean
}

type ContinuityAnchor = {
  previousChapterNo: number
  previousEnding: string
  mustContinueFrom: string
  expectedOpeningLocation?: string
  protagonistName?: string
  forbiddenJumps: string[]
  openingObligation?: OpeningObligation
}
```

No Prisma migration is needed. The obligation can be persisted through the existing continuity snapshot/audit payload if useful.

## Prompt Changes

### Planner

Add explicit planning rules:

- The first key scene must start from `openingObligation.requiredOpeningAction` when present.
- The opening scene must not introduce a new location until the obligation is processed or visibly deferred.
- The chapter plan should name the bridge from prior hook to current chapter goal.
- For a decision hook, the plan must state the chosen option, refusal, delay, or forced interruption.

### Writer

Add explicit writing rules:

- The first 300-500 Chinese characters must continue the prior ending, not summarize it abstractly.
- For decision/system hooks, show the protagonist reacting, choosing, delaying, or being interrupted.
- Only after that may the chapter transition into a new place such as a woodshed, market, sect hall, or battlefield.
- The transition must be on-page: movement, time cost, physical consequence, dialogue, system feedback, or a clear cut with reason.
- Do not start chapter N with a fresh atmosphere description if chapter N-1 ended on an unresolved action prompt.

For the example above, a valid opening would first show Lin Mo choosing or failing to choose on the system screen, then explain how he reaches the woodshed.

## Audit Rules

Extend `auditChapterContinuity` with conservative checks:

- If the previous ending contains decision markers such as `请宿主决策`, `请选择`, numbered options, or `是否`, the next opening must include a decision verb or the trigger terms.
- If the previous ending contains a direct question, the next opening must answer, evade, interrupt, or escalate it.
- If the previous ending contains an alarm, door, screen, countdown, arrival, or reveal, the next opening must reference that object/event.
- If a new opening location appears before the obligation is handled and no transition term appears, fail as `serial_flow_break`.
- Severity is `critical` for decision/system hooks and `major` for weaker hooks.

The audit should stay simple and testable. False positives are acceptable when the generated chapter clearly skips a prior promise; they block a draft that already needs repair.

## Files To Touch

- `src/lib/engine/chapter-continuity.ts`
  - Add `OpeningObligation` extraction.
  - Add serial flow formatting in the anchor section.
  - Add audit rule `serial_flow_break`.
- `src/lib/prompts/chapter/planning-v2.ts`
  - Make first scene obligation explicit.
- `src/lib/prompts/chapter/writing-v2.ts`
  - Replace the generic "上一章结尾原文" wording with the actual "章节连续性锚点 / 开篇承诺" wording.
  - Add the web-novel serial chain.
- `src/__tests__/unit/chapter-continuity.test.ts`
  - Add tests for the provided decision-hook example.

## Acceptance Criteria

- Given a previous ending with `【请宿主决策。】`, `buildContinuityAnchor` produces an `openingObligation` of type `decision` or `system_prompt`.
- `formatContinuityAnchorSection` includes a clear instruction that chapter N must process the prior decision before changing scene.
- A chapter opening directly with `柴房里的味道...` fails continuity audit with `serial_flow_break`.
- A chapter opening that shows Lin Mo choosing `暂时隐匿`, receives system feedback, and then transitions to the woodshed passes the serial flow audit.
- Planner and writer prompts explicitly contain the chain `接钩 -> 短兑现/反转 -> 新阻碍升级 -> 本章目标 -> 章尾再钩`.
- Existing continuity and quality gate tests continue passing.

## Out Of Scope

- Full long-range canon tracking.
- New UI controls for continuity mode.
- LLM-based semantic continuity review.
- Rewriting all old generated chapters.

## Self Review

- No placeholder sections remain.
- Scope is limited to prompt/audit behavior directly related to the reported problem.
- The provided failure example is captured as a concrete acceptance test.
- The design avoids new storage and follows the existing P0 continuity architecture.
