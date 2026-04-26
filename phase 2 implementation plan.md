<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# research sources and write implementation plan for phase 2. make sure all sources are reliable and this is the best way possible. reason everything out and logic should be consistent

Yes — for **Phase 2**, the best implementation is a progressive-enhancement vault connector: use `showDirectoryPicker()` as the primary path on supported browsers, persist directory handles in IndexedDB, re-check permissions on every revisit, and provide a `webkitdirectory` upload fallback for browsers that do not support the File System Access API.  This matches FileSage’s local-only, user-selected-vault model and its requirement for recursive scanning plus local metadata persistence from day one.[^1][^2][^3][^4][^5]

## Source quality

The most reliable sources for this phase are MDN for API behavior and contracts, plus official Chrome/web.dev documentation for implementation patterns and permission persistence behavior.  I would treat these as the primary authority set because they come from browser platform documentation rather than community examples, and together they cover the exact concerns Phase 2 has: directory picking, async directory traversal, IndexedDB persistence, and permission recovery.[^2][^6][^3][^7][^8][^4][^1]

## Recommended design

Phase 2 should do four things only: connect vaults, persist vault references, recursively enumerate entries, and store a metadata snapshot for later indexing stages.  That separation is important because your context says search and ask come later, while Phase 2 is the prerequisite plumbing that gives the app durable access to user-selected folders without modifying files.[^8][^5][^1][^2]

The primary path should be `window.showDirectoryPicker()` because it returns a `FileSystemDirectoryHandle`, which is the browser-native representation of a user-approved folder.  After selection, store the handle itself in IndexedDB because file and directory handles are serializable, which is the intended way to reopen prior vaults on later visits.[^9][^10][^6][^1][^2]

On app startup, reload saved handles from IndexedDB and immediately call `queryPermission()`; if the result is `prompt`, call `requestPermission()` before trying to traverse the directory.  This is the correct pattern because MDN notes that handles restored from IndexedDB commonly return `prompt`, and Chrome’s persistent-permissions behavior is specifically designed around restoring stored handles and requesting permission again on a later visit.[^3][^11][^7]

## Implementation plan

1. Build a `connectVault()` client action that feature-detects `showDirectoryPicker` and, if available, opens the directory picker in read mode first.  Read mode is the right default for MVP because FileSage’s initial product is trust-first and should not modify user files yet.[^4][^5][^1]
2. When the user picks a folder, create a vault record in IndexedDB with a stable `vaultId`, display name, root handle, connected timestamp, last-scan timestamp, permission state cache, and lightweight scan stats such as file count and last completed path.  IndexedDB is the right storage layer here because it is designed for large structured client-side data, supports indexes, and fits your requirement for local metadata persistence.[^6][^12][^5][^2]
3. Traverse the directory recursively with `for await ... of dirHandle.values()` or `entries()`, because directory contents are exposed as asynchronous iterators rather than synchronous arrays.  As you walk, compute a normalized relative path and record `name`, `kind`, `relativePath`, and for files also `size`, `type`, and `lastModified`, which are available once you call `getFile()`.[^13][^14][^8][^4]
4. Persist the scan output into a separate IndexedDB store for file entries rather than mixing it into the vault-handle store.  This keeps the schema aligned with the later pipeline in your context, where scanning, extraction, chunking, embeddings, and retrieval are distinct stages with incremental updates.[^12][^5][^6]
5. Add a startup recovery flow that loads saved vault handles, verifies permission, and marks each vault as `ready`, `needsPermission`, or `missing`.  That state machine is necessary because access can be revoked, prompts may reappear, and a previously selected folder may no longer be accessible even if its handle still exists in IndexedDB.[^11][^7][^3]
6. Add a fallback path for unsupported browsers using `<input type="file" webkitdirectory>` so users can still ingest folders even when the File System Access API is unavailable.  This fallback is important because `showDirectoryPicker()` is not broadly supported across all browsers, so relying on it alone would conflict with a practical local-first product.[^15][^5][^4]

## Why this is the best path

This design is the strongest MVP choice because it preserves the exact browser permission model instead of trying to work around it, and it lets FileSage reopen known vaults without forcing the user to reconnect everything on every visit.  It also keeps the app aligned with your product principles: strictly local, evidence-first, safe by default, and staged so indexing can later become incremental and resumable on top of a stable vault and file-entry layer.[^7][^5][^2][^3]

