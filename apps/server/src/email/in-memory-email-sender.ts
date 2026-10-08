import type { EmailMessage, EmailSender } from "./email-sender.js";

/** Implémentation de test : garde les messages en mémoire au lieu de les envoyer. */
export class InMemoryEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }

  findByRecipient(to: string): EmailMessage[] {
    return this.sent.filter((message) => message.to === to);
  }
}
