import { messagingApi } from "@line/bot-sdk";

export interface LineClientConfig {
  channelAccessToken?: string;
}

export class LineApiClient {
  private client: messagingApi.MessagingApiClient;
  private token: string;

  constructor(config?: LineClientConfig) {
    this.token =
      config?.channelAccessToken ||
      process.env.LINE_CHANNEL_ACCESS_TOKEN ||
      "mock_access_token";
    this.client = new messagingApi.MessagingApiClient({
      channelAccessToken: this.token,
    });
  }

  /**
   * Replies to a webhook event using a short-lived reply token
   */
  async replyMessage(replyToken: string, messages: messagingApi.Message[]) {
    try {
      return await this.client.replyMessage({
        replyToken,
        messages,
      });
    } catch (error) {
      console.error("[LineApiClient] replyMessage error:", error);
      throw error;
    }
  }

  /**
   * Pushes a message directly to a user or group
   */
  async pushMessage(to: string, messages: messagingApi.Message[]) {
    try {
      return await this.client.pushMessage({
        to,
        messages,
      });
    } catch (error) {
      console.error("[LineApiClient] pushMessage error:", error);
      throw error;
    }
  }

  /**
   * Triggers the LINE Loading Indicator in the chat (Typing animation)
   * Endpoint: POST https://api.line.me/v2/bot/chat/loading/start
   */
  async showLoadingAnimation(chatId: string, loadingSeconds: number = 20): Promise<boolean> {
    try {
      const response = await fetch("https://api.line.me/v2/bot/chat/loading/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          chatId,
          loadingSeconds: Math.min(Math.max(loadingSeconds, 5), 60),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[LineApiClient] Loading animation response status ${response.status}: ${errText}`);
        return false;
      }
      return true;
    } catch (err) {
      console.warn("[LineApiClient] Failed to trigger loading animation:", err);
      return false;
    }
  }

  /**
   * Fetches image message content binary as an ArrayBuffer
   */
  async getMessageContent(messageId: string): Promise<ArrayBuffer> {
    const response = await fetch(
      `https://api-data.line.me/v2/bot/message/${messageId}/content`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to download LINE message content: ${response.statusText}`);
    }

    return await response.arrayBuffer();
  }

  /**
   * Fetches member profile in a group
   */
  async getGroupMemberProfile(groupId: string, userId: string) {
    try {
      return await this.client.getGroupMemberProfile(groupId, userId);
    } catch (error) {
      console.warn(`[LineApiClient] Could not fetch group member profile: ${error}`);
      return null;
    }
  }
}

export const defaultLineClient = new LineApiClient();