A more ambitious design — such as requesting readwrite access now, introducing OPFS/RxDB immediately, or merging scanning with embeddings in Phase 2 — would add complexity before the product has validated the simpler connection-and-scan loop.  Your context explicitly says IndexedDB is the initial storage choice and that stronger local persistence options like OPFS/RxDB are something to consider after the MVP baseline, so the consistent logic is to keep Phase 2 narrow and dependable.[^5][^3]

## Concrete structure

Use two IndexedDB stores at minimum: `vaults` for folder-level records and `files` for per-entry metadata snapshots.  In `vaults`, store the serialized `FileSystemDirectoryHandle`; in `files`, index by `vaultId + relativePath` so rescans can upsert cleanly and later stages can detect unchanged files before extraction.[^2][^6][^12][^5]

At the code level, keep Phase 2 split into `features/file-access/` for picker and permission logic, `features/indexing/` for recursive enumeration, and `lib/db/` for IndexedDB access, because that matches the target architecture already defined in your project context.  The result is a clean sequence: user connects vault, app stores handle, app verifies permission, app enumerates entries, app persists metadata, and only then later phases consume that metadata for extraction and retrieval.[^3][^8][^5]

Would you like the next step to be a **file-by-file engineering spec** for Phase 2, including the exact TypeScript modules, DB schema, and function signatures?
<span style="display:none">[^16][^17][^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^31][^32][^33][^34][^35][^36][^37][^38][^39][^40][^41][^42]</span>

<div align="center">⁂</div>

[^1]: https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker

[^2]: https://developer.chrome.com/docs/capabilities/web-apis/file-system-access

[^3]: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission

[^4]: https://web.dev/patterns/files/open-a-directory

[^5]: context.md

[^6]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API

[^7]: https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api

[^8]: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/entries

[^9]: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle

[^10]: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API

[^11]: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission

[^12]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB

[^13]: https://web.dev/articles/origin-private-file-system

[^14]: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/values

[^15]: https://www.typeerror.org/docs/dom/window/showdirectorypicker

[^16]: https://mdn2.netlify.app/en-us/docs/web/api/window/showdirectorypicker/

[^17]: https://web-platform-dx.github.io/web-features-explorer/features/file-system-access/

[^18]: https://stackoverflow.com/questions/65928613/file-system-access-api-is-it-possible-to-store-the-filehandle-of-a-saved-or-loa

[^19]: https://developer.mozilla.org/en-US/docs/Glossary/IndexedDB

[^20]: https://www.reddit.com/r/firefox/comments/1g49ywl/wait_for_an_api_move_forward_the_web/

[^21]: https://wicg.github.io/file-system-access/EXPLAINER.html

[^22]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology

[^23]: https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker

[^24]: https://web.dev/articles/indexeddb

[^25]: https://github.com/mdn/content/blob/main/files/en-us/web/api/filesystemhandle/querypermission/index.md?plain=1

[^26]: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle

[^27]: https://developer.mozilla.org/zh-CN/docs/Web/API/FileSystemHandle/requestPermission

[^28]: https://developer.mozilla.org/ja/docs/Web/API/FileSystemHandle/requestPermission

[^29]: https://stackoverflow.com/questions/75400763/request-or-query-permissions-to-access-the-file-system-from-input-type-file-af

[^30]: https://runebook.dev/en/docs/dom/window/showdirectorypicker

[^31]: https://github.com/mdn/content/blob/main/files/en-us/web/api/filesystemhandle/requestpermission/index.md?plain=1

[^32]: https://runebook.dev/fr/docs/dom/window/showdirectorypicker

[^33]: https://cdn.jsdelivr.net/npm/memfs@4.46.0/lib/fsa/CoreFileSystemHandle.d.ts

[^34]: https://developer.chrome.com/docs/extensions/reference/api/permissions

[^35]: https://stackoverflow.com/questions/72205424/how-to-iterate-over-the-contents-of-a-filesystemdirectoryhandle

[^36]: https://web.dev/articles/origin-private-file-system.md.txt

[^37]: https://github.com/mdn/content/blob/main/files/en-us/web/api/filesystemdirectoryhandle/values/index.md?plain=1

[^38]: https://issues.chromium.org/issues/377330018/blocking

[^39]: https://mdn2.netlify.app/en-us/docs/web/api/filesystemdirectoryhandle/entries/

[^40]: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getFileHandle

[^41]: https://github.com/runmedev/web/issues/55

[^42]: https://github.com/mdn/content/blob/main/files/en-us/web/api/filesystemdirectoryhandle/entries/index.md?plain=1

