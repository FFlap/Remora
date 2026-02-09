import { z } from "zod";
import {
  ACCESS_REQUEST_STATUS_VALUES,
  DECK_VISIBILITY_VALUES,
  EDIT_MODE_VALUES,
  MAX_ACCESS_REQUEST_MESSAGE_LENGTH,
  MAX_DECK_DESCRIPTION_LENGTH,
  MAX_DECK_TITLE_LENGTH,
  MAX_WHITELIST_EMAILS,
} from "./deckConstants";

export {
  ACCESS_REQUEST_STATUS_VALUES,
  DECK_VISIBILITY_VALUES,
  EDIT_MODE_VALUES,
  MAX_ACCESS_REQUEST_MESSAGE_LENGTH,
  MAX_DECK_DESCRIPTION_LENGTH,
  MAX_DECK_TITLE_LENGTH,
  MAX_WHITELIST_EMAILS,
};

const normalizedEmailSchema = z.string().trim().toLowerCase().email().max(320);

export const deckMetaInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Deck title is required")
    .max(MAX_DECK_TITLE_LENGTH, `Deck title must be ${MAX_DECK_TITLE_LENGTH} characters or fewer`),
  description: z
    .string()
    .trim()
    .max(
      MAX_DECK_DESCRIPTION_LENGTH,
      `Deck description must be ${MAX_DECK_DESCRIPTION_LENGTH} characters or fewer`,
    )
    .default(""),
});

export const deckSharingInputSchema = z
  .object({
    visibility: z.enum(DECK_VISIBILITY_VALUES),
    whitelistEmails: z
      .array(normalizedEmailSchema)
      .max(MAX_WHITELIST_EMAILS, `Whitelist supports up to ${MAX_WHITELIST_EMAILS} emails`),
  })
  .transform(({ visibility, whitelistEmails }) => ({
    visibility,
    whitelistEmails: Array.from(new Set(whitelistEmails)),
  }));

export const accessRequestMessageSchema = z
  .string()
  .trim()
  .max(
    MAX_ACCESS_REQUEST_MESSAGE_LENGTH,
    `Message must be ${MAX_ACCESS_REQUEST_MESSAGE_LENGTH} characters or fewer`,
  )
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

export type DeckVisibilityValue = z.infer<typeof deckSharingInputSchema>["visibility"];
export type EditModeValue = (typeof EDIT_MODE_VALUES)[number];
export type AccessRequestStatusValue = (typeof ACCESS_REQUEST_STATUS_VALUES)[number];

export function parseDeckMetaInput(value: unknown) {
  return deckMetaInputSchema.parse(value);
}

export function parseDeckSharingInput(value: unknown) {
  return deckSharingInputSchema.parse(value);
}

export function parseAccessRequestMessage(value: unknown) {
  return accessRequestMessageSchema.parse(value);
}
