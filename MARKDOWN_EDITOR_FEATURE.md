# Markdown Editor Feature

## 1. Feature Overview

The Markdown Editor feature extends the existing JSON and Rich Text editor applications by providing a dedicated, split-screen Markdown environment. Users can write markdown in the left pane and instantly see a live preview in the right pane. The markdown editor seamlessly integrates with the existing system, ensuring auto-saving, secure links, real-time collaboration via WebSockets, and file uploads work identically to existing JSON and Text editors.

## 2. Component Architecture

- **MarkdownEditor.tsx**: The core UI component containing the Left pane (Raw text input) and Right pane (Rendered markdown view).
- **Split Screen with Resizer**: Features a draggable midpoint to resize both editors, mirroring the `TreeExplorer` interface.
- **EditorPage.tsx Integration**: Conditionally renders `MarkdownEditor` alongside `JsonEditor` and `RichTextEditor` based on the document type.
- **Header Additions**: File upload modals and standard menus have been upgraded to recognize `.md` files as standard document types.

## 3. Routing Setup

- **New Path**: `app/editor/markdown/[slug]/page.tsx`
- **Logic**: Implements Server-Side Rendering (SSR) fetching using Next.js `fetch` to retrieve the initial payload based on the slug. Handles validation, authorization checks, and redirects invalid slugs gracefully back to `/editor`.
- **Containerization**: Hands over control to the `EditorPage` wrapper component specifying `featureMode='markdown'`.

## 4. Markdown Rendering System

The architecture uses the React-friendly `react-markdown` ecosystem to ensure safe data rendering.

- **Dependencies**:
  - `react-markdown` (Base parser)
  - `remark-gfm` (GitHub Flavored Markdown support, covering tables, tasks, strikethrough, auto-links)
  - `rehype-sanitize` (Protection against XSS via rigorous tag/attribute stripping)
- **Styling**: Leverages `@tailwindcss/typography` patterns via arbitrary nested classes (`prose prose-zinc dark:prose-invert`) for dark/light mode consistency across the JSON Rock UI.
- **Debouncing**: A 300ms debounce custom hook minimizes excessive re-renders during fast typing for the preview renderer.

## 5. Real-Time Collaboration Integration

Sockets and synchronous state sharing require no specific feature coding, but rather leverage existing infrastructure.

- **Socket Hooks**: Because `EditorPage.tsx` maintains its role as a central state controller wrapper, socket connections (`join-room`, `code-change` emissions) operate exactly the same way across all editors.
- **Live Dispatch**: Text changes on the Markdown input immediately push formatted string values through the WebSocket bus, broadcasting to all linked sessions just like standard JSON blobs.
- **Auto-save Storage**: Reuses the core database endpoints via `PUT /api/share/[slug]`.

## 6. Future Improvements

- Integrating syntax highlighting for inner code-blocks inside the rendered preview.
- Export parameters for PDF or raw HTML generated outputs.
- Keyboard macro shortcuts (e.g., cmd+b for bold) in the raw viewer.
- Real-time cursor presence indicator within the raw input block for synchronous paired typing sessions.
