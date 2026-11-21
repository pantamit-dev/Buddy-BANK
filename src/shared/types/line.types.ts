import type {
  WebhookEvent,
  MessageEvent,
  PostbackEvent,
  JoinEvent,
  FlexMessage,
  TextMessage,
  FlexBubble,
} from "@line/bot-sdk";

export type { WebhookEvent, MessageEvent, PostbackEvent, JoinEvent, FlexMessage, TextMessage, FlexBubble };

export type PostbackActionType = "approve_deposit" | "reject_deposit" | "open_liff";

export interface DepositPostbackData {
  action: "approve" | "reject";
  depositId: string;
  groupId: string;
}

export interface LineUserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}
