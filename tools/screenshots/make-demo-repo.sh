#!/usr/bin/env bash
# Builds the throwaway trail-notes repo used for the Commit Walk screenshots.
set -euo pipefail
D=$1
# It starts over: only an earlier trail-notes demo, or nothing, is removed.
if [ -e "$D" ] && [ ! -f "$D/src/trail.ts" ]; then echo "$D exists and is not the trail-notes demo; not touching it" >&2; exit 1; fi
rm -rf "$D"; mkdir -p "$D/src" "$D/tests"; cd "$D"
c() { # c "<relative date>" "<message>"
  local when; when=$(date -d "$1" -R)
  git add -A
  GIT_COMMITTER_DATE="$when" git -c core.hooksPath=/dev/null -c user.name="Demo Author" -c user.email=demo@example.com commit -q -m "$2" --date "$when"
}
git init -q -b main
printf '# trail-notes\n\nA tiny notebook for hiking trails.\n' > README.md
cat > src/trail.ts <<'EOF'
export type Trail = {
  name: string
  lengthKm: number
}

export function describe(trail: Trail): string {
  return `${trail.name} (${trail.lengthKm} km)`
}
EOF
cat > src/index.ts <<'EOF'
import { describe } from './trail'

console.log(describe({ name: 'Nuuksio loop', lengthKm: 7.5 }))
EOF
c "3 days ago" "Start the trail notebook"
git switch -q -c feat/trail-difficulty
cat > src/trail.ts <<'EOF'
export type Trail = {
  name: string
  lengthKm: number
  /** Total climb over the whole trail, in metres. */
  climbM: number
}

export function describe(trail: Trail): string {
  return `${trail.name} (${trail.lengthKm} km, ↑${trail.climbM} m)`
}
EOF
cat > src/index.ts <<'EOF'
import { describe } from './trail'

console.log(describe({ name: 'Nuuksio loop', lengthKm: 7.5, climbM: 180 }))
EOF
c "2 days ago" "Record the climb of every trail"
cat > src/difficulty.ts <<'EOF'
import type { Trail } from './trail'

export type Difficulty = 'easy' | 'moderate' | 'hard'

/** A rough grade: about 100 m of climb weighs like one more kilometre. */
export function difficulty(trail: Trail): Difficulty {
  const effort = trail.lengthKm + trail.climbM / 100
  if (effort < 8) return 'easy'
  if (effort < 15) return 'moderate'
  return 'hard'
}
EOF
cat > src/index.ts <<'EOF'
import { difficulty } from './difficulty'
import { describe } from './trail'

const trail = { name: 'Nuuksio loop', lengthKm: 7.5, climbM: 180 }
console.log(`${describe(trail)} · ${difficulty(trail)}`)
EOF
c "1 day ago" "Grade trails as easy, moderate or hard"
cat > tests/difficulty.test.ts <<'EOF'
import { expect, test } from 'vitest'
import { difficulty } from '../src/difficulty'

test('a short flat walk is easy', () => {
  expect(difficulty({ name: 'Park', lengthKm: 3, climbM: 20 })).toBe('easy')
})

test('a long climb is hard', () => {
  expect(difficulty({ name: 'Halti', lengthKm: 12, climbM: 650 })).toBe('hard')
})
EOF
c "5 hours ago" "Test the difficulty grades"
printf '\nEvery trail records its length and climb, and gets a difficulty grade:\neasy, moderate or hard.\n' >> README.md
sed -i 's/if (effort < 15)/if (effort < 14)/' src/difficulty.ts
c "40 minutes ago" "Explain the grades in the README and tighten the moderate band to under 14 effort points"
