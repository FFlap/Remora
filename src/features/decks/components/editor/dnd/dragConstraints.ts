import {
  restrictToFirstScrollableAncestor,
  restrictToHorizontalAxis,
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";

export const VERTICAL_BOUNDED_MODIFIERS = [
  restrictToVerticalAxis,
  restrictToParentElement,
  restrictToFirstScrollableAncestor,
];

export const HORIZONTAL_BOUNDED_MODIFIERS = [
  restrictToHorizontalAxis,
  restrictToParentElement,
  restrictToFirstScrollableAncestor,
];
