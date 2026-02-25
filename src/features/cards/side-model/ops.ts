import type { SideElement, SideModel } from "./types";

export type SideOperation =
  | { kind: "addElement"; element: SideElement; index?: number }
  | { kind: "removeElement"; elementId: string }
  | { kind: "updateElement"; elementId: string; patch: Partial<SideElement> }
  | {
      kind: "transformElement";
      elementId: string;
      creative: Partial<SideElement["creative"]>;
    }
  | { kind: "reorderElement"; elementId: string; toIndex: number }
  | { kind: "setQuickProjection"; quickLayout: SideModel["layout"]["quickLayout"] }
  | {
      kind: "setCreativeProjection";
      creativeLayout: Partial<SideModel["layout"]["creativeLayout"]>;
    }
  | { kind: "replaceElement"; elementId: string; element: SideElement };

type AppliedOperation = {
  next: SideModel;
  inverse: SideOperation[];
};

function cloneSideModel(side: SideModel): SideModel {
  if (typeof structuredClone === "function") {
    return structuredClone(side);
  }
  return JSON.parse(JSON.stringify(side)) as SideModel;
}

function applyOperation(side: SideModel, op: SideOperation): AppliedOperation {
  const draft = cloneSideModel(side);
  const idx = "elementId" in op ? draft.elements.findIndex((el) => el.id === op.elementId) : -1;

  switch (op.kind) {
    case "addElement": {
      const targetIndex = op.index ?? draft.elements.length;
      const bounded = Math.max(0, Math.min(targetIndex, draft.elements.length));
      draft.elements.splice(bounded, 0, op.element);
      return {
        next: draft,
        inverse: [{ kind: "removeElement", elementId: op.element.id }],
      };
    }
    case "removeElement": {
      if (idx < 0) {
        return { next: draft, inverse: [] };
      }
      const removed = draft.elements[idx];
      draft.elements.splice(idx, 1);
      return {
        next: draft,
        inverse: [{ kind: "addElement", element: removed, index: idx }],
      };
    }
    case "updateElement": {
      if (idx < 0) {
        return { next: draft, inverse: [] };
      }
      const previous = draft.elements[idx];
      draft.elements[idx] = { ...draft.elements[idx], ...op.patch } as SideElement;
      return {
        next: draft,
        inverse: [{ kind: "replaceElement", elementId: op.elementId, element: previous }],
      };
    }
    case "transformElement": {
      if (idx < 0) {
        return { next: draft, inverse: [] };
      }
      const previous = draft.elements[idx];
      draft.elements[idx] = {
        ...draft.elements[idx],
        creative: {
          ...draft.elements[idx].creative,
          ...op.creative,
        },
      } as SideElement;

      return {
        next: draft,
        inverse: [{ kind: "replaceElement", elementId: op.elementId, element: previous }],
      };
    }
    case "reorderElement": {
      if (idx < 0) {
        return { next: draft, inverse: [] };
      }
      const [element] = draft.elements.splice(idx, 1);
      const bounded = Math.max(0, Math.min(op.toIndex, draft.elements.length));
      draft.elements.splice(bounded, 0, element);
      return {
        next: draft,
        inverse: [{ kind: "reorderElement", elementId: op.elementId, toIndex: idx }],
      };
    }
    case "setQuickProjection": {
      const prev = draft.layout.quickLayout;
      draft.layout.quickLayout = op.quickLayout;
      return {
        next: draft,
        inverse: [{ kind: "setQuickProjection", quickLayout: prev }],
      };
    }
    case "setCreativeProjection": {
      const prev = draft.layout.creativeLayout;
      draft.layout.creativeLayout = {
        ...draft.layout.creativeLayout,
        ...op.creativeLayout,
      };
      return {
        next: draft,
        inverse: [{ kind: "setCreativeProjection", creativeLayout: prev }],
      };
    }
    case "replaceElement": {
      if (idx < 0) {
        return { next: draft, inverse: [] };
      }
      const previous = draft.elements[idx];
      draft.elements[idx] = op.element;
      return {
        next: draft,
        inverse: [{ kind: "replaceElement", elementId: op.elementId, element: previous }],
      };
    }
    default: {
      return { next: draft, inverse: [] };
    }
  }
}

export function applyOperations(side: SideModel, operations: SideOperation[]) {
  let current = cloneSideModel(side);
  const inverses: SideOperation[] = [];

  for (const operation of operations) {
    const applied = applyOperation(current, operation);
    current = applied.next;
    inverses.unshift(...applied.inverse);
  }

  return { next: current, inverse: inverses };
}
