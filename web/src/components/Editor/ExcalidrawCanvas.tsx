import { forwardRef, useImperativeHandle, useRef } from "react";
import { Excalidraw, serializeAsJSON } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export interface ExcalidrawCanvasHandle {
  getJSON(): string | null;
}

interface Props {
  initialData: object | null;
  onDirtyChange: (dirty: boolean) => void;
}

export const ExcalidrawCanvas = forwardRef<ExcalidrawCanvasHandle, Props>(
  ({ initialData, onDirtyChange }, ref) => {
    const apiRef = useRef<any>(null);
    // Excalidraw fires onChange once on init — skip that first event
    const initRef = useRef(false);

    useImperativeHandle(ref, () => ({
      getJSON() {
        if (!apiRef.current) return null;
        return serializeAsJSON(
          apiRef.current.getSceneElements(),
          apiRef.current.getAppState(),
          apiRef.current.getFiles(),
          "local"
        );
      },
    }));

    return (
      <div style={{ width: "100%", height: "100%" }}>
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api;
          }}
          initialData={initialData as any}
          onChange={() => {
            if (!initRef.current) {
              initRef.current = true;
              return;
            }
            onDirtyChange(true);
          }}
        />
      </div>
    );
  }
);

ExcalidrawCanvas.displayName = "ExcalidrawCanvas";
