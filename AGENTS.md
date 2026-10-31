# AEGIS project instructions

Before changing this project, read `PROJECT.md` in full. It is the product brief, current-state record, and implementation roadmap.

Keep the project focused on a serious, real-world AI-agent security control plane. Preserve the existing visual direction and both light and dark themes. Work in small, completed slices; do not replace the app with a generic dashboard or claim integrations are live until they truly run.

For every change, preserve these non-negotiables:

- AEGIS sits between an AI agent and company systems.
- Agents must not receive direct production credentials or unrestricted database access.
- Model instructions and static permissions are not the security boundary. AEGIS must independently verify every tool request before it reaches a protected system.
- Data DNA decides what may be revealed and in what form.
- The product may display observable tool activity and AEGIS policy decisions, never hidden model chain-of-thought.
- Sensitive data should be masked, tokenized, or aggregated at retrieval time; do not copy an entire database merely for protection.
- The published AEGIS URL is a viewer-facing app, not a replacement for source control. The editable source is synchronized through the private GitHub repository: `https://github.com/nehitha-ss/aegis-agent-security`.

After a meaningful product change, update the `Current build state` and `Next build slice` portions of `PROJECT.md`.
