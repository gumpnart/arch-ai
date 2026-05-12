import { randomBytes } from "crypto";
import type {
  ElementSpec,
  ExcalidrawElement,
  BaseElement,
  TextElement,
  LinearElement,
  FillStyle,
  StrokeStyle,
  FontFamily,
  TextAlign,
  Arrowhead,
} from "./types.js";

function genId(): string {
  return randomBytes(8).toString("hex");
}

function rng(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

function base(
  spec: ElementSpec,
  id = genId()
): BaseElement {
  const roundness =
    spec.rounded ?? false
      ? { type: 3 }   // type 3 = adaptive radius
      : null;

  return {
    id,
    type: spec.type as BaseElement["type"],
    x: spec.x,
    y: spec.y,
    width: spec.width ?? 200,
    height: spec.height ?? 100,
    angle: 0,
    strokeColor: spec.strokeColor ?? "#1e1e1e",
    backgroundColor: spec.backgroundColor ?? "transparent",
    fillStyle: (spec.fillStyle ?? "hachure") as FillStyle,
    strokeWidth: spec.strokeWidth ?? 2,
    strokeStyle: (spec.strokeStyle ?? "solid") as StrokeStyle,
    roughness: spec.roughness ?? 1,
    opacity: spec.opacity ?? 100,
    groupIds: [],
    frameId: null,
    roundness,
    seed: rng(),
    version: 1,
    versionNonce: rng(),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

export function buildElements(
  specs: ElementSpec[]
): { elements: ExcalidrawElement[]; idMap: Record<number, string> } {
  const elements: ExcalidrawElement[] = [];
  const idMap: Record<number, string> = {}; // spec index → element id

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const id = genId();
    idMap[i] = id;

    if (spec.type === "text") {
      elements.push(buildText(spec, id));
    } else if (spec.type === "line" || spec.type === "arrow") {
      elements.push(buildLinear(spec, id));
    } else {
      // Shape: rectangle, ellipse, diamond
      const el = base(spec, id) as ExcalidrawElement;
      elements.push(el);

      // Label shorthand: attach a text element to the shape
      if (spec.text) {
        const labelId = genId();
        const label = buildText(
          {
            type: "text",
            x: spec.x,
            y: spec.y + (spec.height ?? 100) / 2 - 10,
            width: spec.width ?? 200,
            height: 20,
            text: spec.text,
            fontSize: spec.fontSize ?? 16,
            fontFamily: spec.fontFamily ?? 1,
            textAlign: "center",
            strokeColor: spec.strokeColor ?? "#1e1e1e",
          },
          labelId,
          id  // containerId
        );
        // Bind text to container
        (el as BaseElement).boundElements = [{ id: labelId, type: "text" }];
        elements.push(label);
      }
    }
  }

  return { elements, idMap };
}

function buildText(
  spec: ElementSpec,
  id: string,
  containerId: string | null = null
): TextElement {
  const text = spec.text ?? "";
  const fontSize = spec.fontSize ?? 20;
  const lineHeight = 1.25;
  const lines = text.split("\n").length;
  const height = spec.height ?? Math.ceil(fontSize * lineHeight * lines);
  const width = spec.width ?? Math.max(text.length * fontSize * 0.6, 40);

  return {
    ...base({ ...spec, width, height }, id),
    type: "text",
    text,
    fontSize,
    fontFamily: (spec.fontFamily ?? 1) as FontFamily,
    textAlign: (spec.textAlign ?? "left") as TextAlign,
    verticalAlign: "top",
    baseline: Math.round(fontSize * 0.8),
    containerId,
    originalText: text,
    lineHeight,
  };
}

function buildLinear(spec: ElementSpec, id: string): LinearElement {
  const points: [number, number][] = spec.points ?? [[0, 0], [200, 0]];

  // Bounding box from points
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  const startBinding = spec.startBindingId
    ? { elementId: spec.startBindingId, focus: 0, gap: 8 }
    : null;
  const endBinding = spec.endBindingId
    ? { elementId: spec.endBindingId, focus: 0, gap: 8 }
    : null;

  return {
    ...base(
      {
        ...spec,
        width: maxX - minX || 1,
        height: maxY - minY || 1,
      },
      id
    ),
    type: spec.type as "line" | "arrow",
    points,
    lastCommittedPoint: null,
    startBinding,
    endBinding,
    startArrowhead: (spec.startArrowhead ?? null) as Arrowhead,
    endArrowhead: spec.type === "arrow"
      ? ((spec.endArrowhead ?? "arrow") as Arrowhead)
      : null,
  };
}
