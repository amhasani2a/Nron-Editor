# Third-party notices

The application source is GPL-3.0-only, as in the upstream repository. The supplied
logo remains the supplied artwork; no independent trademark ownership is claimed.

Runtime dependencies (see pinned `package-lock.json` and `src-tauri/Cargo.lock`):
Tauri and official plugins (MIT/Apache-2.0), DOMPurify (Apache-2.0 OR MPL-2.0),
fflate (MIT), pulldown-cmark (MIT), zip (MIT), base64 (MIT OR Apache-2.0), serde
(MIT OR Apache-2.0), plus their transitive dependencies. The bundled vendor file
retains available legal comments. Refer to each upstream package for its complete
license. Font license files are retained in `src/assets`; Vazirmatn and Roboto Mono
are supplied with their existing upstream font licenses.

Development reference skills were reused from the prior project as requested:
obra/superpowers (TDD, systematic debugging, verification, code review),
MuhiminOsim/code-refactoring-skill, JayRHa/AgentSkills/refactoring-guide,
github/awesome-copilot/review-and-refactor, and peditx/tauri-skills.
Their material under `.agents/skills` remains under its original upstream license.
The local artifact-design guidance was used for responsive design and visual QA.
These skills are not shipped inside the executable and do not run autonomously.

## Additional offline Arabic/Persian font families (0.3)
Noto Naskh Arabic, Noto Sans Arabic, Amiri, Markazi Text, El Messiri, Lalezar,
Changa, Cairo, Rakkas, Lateef: SIL Open Font License 1.1, obtained from the
Google Fonts repository (`https://github.com/google/fonts/tree/main/ofl`).
Full per-family license texts accompany the binaries in `src/assets/fonts-extra/*-OFL.txt`.
Personal font import does not grant redistribution rights; users must comply with the font's license.
