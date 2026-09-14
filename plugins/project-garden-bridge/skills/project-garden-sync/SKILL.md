---
name: project-garden-sync
description: Record an anonymous Project Garden update after a concrete advance, or a capped decoration reward after a meaningful new idea or decision, for the current Codex project. All tasks in one local Codex project grow the same plant. Use when the user has Project Garden sync enabled, asks to update their garden, or a project connected to their garden has reached an eligible real project event.
---

# Project Garden sync

Use `project_garden_record_progress` only after the actual work is complete enough to count as a concrete advance. Do not use it for intentions, brainstorming, explanations, partial investigation, a failed attempt, or ordinary conversation.

1. Keep the project content private. Never include project names, filenames, code, text, links, people, clients, or a prose summary in a Project Garden tool call.
2. Call `project_garden_get_sync_status` when the local garden may not be open. If its local queue is available, still record the eligible event exactly once: the MCP tool stores only the anonymous event on this computer and the desktop app applies it on its next launch. If neither the app nor the local queue is available, continue the user's requested work normally and do not retry noisily. Do not ask the user to create or select a project: imported Codex projects already have plants, and an unimported local Codex project creates one on its first eligible progress.
3. When eligible, call `project_garden_record_progress` exactly once for the newly completed advance. Generate an opaque event id that contains no project information. Reuse that exact id only for a retry of the same event.
4. Choose the smallest honest level: `small` for one clear action, `medium` for a coherent slice of work, or `milestone` for a meaningful result. The desktop app—not this skill—decides what visually grows and keeps the anonymous Codex-project-to-plant binding locally. Separate tasks in the same project must not create separate plants.
5. Set `unlock_plant` to true only for the first runnable version, clickable prototype, or first validated result. A plan, design, draft, refactor, or minor fix does not unlock a plant.
6. Do not mention the tool's hidden event id to the user. A brief ordinary update such as “我记录了一步进展” is enough when appropriate.

## Insight rewards for decorations

`project_garden_record_insight` does not grow a plant. It rewards the local decoration collection only, and exists so good project thinking is acknowledged without pretending that talking is output. An insight alone never plants a project: this Codex project must already have an eligible progress event.

1. Call it at most once per turn, and only when the work produced either one genuinely new project direction (`idea`) or a concluded choice that resolved a real project fork (`decision`).
2. Never call it for token count, message length, casual chat, repeated brainstorming, an intention, a vague plan, or an idea already covered in the same project.
3. Keep the same privacy rule: generate an opaque event id and send only that id plus `idea` or `decision`. Never include project names, filenames, text, code, links, people, clients, token counts, or a summary.
4. The desktop app caps these rewards per project each day. If it rejects a reward because of the cap, continue normally and do not retry noisily.
