import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/**
 * PageManager Extension
 *
 * Manages automatic page creation and content overflow:
 * 1. Monitors content height within each page using scrollHeight
 * 2. When content overflows, moves excess to next page (creates if needed)
 * 3. Handles paste events and rapid content additions efficiently
 */

export interface PageManagerOptions {
  pageHeight: number
  marginTop: number
  marginBottom: number
}

export const PageManager = Extension.create<PageManagerOptions>({
  name: 'pageManager',

  addOptions() {
    return {
      pageHeight: 1123,
      marginTop: 96,
      marginBottom: 96,
    }
  },

  addProseMirrorPlugins() {
    const { pageHeight, marginTop, marginBottom } = this.options
    const contentHeight = pageHeight - marginTop - marginBottom
    const pluginKey = new PluginKey('pageManager')

    return [
      new Plugin({
        key: pluginKey,
        view(editorView) {
          let timeout: ReturnType<typeof setTimeout> | null = null
          let isProcessing = false
          let operationCount = 0
          const MAX_OPERATIONS = 50 // Increased for paste operations

          const checkOverflow = () => {
            if (isProcessing || operationCount >= MAX_OPERATIONS) return
            isProcessing = true
            operationCount++

            try {
              const { state } = editorView
              const { doc, schema } = state

              // Find all page nodes
              const pageContentDivs = editorView.dom.querySelectorAll(
                '[data-page-content]'
              )

              let actionTaken = false

              // Check each page for overflow
              for (
                let pageIndex = 0;
                pageIndex < pageContentDivs.length;
                pageIndex++
              ) {
                if (actionTaken) break

                const pageDiv = pageContentDivs[pageIndex] as HTMLElement
                const blocks = pageDiv.children

                // Calculate total height of all children to detect overflow
                // (we can't use scrollHeight anymore since parent has overflow:hidden)
                let totalChildrenHeight = 0
                for (let i = 0; i < blocks.length; i++) {
                  const block = blocks[i] as HTMLElement
                  totalChildrenHeight += block.offsetHeight
                }

                // If total children height exceeds content height, we have overflow
                if (totalChildrenHeight <= contentHeight + 5) {
                  continue // No overflow, check next page
                }

                let accumulatedHeight = 0
                let firstOverflowIndex = -1

                // Find which block causes the overflow
                for (let i = 0; i < blocks.length; i++) {
                  const block = blocks[i] as HTMLElement
                  const blockHeight = block.offsetHeight

                  // Check if adding this block would exceed the limit
                  if (accumulatedHeight + blockHeight > contentHeight + 5) {
                    firstOverflowIndex = i
                    break
                  }
                  accumulatedHeight += blockHeight
                }

                if (firstOverflowIndex < 0) continue

                // Find the page node in document
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ProseMirror node type
                let targetPageNode: any = null
                let targetPagePos = 0
                let currentPageIndex = 0

                doc.forEach((node, offset) => {
                  if (node.type.name === 'page') {
                    if (currentPageIndex === pageIndex) {
                      targetPageNode = node
                      targetPagePos = offset
                    }
                    currentPageIndex++
                  }
                })

                if (
                  !targetPageNode ||
                  firstOverflowIndex <= 0 ||
                  firstOverflowIndex >= targetPageNode.childCount
                ) {
                  continue
                }

                // Collect ALL content from firstOverflowIndex to end
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ProseMirror node array
                const contentToMove: any[] = []
                for (
                  let i = firstOverflowIndex;
                  i < targetPageNode.childCount;
                  i++
                ) {
                  contentToMove.push(targetPageNode.child(i))
                }

                if (contentToMove.length > 0) {
                  const tr = state.tr

                  // Calculate positions
                  let blockPos = targetPagePos + 1 // Start after page opening
                  for (let i = 0; i < firstOverflowIndex; i++) {
                    blockPos += targetPageNode.child(i).nodeSize
                  }

                  const deleteFrom = blockPos
                  const deleteTo = targetPagePos + targetPageNode.nodeSize - 1

                  // Check if next page exists
                  const nextPageIndex = pageIndex + 1
                  let nextPageExists = false
                  let nextPagePos = 0
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ProseMirror node type
                  let nextPageNode: any = null
                  let currentIdx = 0

                  doc.forEach((node, offset) => {
                    if (node.type.name === 'page') {
                      if (currentIdx === nextPageIndex) {
                        nextPageExists = true
                        nextPagePos = offset
                        nextPageNode = node
                      }
                      currentIdx++
                    }
                  })

                  if (nextPageExists && nextPageNode) {
                    // Prepend to existing next page
                    const insertPos = nextPagePos + 1 // After page opening tag

                    // Delete from current page first
                    tr.delete(deleteFrom, deleteTo)

                    // Insert at beginning of next page (adjust position after deletion)
                    const adjustedInsertPos =
                      insertPos - (deleteTo - deleteFrom)
                    contentToMove.forEach((node, idx) => {
                      tr.insert(adjustedInsertPos + idx, node)
                    })
                  } else if (schema.nodes.page) {
                    // Create new page with moved content
                    const newPage = schema.nodes.page.create(
                      null,
                      contentToMove
                    )

                    // Delete moved content from current page
                    tr.delete(deleteFrom, deleteTo)

                    // Insert new page after current page
                    const insertPos =
                      targetPagePos +
                      targetPageNode.nodeSize -
                      (deleteTo - deleteFrom)
                    tr.insert(insertPos, newPage)
                  }

                  editorView.dispatch(tr)
                  actionTaken = true
                }
              }

              // If we took action, schedule another check quickly
              if (actionTaken) {
                scheduleCheck(50) // Faster recheck
              } else {
                operationCount = 0 // Reset counter when no action needed
              }
            } catch (e) {
              console.error('PageManager error:', e)
              operationCount = 0 // Reset on error
            } finally {
              isProcessing = false
            }
          }

          const scheduleCheck = (delay = 100) => {
            if (timeout) clearTimeout(timeout)
            timeout = setTimeout(checkOverflow, delay)
          }

          // Initial check
          setTimeout(() => scheduleCheck(300), 300)

          return {
            update(view, prevState) {
              const docChanged = !view.state.doc.eq(prevState.doc)

              if (docChanged) {
                operationCount = 0 // Reset counter on doc change

                // Check immediately for paste events (large changes)
                const sizeDiff = Math.abs(
                  view.state.doc.nodeSize - prevState.doc.nodeSize
                )
                if (sizeDiff > 100) {
                  // Likely a paste or large insertion
                  scheduleCheck(10) // Very fast check
                } else {
                  scheduleCheck(50) // Normal typing speed
                }
              }
            },
            destroy() {
              if (timeout) clearTimeout(timeout)
            },
          }
        },
      }),
    ]
  },
})
