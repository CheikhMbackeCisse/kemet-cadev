/**
 * Le plus gros corps JSON légitime, un skill de 20 000 caractères, reste loin
 * de cette borne. Elle réduit le coût de la validation par zod 3 d'un tableau
 * géant (GHSA-mrhx-c7xc-m3w5), que `.max()` ne coupe pas avant la fin.
 */
export const JSON_BODY_LIMIT_BYTES = 100 * 1024;
