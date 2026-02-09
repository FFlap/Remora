import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";

export function useSidebarSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );
}
