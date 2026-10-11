/**
 * Configuration modifiable du noyau.
 *
 * reverseOverrides : table optionnelle, vide par défaut, pour corriger plus tard
 * les drapeaux `reverse` du PMP sans toucher aux données.
 * Clé : identifiant de question (ex. 'Q4'). Valeur : true force l'inversion
 * (valeur = 6 moins la réponse), false l'interdit. Une clé absente laisse le
 * drapeau des données tel quel.
 */
export const pmpConfig: { reverseOverrides: Record<string, boolean> } = {
  reverseOverrides: {},
}
