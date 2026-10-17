import { describe, expect, test } from 'claude-code/testing'

import { fitHunks, fitText, hunksOf, joinChanges, parseLog, parseNameStatus, parseNumstat, parseWorktrees } from '../hooks/git'

const SHA_A = 'a'.repeat(40)
const SHA_B = 'b'.repeat(40)

describe('parsers', () => {
  test('worktrees: branches, detached, locked; bare and prunable left out', async () => {
    const text = [
      `worktree /repo`, `HEAD ${SHA_A}`, `branch refs/heads/main`, ``,
      `worktree /repo-x`, `HEAD ${SHA_B}`, `detached`, `locked reason`, ``,
      `worktree /bare`, `bare`, ``,
      `worktree /gone`, `HEAD ${SHA_B}`, `detached`, `prunable gitdir file points to non-existent location`, ``,
    ].join('\0')
    expect(parseWorktrees(text)).toEqual([
      { path: '/repo', head: SHA_A, branch: 'main', isLocked: false },
      { path: '/repo-x', head: SHA_B, branch: null, isLocked: true },
    ])
  })

  test('log: fields, merge parents, a subject holding the field separator', async () => {
    const one = [SHA_A, 'aaaaaaa', `${SHA_B} ${SHA_B}`, 'Lucia', '2 hours ago', 'Merge x'].join('\x1f')
    const two = [SHA_B, 'bbbbbbb', '', 'Ann', '3 days ago', 'odd\x1fsubject'].join('\x1f')
    const [merge, root] = parseLog(`${one}\0${two}\n`)
    expect(merge?.parents.length).toBe(2)
    expect(root?.parents).toEqual([])
    expect(root?.subject).toBe('odd\x1fsubject')
  })

  test('name-status and numstat: renames, spaces, binaries', async () => {
    const names = parseNameStatus(['M', 'dir with space/a b.txt', 'R087', 'old.ts', 'new.ts', 'A', 'img.png', ''].join('\0'))
    expect(names).toEqual([
      { status: 'M', path: 'dir with space/a b.txt', oldPath: null },
      { status: 'R', path: 'new.ts', oldPath: 'old.ts' },
      { status: 'A', path: 'img.png', oldPath: null },
    ])
    const stats = parseNumstat(['1\t1\tdir with space/a b.txt', '3\t2\t', 'old.ts', 'new.ts', '-\t-\timg.png', ''].join('\0'))
    const joined = joinChanges(names, stats)
    expect(joined[1]).toEqual({ status: 'R', path: 'new.ts', oldPath: 'old.ts', isBinary: false, added: 3, deleted: 2 })
    expect(joined[2]?.isBinary).toBe(true)
  })
})

describe('fitting', () => {
  test('hunksOf drops the git headers', async () => {
    const patch = 'diff --git a/x b/x\nindex 1..2 100644\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b\n'
    expect(hunksOf(patch)).toBe('@@ -1 +1 @@\n-a\n+b')
    expect(hunksOf('diff --git a/x b/x\nold mode 100644\nnew mode 100755\n')).toBe('')
  })

  test('a cut hunk gets a header that counts what is kept', async () => {
    const body = Array.from({ length: 50 }, (_, i) => (i % 2 ? `+add ${i}` : ` ctx ${i}`))
    const hunks = ['@@ -10,25 +10,50 @@ fn()', ...body].join('\n')
    const { source, isTruncated } = fitHunks(hunks, 120)
    expect(isTruncated).toBe(true)
    const lines = source.split('\n')
    const kept = lines.slice(1)
    const context = kept.filter(line => line.startsWith(' ')).length
    const added = kept.filter(line => line.startsWith('+')).length
    expect(lines[0]).toBe(`@@ -10,${context} +10,${context + added} @@ fn()`)
  })

  test('fitText cuts on a line boundary', async () => {
    const { source, isTruncated } = fitText('aaaa\nbbbb\ncccc\n', 11)
    expect(isTruncated).toBe(true)
    expect(source).toBe('aaaa\nbbbb')
  })
})
