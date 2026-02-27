import { Node, mergeAttributes } from '@tiptap/core';

/**
 * PageNode Extension
 * 
 * Creates explicit page containers in the document.
 * Each page has a fixed content height and visual styling.
 */

export interface PageOptions {
    pageHeight: number;
    pageGap: number;
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
}

export const PageNode = Node.create<PageOptions>({
    name: 'page',

    group: 'page',

    content: 'block+',

    defining: true,

    addOptions() {
        return {
            pageHeight: 1123,
            pageGap: 40,
            marginTop: 96,
            marginBottom: 96,
            marginLeft: 72,
            marginRight: 72,
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-page]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const { pageHeight, marginTop, marginBottom, marginLeft, marginRight } = this.options;
        const contentHeight = pageHeight - marginTop - marginBottom;

        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-page': 'true',
                'class': 'editor-page',
                'style': `
                    height: ${pageHeight}px;
                    min-height: ${pageHeight}px;
                    max-height: ${pageHeight}px;
                    padding-top: ${marginTop}px;
                    padding-bottom: ${marginBottom}px;
                    padding-left: ${marginLeft}px;
                    padding-right: ${marginRight}px;
                    background: white;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
                    margin-bottom: ${this.options.pageGap}px;
                    box-sizing: border-box;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                `.replace(/\s+/g, ' ').trim(),
            }),
            [
                'div',
                {
                    'class': 'page-content',
                    'data-page-content': 'true',
                    'style': `
                        flex: 1;
                        min-height: 0;
                        display: flex;
                        flex-direction: column;
                        max-height: ${contentHeight}px;
                        overflow: hidden;
                        position: relative;
                    `.replace(/\s+/g, ' ').trim(),
                },
                0, // Content goes here
            ],
        ];
    },

    addKeyboardShortcuts() {
        return {
            // Prevent deleting a page with backspace at the start
            Backspace: ({ editor }) => {
                const { state } = editor;
                const { selection } = state;
                const { $from } = selection;

                // If at the very start of a page, don't delete the page
                if ($from.parentOffset === 0 && $from.depth > 1) {
                    const pageNode = $from.node($from.depth - 1);
                    if (pageNode.type.name === 'page') {
                        // Check if this page has content
                        if (pageNode.content.size > 2) {
                            return false; // Allow normal backspace
                        }
                        // Don't delete the last page
                        const pageCount = state.doc.content.childCount;
                        if (pageCount <= 1) {
                            return true; // Prevent deletion
                        }
                    }
                }
                return false;
            },
        };
    },
});
