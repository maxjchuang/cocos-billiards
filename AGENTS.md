# Project context

- This is a minimal **Cocos Creator 3.8.7** 3D billiards starter. Do not replace it with a browser-only canvas demo or Unity project.
- The user is a senior frontend engineer and new to game engines. Explain editor steps and 3D concepts in plain Chinese.
- Read README.md and HANDOFF.md before continuing.
- Target mobile mini-games only. All gameplay must work through touch with no keyboard or desktop mouse controls. Browser previews are development tools; WeChat mini-game export and real-device compatibility are not yet validated.
- Physics is pure TypeScript on the XZ plane. Cocos only provides scene/input/rendering. No third-party art, remote CDN runtime or general-purpose physics engine is required.
- Preserve `.meta` files: the Main scene references the bootstrap script by UUID.
- Validate changes with `npm ci` (when dependencies are absent) and `npm run check`.
- Type checks and physics tests do not establish editor/runtime compatibility. Report Creator preview and real-device validation separately.

- Rules baseline: CBSA Chinese Pool (January 2017), chapter III, as linked in README.md. Keep the referee independent of Cocos, preserve touch-only controls, and test first contact, post-contact cushions, grouping, ball-in-hand and 8-ball outcomes. Explicitly document any unimplemented physical or tournament rules.
