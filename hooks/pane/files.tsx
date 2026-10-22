// The commit's changed files: Prev and Next, the list with each file's status
// letter in colour (git's two letters for uncommitted files), and the
// selected file's whole name when its row is cut.

import { fileName, fileText } from '../labels'
import { LIST_ROWS } from '../state'
import type { Frame } from './frame'
import { rowList } from './list'

/** The colour of git's status letter in the file list. */
const STATUS_COLOR: Partial<Record<string, string>> = { A: '#2EA043', D: '#EF4444', R: '#3B82F6', C: '#3B82F6', M: '#E08A00' }

export function fileSection(f: Frame) {
  const { Box, Text, Button } = f.ui
  const { snap, sel } = f
  const at = snap.files.findIndex(one => one.path === sel.file)
  const file = snap.files[at]
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text>Files     </Text>
        <Button key="prev-file" hotkey="k" dimColor={at <= 0} onPress={() => void f.act.stepFile(-1)}>Prev</Button>
        <Button key="next-file" hotkey="j" dimColor={at < 0 || at >= snap.files.length - 1} onPress={() => void f.act.stepFile(1)}>Next</Button>
        <Text dimColor>{snap.files.length > 0 ? `${at + 1} of ${snap.files.length}` : 'none'}</Text>
      </Box>
      <Box flexDirection="column" borderStyle="round" borderDimColor>
        {rowList(f, {
          prefix: 'file',
          items: snap.files,
          at,
          keyOf: one => one.path,
          // An uncommitted file shows git's two letters, staged then unstaged (` M`, `MM`, `??`).
          tagOf: one => ({ text: one.xy ?? one.status, color: STATUS_COLOR[one.status] }),
          textOf: fileText,
          noun: { one: 'file', many: 'files' },
          onPick: one => void f.act.load('content', { file: one.path }),
        })}
      </Box>
      {file && fileText(file).length > f.inner - (snap.files.length > LIST_ROWS ? 2 : 0) - 6 ? (
        // The selected file's whole name when its row is cut: renames and deep paths, for every surface and the keyboard.
        <Text dimColor wrap="wrap">{`▶ ${fileName(file)}`}</Text>
      ) : null}
    </Box>
  )
}
