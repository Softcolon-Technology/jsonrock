# JSONROCK 🚀

**JSONROCK** is a powerful, real-time JSON visualization and collaboration tool designed to make working with complex JSON data clearer, faster, and more secure. It goes beyond simple formatting by offering interactive Graph and Tree visualizations, real-time collaboration, and secure sharing capabilities.

---

## ✨ Key Features

### 1. 📊 Interactive Visualizations
*   **Graph View**: Automatically transforms nested JSON into an interactive node-based graph using **React Flow**. Visualizes relationships and hierarchy instantly.
    *   **Interactive Controls**: Zoom, Pan, Fit View, and a custom **Lock Mode** to freeze the viewport.
    *   **Auto Layout**: Intelligent layout algorithms to organize nodes strictly.
*   **Tree View**: A hierarchical, collapsible explorer for deep-diving into large JSON structures.
    *   **Sync**: Clicking a node in the tree highlights relevant data in the property table.

### 2. 🛠️ Advanced JSON Editor & Formatter
*   **Monaco Editor**: Built on the same engine as VS Code, providing syntax highlighting, error validation, and code folding.
*   **Smart Formatting**: One-click configuration for indentation (2/3/4 tabs) or Minification.
*   **Validation**: Real-time syntax error detection with helpful line-number feedback.

### 3. ⚡ Real-Time Collaboration
*   **Live Sync**: Edit JSON data with colleagues in real-time. Changes made by one user are instantly reflected on all other devices viewing the same link.
*   **Socket.io Integration**: Powered by a custom Node.js server to handle rapid, bi-directional communication.

### 4. 🔒 Secure Sharing & File Management
*   **Instant Sharing**: Generate unique, short URLs (slugs) for your JSON data.
*   **Access Control**:
    *   **Ownership**: Creators are automatically marked as "Owners" via secure cookies, granting them exclusive rights to modify settings.
    *   **Permissions**: Toggle between **Public**, **Private**, **Editor**, or **Viewer** access types.
    *   **Password Protection**: Secure sensitive data with password-locked links.
*   **File Upload**: Drag-and-drop or select `.json` files to instantly ingest, validate, and create a shareable workspace.

---

## 🚀 Getting Started

Follow these steps to set up and run the project locally.

### Prerequisites
*   **Node.js** (v18+ recommended)
*   **npm** or **yarn**
*   **MongoDB** (Local instance or Atlas connection string)

### Installation

1.  **Clone the Repository**
    ```bash
    git clone <repository-url>
    cd json-cracker
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env` file in the root directory:
    ```env
    # Database Connection
    MONGODB_URI=mongodb://localhost:27017/json-cracker
    
    # Optional: Port (Defaults to 3000)
    PORT=3000
    ```

4.  **Run the Development Server**
    ```bash
    npm run dev
    ```

5.  **Access the Application**
    Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧠 Architectural Decisions

### Why Socket.io?
We chose **Socket.io** over standard REST polling or Server-Sent Events (SSE) to enable **true real-time, bi-directional collaboration**.

*   **How it Works**:
    *   When a user opens a shared link (`/share/[slug]`), they join a specific "Room" identified by that slug on the Socket server.
    *   **Debounced Emission**: As you type, the client waits for a brief pause (debounce) before emitting a `code-change` event.
    *   **Broadcasting**: The custom Node.js server (`server.ts`) listens for these events and broadcasts the new code to *everyone else* in that room, excluding the sender. This prevents cursor jumping and race conditions.
*   **Custom Server**: We use a custom `server.ts` to combine Next.js SSR with an active Socket.io instance on the same port, ensuring seamless connection handling without CORS issues in basic setups.

### Why MongoDB?
**MongoDB** was the ideal choice for this project due to its document-oriented nature.

*   **Schema Flexibility**: JSON data structure varies wildly. MongoDB stores data as BSON (Binary JSON), making it perfectly suited to store arbitrary user-uploaded JSON without complex SQL schema migrations.
*   **Performance**: Rapid reads and writes for retrieving shared snippets by unique slugs.
*   **TTL Indexes**: We can easily implement "Time To Live" indexes to automatically expire and clean up old, unused share links to save space.

### Handling Share Logic
The sharing system is designed to be **stateless but secure**.

1.  **Slugs**: We generate unique, URL-friendly identifiers (slugs) for each entry.
2.  **Ownership via Cookies**:
    *   We do not force users to create accounts. Instead, when you create a "New" JSON or "Upload" a file, we set a long-lived HTTP-only cookie (`json-cracker-owned`) containing the list of slugs you created.
    *   **Frontend Check**: The UI checks this cookie to decide if it should show you "Edit Password" or "Change Access" controls.
3.  **Security**:
    *   **Password Hashing**: Passwords for private links are never stored in plain text. We store a hash and verify it on the server API (`/api/share/[slug]`).
    *   **Server-Side Validation**: Even if a user bypasses the UI, the backend API verifies the password or ownership permissions before allowing updates `PUT` requests.

---

## 🛠️ Tech Stack

*   **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Editor**: [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react)
*   **Visualizations**: [React Flow](https://reactflow.dev/)
*   **Real-time**: [Socket.io](https://socket.io/)
*   **Database**: [MongoDB](https://www.mongodb.com/)
*   **Icons**: [Lucide React](https://lucide.dev/)
