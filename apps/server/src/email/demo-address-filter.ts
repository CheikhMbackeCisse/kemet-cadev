import { isDemoEmailAddress } from "@kemet/shared";
import type { EmailMessage, EmailSender } from "./email-sender.js";

/**
 * Écarte tout envoi vers une adresse de démonstration : ces boîtes n'existent
 * pas, et chaque rejet renvoyé par le relais SMTP pénalise la délivrabilité
 * du domaine d'envoi. « Mot de passe oublié » reste ouvert à tout visiteur.
 */
export class DemoAddressFilter implements EmailSender {
  constructor(private readonly inner: EmailSender) {}

  async send(message: EmailMessage): Promise<void> {
    if (isDemoEmailAddress(message.to)) return;
    await this.inner.send(message);
  }
}
