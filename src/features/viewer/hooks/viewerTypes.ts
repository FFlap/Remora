import type { useDeckForViewer } from "@/features/decks/api/useDecksApi";
import type { Doc } from "@/lib/convexApi";

export type ViewerData = NonNullable<ReturnType<typeof useDeckForViewer>>;
export type ViewerGrantedData = Extract<ViewerData, { access: "granted" }>;
export type ViewerDeniedData = Exclude<ViewerData, { access: "granted" }>;

export type ViewerSide = Doc<"cardSides">;
export type ViewerCard = Doc<"cards"> & { sides: ViewerSide[] };
export type ViewerSection = Doc<"sections"> & { cards: ViewerCard[] };

export type OrderedViewerCard = {
  cardId: string;
  sectionId: string;
  sectionTitle: string;
  card: ViewerCard;
  sectionCardIndex: number;
};
