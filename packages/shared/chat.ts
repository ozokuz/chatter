export interface Person {
  id: string;
  name: string;
  username: string;
}

export interface ChatMessage {
  id: string;
  clientId: string;
  sender: Person;
  content: string;
  createdAt: string;
}

export interface SendMessage {
  clientId: string;
  content: string;
}

export type SendResult = { ok: true; message: ChatMessage } | { ok: false; error: string };

export interface ServerEvents {
  "message:new": (message: ChatMessage) => void;
  "presence:update": (userIds: string[]) => void;
}

export interface ClientEvents {
  "message:send": (payload: SendMessage, callback: (result: SendResult) => void) => void;
}

export interface MessagePage {
  messages: ChatMessage[];
  nextCursor: string | null;
}
