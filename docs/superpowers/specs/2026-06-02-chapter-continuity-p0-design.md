# Chapter Continuity P0 Design

## Scope

Implement a minimal chapter continuity system for the existing generation pipeline. The goal is to stop obvious cross-chapter breaks such as protagonist name drift, unanchored scene jumps, resource state jumps, and truncated chapter endings being accepted as completed chapters.

This P0 does not add new database tables, UI screens, or a full Novel Bible editor. It reuses the current chapter memory pack, chapter JSON fields, summaries, and quality gate.

## Assumptions

- Existing project metadata, BookBlueprint, StoryState, ChapterSummary, and character memory remain the source inputs.
- `NovelChapter.chapterOutline`, `NovelChapter.validationReport`, `ChapterCompletionReport.issues`, or existing commit payload JSON can store P0 continuity data.
- The first implementation should protect chapter-to-chapter continuity, not solve all long-range canon conflicts.
- Chapters that fail critical continuity checks should not be marked `COMPLETED`; they should be repaired when possible or left in `REVIEWING`.

## Recommended Approach

Use a lightweight `ChapterContinuity` layer inside the existing engine:

- Build a continuity anchor before generation from the previous completed chapter ending, recent summaries, character state, and story state.
- Inject that anchor into planner and writer context with explicit must-continue and forbidden-jump instructions.
- Run a deterministic post-generation audit before final save.
- Persist a compact continuity snapshot after successful generation so the next chapter has a clear handoff.

## Data Shape

Use TypeScript interfaces only at P0:

```ts
type ContinuityAnchor = {
  previousChapterNo: number
  previousEnding: string
  mustContinueFrom: string
  expectedOpeningLocation?: string
  protagonistName?: string
  forbiddenJumps: string[]
}

type ChapterContinuitySnapshot = {
  chapterNo: number
  openingScene: string
  endingScene: string
  currentLocation?: string
  protagonistStatus?: string
  activeCharacters: string[]
  newCharacters: string[]
  acquiredResources: string[]
  lostResources: string[]
  unresolvedHooks: string[]
  nextChapterMustContinueFrom: string
  continuityLocks: {
    protagonistName?: string
    locationAtEnd?: string
    vehicleAtEnd?: string
    resourceStatus?: string
  }
}

type ContinuityAuditResult = {
  passed: boolean
  score: number
  issues: Array<{
    severity: 'critical' | 'major' | 'minor'
    type: string
    description: string
    suggestedFix: string
  }>
  rewriteInstruction?: string
}
```

## Generation Flow

1. Before planning/writing chapter N, build `ContinuityAnchor` from chapter N-1.
2. Add a high-priority memory section:
   - Must start from the prior ending when chapter N > 1.
   - Must not change protagonist name.
   - Must not jump to a new location, companion, or resource without on-page transition.
   - Must resolve or explicitly continue the previous ending hook.
3. Generate and repair the chapter using the current pipeline.
4. Run the continuity audit alongside the existing quality gate.
5. If critical issues remain after repair attempts, save the draft as `REVIEWING` with audit details.
6. If passed, persist the continuity snapshot with the chapter commit or chapter JSON.

## Audit Rules

P0 audit checks are deterministic and conservative:

- Protagonist name lock: known protagonist name or prior active protagonist must not be replaced by a different main name.
- Previous ending anchor: chapter N must reference or semantically continue the previous ending in its opening section.
- Location continuity: if prior ending location is known, the new opening cannot start elsewhere without transition wording.
- Resource continuity: cannot suddenly gain a ship, weapon, companion, or safe base when prior snapshot says it was absent.
- Chapter completeness: reject endings that stop on unresolved mechanical prompts like "screen changed" without revealing the result or making the unresolved hook explicit.
- Chapter number leak and word-count checks remain handled by the existing quality gate.

## Files To Touch

- `src/lib/engine/chapter-continuity.ts`: new lightweight helpers and interfaces.
- `src/lib/memory/memory-orchestrator.ts`: include continuity anchor as a high-priority writer/planner section.
- `src/lib/engine/quality-gate.ts`: accept optional continuity audit input or expose a combined result shape.
- `src/lib/engine/orchestrator.ts`: build anchor, run audit, save audit result/snapshot.
- Focused unit tests under `src/__tests__/unit/`.

## Acceptance Criteria

- A chapter after a completed prior chapter receives explicit continuation instructions in writer context.
- A generated chapter that changes `林曜` to `林烬` without explanation fails a critical audit.
- A generated chapter that jumps from escape pod ending to black market opening without transition fails a critical audit.
- A generated chapter ending with an unresolved UI/state change is flagged unless the next-chapter hook is explicit and usable.
- Existing quality gate tests continue passing.
- No Prisma migration is required for P0.

## Open Decisions

- Store the snapshot in the chapter commit payload first. If that proves hard to read later, mirror it into `NovelChapter.chapterOutline.continuity`.
- Use deterministic string/heuristic checks first. LLM-based continuity review can be a later P1, because P0 needs reliable blocking behavior.

## Self Review

- No placeholder sections remain.
- Scope is limited to P0 continuity and avoids Novel Bible schema migration.
- The flow maps directly to existing modules already present in the repository.
- Ambiguous storage is resolved with a default: commit payload first, optional mirror into chapter JSON if needed during implementation.
