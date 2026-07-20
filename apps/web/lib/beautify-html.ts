import * as prettier from 'prettier/standalone'
import * as htmlPlugin from 'prettier/plugins/html'

/**
 * Browser-safe HTML formatter (Prettier standalone).
 * Replaces js-beautify, which crashes under Turbopack HMR.
 */
export async function beautifyHtmlSource(
  source: string,
  options?: {
    indent_size?: number
    wrap_line_length?: number
    end_with_newline?: boolean
  }
): Promise<string> {
  return prettier.format(source, {
    parser: 'html',
    plugins: [htmlPlugin],
    tabWidth: options?.indent_size ?? 2,
    printWidth: options?.wrap_line_length ?? 120,
    endOfLine: options?.end_with_newline === false ? 'lf' : 'lf',
    htmlWhitespaceSensitivity: 'css',
  })
}
