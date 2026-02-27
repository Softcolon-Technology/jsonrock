import { Suspense } from "react";
import EditorPage from "./editor-page";

export default function Editor() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditorPage />
    </Suspense>
  );
}
