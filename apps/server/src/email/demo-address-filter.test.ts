import { describe, expect, it } from "vitest";
import { DemoAddressFilter } from "./demo-address-filter.js";
import { InMemoryEmailSender } from "./in-memory-email-sender.js";

describe("DemoAddressFilter", () => {
  it("n'envoie rien vers une adresse de démonstration", async () => {
    const inner = new InMemoryEmailSender();
    await new DemoAddressFilter(inner).send({
      to: "skander.jaziri@demo.kemetlabs.dev",
      subject: "s",
      html: "h",
    });
    expect(inner.sent).toHaveLength(0);
  });

  it("transmet tout autre envoi", async () => {
    const inner = new InMemoryEmailSender();
    await new DemoAddressFilter(inner).send({
      to: "quelqu-un@test.kemet",
      subject: "s",
      html: "h",
    });
    expect(inner.sent).toHaveLength(1);
  });
});
