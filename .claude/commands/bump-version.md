Bump the version number in `index.html`.

## Steps

1. Read `index.html` and find the current version in the footer. It looks like: `v1.0.0`
2. Determine the bump type from the argument `$ARGUMENTS`:
   - `major` → increment X in vX.Y.Z, reset Y and Z to 0
   - `minor` → increment Y in vX.Y.Z, reset Z to 0
   - `patch` (default, used when argument is empty or unrecognised) → increment Z in vX.Y.Z
3. Edit `index.html` to replace the old version string with the new one.
4. Report the old version → new version in one line, e.g. `v1.0.0 → v1.1.0`.

Do not commit, do not touch any other file.
