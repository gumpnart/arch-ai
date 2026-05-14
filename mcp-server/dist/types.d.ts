export type ElementType = "rectangle" | "ellipse" | "diamond" | "line" | "arrow" | "text" | "image" | "freedraw";
export type FillStyle = "solid" | "hachure" | "cross-hatch" | "dots" | "none";
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type Arrowhead = "arrow" | "bar" | "dot" | "triangle" | "circle" | null;
export type TextAlign = "left" | "center" | "right";
export type FontFamily = 1 | 2 | 3;
export interface BaseElement {
    id: string;
    type: ElementType;
    x: number;
    y: number;
    width: number;
    height: number;
    angle: number;
    strokeColor: string;
    backgroundColor: string;
    fillStyle: FillStyle;
    strokeWidth: number;
    strokeStyle: StrokeStyle;
    roughness: number;
    opacity: number;
    groupIds: string[];
    frameId: null;
    roundness: {
        type: number;
    } | null;
    seed: number;
    version: number;
    versionNonce: number;
    isDeleted: boolean;
    boundElements: Array<{
        id: string;
        type: "arrow" | "text";
    }> | null;
    updated: number;
    link: string | null;
    locked: boolean;
}
export interface TextElement extends BaseElement {
    type: "text";
    text: string;
    fontSize: number;
    fontFamily: FontFamily;
    textAlign: TextAlign;
    verticalAlign: "top" | "middle" | "bottom";
    baseline: number;
    containerId: string | null;
    originalText: string;
    lineHeight: number;
}
export interface LinearElement extends BaseElement {
    type: "line" | "arrow";
    points: [number, number][];
    lastCommittedPoint: null;
    startBinding: {
        elementId: string;
        focus: number;
        gap: number;
    } | null;
    endBinding: {
        elementId: string;
        focus: number;
        gap: number;
    } | null;
    startArrowhead: Arrowhead;
    endArrowhead: Arrowhead;
}
export interface ImageElement extends BaseElement {
    type: "image";
    status: "saved";
    fileId: string;
    scale: [1, 1];
}
export type ExcalidrawElement = BaseElement | TextElement | LinearElement | ImageElement;
export interface ExcalidrawFileEntry {
    mimeType: string;
    id: string;
    dataURL: string;
    created: number;
    lastRetrieved: number;
}
export interface ExcalidrawScene {
    type: "excalidraw";
    version: 2;
    source: string;
    elements: ExcalidrawElement[];
    appState: {
        gridSize: null;
        viewBackgroundColor: string;
    };
    files: Record<string, ExcalidrawFileEntry>;
}
export interface ElementSpec {
    /** Element type */
    type: ElementType;
    /** X position (top-left corner) */
    x: number;
    /** Y position (top-left corner) */
    y: number;
    /** Width (required for shapes; for text, auto-sized if omitted) */
    width?: number;
    /** Height (required for shapes; for text, auto-sized if omitted) */
    height?: number;
    /** Text content (for type=text, or label shorthand for shapes) */
    text?: string;
    /** Stroke / border color (hex) */
    strokeColor?: string;
    /** Fill / background color (hex or "transparent") */
    backgroundColor?: string;
    fillStyle?: FillStyle;
    strokeWidth?: number;
    strokeStyle?: StrokeStyle;
    /** Roughness 0=clean 1=normal 2=sketchy */
    roughness?: number;
    /** Opacity 0–100 */
    opacity?: number;
    /** Font size for text (default 20) */
    fontSize?: number;
    /** Font family: 1=hand, 2=normal, 3=mono */
    fontFamily?: FontFamily;
    textAlign?: TextAlign;
    /** Points for line/arrow [[x,y], [x,y], ...] (relative to x,y) */
    points?: [number, number][];
    /** Arrow start head */
    startArrowhead?: Arrowhead;
    /** Arrow end head (default "arrow") */
    endArrowhead?: Arrowhead;
    /** Round corners? */
    rounded?: boolean;
    /** ID to bind arrow start to */
    startBindingId?: string;
    /** ID to bind arrow end to */
    endBindingId?: string;
}
export interface DiagramFrontmatter {
    title: string;
    format: string;
    scene: string;
    fileId: string;
    elementId: string;
    tags?: string[];
    created: string;
    updated: string;
    description?: string;
}
//# sourceMappingURL=types.d.ts.map