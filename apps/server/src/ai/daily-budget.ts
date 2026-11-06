import type Redis from "ioredis";

/**
 * Nombre d'appels permis par jour à un fournisseur, tous modèles confondus.
 * Sert à OpenRouter, dont l'offre gratuite s'arrête à 50 requêtes par jour :
 * on s'arrête un peu avant, pour garder de quoi lancer un test à la main.
 */
export interface DailyBudget {
  /** Compte un appel s'il reste du budget aujourd'hui ; `false` sinon, sans rien compter. */
  tryConsume(): Promise<boolean>;
}

// Le quota gratuit d'OpenRouter repart à minuit UTC : le compteur aussi.
function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Compteur dans Valkey : partagé par toutes les instances de l'API et
 * conservé après un redémarrage, contrairement à un compteur en mémoire qui
 * repartirait de zéro et laisserait dépasser le quota.
 */
export class RedisDailyBudget implements DailyBudget {
  constructor(
    private readonly client: Redis,
    private readonly name: string,
    private readonly limit: number,
  ) {}

  async tryConsume(): Promise<boolean> {
    const key = `llm-budget:${this.name}:${utcDay(new Date())}`;
    // Dans une même transaction : un processus qui s'arrête entre les deux
    // ne laisse pas une clé sans durée de vie.
    const results = await this.client
      .multi()
      .incr(key)
      .expire(key, 2 * 24 * 60 * 60, "NX")
      .exec();
    const [incrError, used] = results?.[0] ?? [new Error("transaction annulée"), null];
    if (incrError) throw incrError;
    if (Number(used) <= this.limit) return true;
    await this.client.decr(key);
    return false;
  }
}

/** Pour les tests et les evals, qui tournent sans Valkey. */
export class MemoryDailyBudget implements DailyBudget {
  private day = "";
  private used = 0;

  constructor(private readonly limit: number) {}

  async tryConsume(): Promise<boolean> {
    const today = utcDay(new Date());
    if (today !== this.day) {
      this.day = today;
      this.used = 0;
    }
    if (this.used >= this.limit) return false;
    this.used += 1;
    return true;
  }
}
