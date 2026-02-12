import { ChevronDown, ChevronRight } from "lucide-react";
import type { WheelEvent } from "react";
import { SideCardPreview } from "@/features/cards/components/SideCardPreview";
import { asSideModel } from "@/features/cards/side-model/types";
import type { ViewerSection } from "@/features/viewer/hooks/viewerTypes";
import { cn } from "@/lib/utils";

type DeckViewerSidebarProps = {
  sections: ViewerSection[];
  collapsedSections: Record<string, boolean>;
  selectedCardId?: string;
  onSelectCard: (cardId: string) => void;
  onToggleSection: (sectionId: string) => void;
};

export function DeckViewerSidebar({
  sections,
  collapsedSections,
  selectedCardId,
  onSelectCard,
  onToggleSection,
}: DeckViewerSidebarProps) {
  const scrollSidebarOnHoverWheel = (event: WheelEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const deltaY = event.deltaY;
    if (deltaY === 0) return;

    const maxScrollTop = container.scrollHeight - container.clientHeight;
    if (maxScrollTop <= 1) return;

    const atTop = container.scrollTop <= 1;
    const atBottom = container.scrollTop >= maxScrollTop - 1;
    if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) return;

    event.preventDefault();
    container.scrollTop = Math.min(maxScrollTop, Math.max(0, container.scrollTop + deltaY));
  };

  return (
    <aside className="deck-viewer-sidebar" data-testid="viewer-sidebar">
      <div className="deck-viewer-sidebar-header">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Card Position
        </h3>
      </div>

      <div
        className="deck-viewer-sidebar-scroll overflow-y-auto overflow-x-hidden"
        data-testid="viewer-sidebar-scroll"
        onWheelCapture={scrollSidebarOnHoverWheel}
      >
        <div className="space-y-2">
          {sections.map((section) => {
            const sectionId = String(section._id);
            const isCollapsed = collapsedSections[sectionId] ?? false;
            const isActiveSection = section.cards.some(
              (card) => String(card._id) === selectedCardId,
            );

            return (
              <section
                key={sectionId}
                data-testid={`viewer-section-${sectionId}`}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <div className="border-b border-border bg-muted/90 px-2 py-1.5 backdrop-blur-sm">
                  <button
                    type="button"
                    className="flex w-full items-center gap-1 text-left"
                    onClick={() => onToggleSection(sectionId)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate text-xs font-semibold tracking-wide">
                      {section.title}
                    </span>
                    {isActiveSection ? (
                      <span className="rounded bg-black px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-white">
                        active
                      </span>
                    ) : null}
                  </button>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] leading-4 text-muted-foreground">
                    <span className="inline-block h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      {section.cards.length} card{section.cards.length === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>

                {!isCollapsed ? (
                  <div className="space-y-2 p-2">
                    {section.cards.map((card, index) => {
                      const cardId = String(card._id);
                      const isActive = cardId === selectedCardId;
                      const front =
                        card.sides?.find((entry) => entry.index === 0) ?? card.sides?.[0];

                      return (
                        <button
                          key={cardId}
                          type="button"
                          data-testid={`viewer-card-item-${cardId}`}
                          onClick={() => onSelectCard(cardId)}
                          className={cn(
                            "relative w-full rounded-lg p-1 text-left transition-all",
                            isActive ? "opacity-100" : "opacity-80 hover:opacity-100",
                          )}
                        >
                          <span className="pointer-events-none absolute left-3 top-3 z-20 rounded bg-black/85 px-2 py-1 text-[11px] font-semibold leading-none text-white shadow-sm">
                            {index + 1}
                          </span>
                          <SideCardPreview
                            side={asSideModel(front?.sideModel)}
                            compact
                            className={cn(
                              "w-full transition-all",
                              isActive
                                ? "border-foreground ring-2 ring-foreground/25"
                                : "border-border hover:border-foreground/45",
                            )}
                            ariaHidden
                          />
                          <span className="sr-only">
                            Card {index + 1} in {section.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
