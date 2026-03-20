# Ralph-o-bot — Roadmap

Items here are rough future ideas. Not prioritised yet.

---

## Planned

### Ticket prioritisation convention
Allow issues to signal priority to Ralph so he processes higher-priority tickets first within a label queue, rather than always picking the earliest by created date.

**Proposed convention:** a label or title prefix (e.g. `p1`, `p2`, `p3` labels, or a `[P1]` title prefix) that Ralph sorts on before falling back to `created_at`. Convention TBD — needs to feel natural for a human labelling issues.

---

## Ideas / Backlog

### Self-update
Ralph should be able to update itself to the latest published npm version without manual intervention. Approach TBD — options include checking `npm outdated` on each startup/tick and auto-running `npm install -g ralph-o-bot`, or a dedicated `ralph-o-bot update` command. Need to consider how to restart gracefully after updating (especially when running as a systemd service).

### Designer role support
Clancy will soon have a designer role, which will introduce design tickets into the pipeline with a lot more back-and-forth than typical plan/build tickets. Ralph will need to handle a design stage — likely a new label (e.g. `clancy:design`) and comment cycle similar to brief/plan but potentially with more iterations. The review loop may also need to accommodate design feedback differently from code feedback.

### Keep Clancy up to date
Ralph should detect when a newer version of Clancy (`chief-clancy`) is available and update it in the project. Likely pairs with the self-update mechanism above. Need to decide whether updates are applied automatically or flagged for human approval, and how to handle breaking Clancy changes mid-pipeline.
