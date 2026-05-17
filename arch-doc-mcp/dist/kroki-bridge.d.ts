export type KrokiDiagramType = "mermaid" | "plantuml" | "c4plantuml" | "graphviz" | "d2" | "erd" | "bpmn" | "excalidraw";
export type KrokiOutputFormat = "svg" | "png" | "pdf" | "jpeg";
export interface RenderRequest {
    diagramType: KrokiDiagramType;
    dsl: string;
    outputFormat?: KrokiOutputFormat;
}
export interface RenderResult {
    url: string;
    diagramType: KrokiDiagramType;
    outputFormat: KrokiOutputFormat;
    mermaidBlock: string;
}
export declare function buildKrokiUrl(diagramType: string, dsl: string, format: string): string;
export declare function renderDiagram(req: RenderRequest): Promise<RenderResult>;
export declare const TEMPLATE_KROKI_MAP: Record<string, {
    type: KrokiDiagramType;
    dslHint: string;
}>;
export declare function buildDslPrompt(templateId: string, systemName: string, description: string): string;
