import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useState } from "react";
import type { SidebarContextMenuState } from "@/features/decks/components/editor/sidebar/types";

export function useSidebarContextMenu() {
  const [contextMenu, setContextMenu] = useState<SidebarContextMenuState>(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const openSectionContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>, sectionId: string) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        sectionId,
        insertIndex: 0,
      });
    },
    [],
  );

  const openCardContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>, sectionId: string, cardId: string, cardIndex: number) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        sectionId,
        insertIndex: cardIndex + 1,
        cardId,
      });
    },
    [],
  );

  useEffect(() => {
    if (!contextMenu) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };

    window.addEventListener("click", closeContextMenu);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("keydown", onEscape);
    };
  }, [contextMenu, closeContextMenu]);

  return {
    contextMenu,
    closeContextMenu,
    openSectionContextMenu,
    openCardContextMenu,
  };
}
