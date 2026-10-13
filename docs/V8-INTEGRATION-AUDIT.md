# V8 combined acceptance audit

Pinned inputs: base ca5f926a581f0620caf02dc38e06871797fe9aab; developer/design d0fbba74c2ea7478512a52af419cd4bb86d3f6cf; file/media 8b1bef38f546df013465d7ccb847516eb157fa23; studios 4e05febf44c8146d85a1b57b8856e3712bc8b389.

## Overlapping files and resolution

| Surface | Resolution |
| --- | --- |
| index.html | Combine assets in dependency order; retain original IDs and nine categories. |
| sw.js | Union assets, numeric v8-7 cache; add AVIF worker/WASM and Knowledge guide dependencies for cold offline use; remove invalid literal escape from studios input. |
| package.json | Preserve entire base test chain; append developer, media and studio tests; separate browser acceptance command. |
| build manifest | Include standalone studios entry point and root studio JS/CSS. |
| build script | Fail before touching dist when automatic Cloudflare/Render hosting environment is detected; local static build remains supported. |
| tests | Keep existing assertions; add combined acceptance and studio security/function tests. |
| workflows | Existing hosting workflows untouched. New acceptance workflow only runs tests/build and uploads QA evidence. |

## Integration repairs

Studios mount inside the existing workspace, preserving deep links and recently used tools. URL and freelance aliases resolve to original catalogue IDs. Percentage Change stays independent. Legacy favourite/recent keys resolve without rewriting stored data on load. Original QR generator, Wi-Fi/contact payloads, image reading, camera, colours and error correction are retained. QR uses the actual vendored qrcode API. Redaction retains JWT, bearer, API assignments, email, IPv4, phone and database patterns with replace/mask/remove and explicit preview application. Sensitive URL copy warns about credentials.

File/media cleanup revokes object URLs and stops AVIF workers when leaving a workspace. AVIF binary is byte-identical to the pinned source (Git blob 4c3da3f2ceb0e3a5a1337c48e15f89b0a46c7ff8). Vendor licences are shipped.

## Acceptance boundaries

No deployment, merge, production, DNS or account changes are part of this candidate. Hosting guard failures are intentional until a separately approved staging deployment removes the guard. Offline precache grows to include Knowledge; browser storage pressure can still evict caches. Existing engine/media and developer tool limitations remain documented in their respective tool documentation. Automated browser checks do not substitute for human camera-device or assistive-technology validation.

## Concurrent integration branch

An existing remote integration head was found during final publication checks: 50cd72ba9650019e94dbdece4dc3181e8152ddbc. The acceptance commit builds on that history, retains its SHA-256 search keyword fix and regression coverage, and reconciles its tests with the richer in-place studios. Assertions still verify QR generation/validation, audit and redaction categories, URL signals and UTM, exact freelance arithmetic, independent percentage arithmetic, saved favourites, navigation, keyboard tabs and offline use. Tests now consume the single shared alias table rather than requiring two duplicated route literals. The separate acceptance workflow supplies integration CI without modifying existing deployment workflows or unrelated branch triggers.
