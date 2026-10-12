import { RETENTION } from './legal'

/**
 * Textes de l'espace client. Vouvoiement partout, sauf pour les catégories ado-etudes et ado-sport (tutoiement).
 * Aucun libellé ne mentionne un résultat ou un profil : le client ne voit jamais sa lecture.
 */
export interface ClientTexts {
  consent: {
    title: string
    intro: string
    infoTitle: string
    bullets: string[]
    label: string
    minorTitle: string
    minorText: string
    guardianLabel: string
    link: string
    cta: string
    error: string
  }
  guardianBlocked: { title: string; text: string }
  inactive: { title: string; text: string }
  thanks: { title: string; text: string; sign: string }
  test: {
    kicker: string
    intro: string
    start: string
    back: string
    next: string
    skip: string
    reset: string
    overview: string
    finish: string
    situationOf: (n: number, t: number) => string
    instruction: [string, string, string, string, string]
    hint: string
    rankLabels: string[]
    saved: string
    saving: string
    saveError: string
    resumeNotice: string
    progress: string
    reviewTitle: string
    reviewMissing: (n: number) => string
    reviewComplete: string
    goTo: string
    validate: string
    validateBlocked: string
    confirmTitle: string
    confirmText: string
    confirmYes: string
    confirmNo: string
    validating: string
    errorSubmit: string
    errorDone: string
    missingAria: (n: number) => string
  }
}

const VOUS: ClientTexts = {
  consent: {
    title: 'Avant de commencer',
    intro: 'Votre accès a été créé par A4P Mental. Merci de lire ce qui suit, puis de valider pour accéder à votre test.',
    infoTitle: 'Traitement de vos données',
    bullets: [
      'Responsable du traitement : A4P Mental, Alexandre Griffet.',
      'Données traitées : votre identité (nom et e-mail), la catégorie de votre test et vos réponses.',
      'Finalité : établir votre Bilan de Construction Mentale dans le cadre de votre accompagnement.',
      `Durée de conservation : ${RETENTION}.`,
      'Votre rapport complet vous est communiqué par votre coach, en dehors de cette plateforme. Il ne s\'affiche jamais ici.',
      'Le test ne peut être passé qu\'une seule fois. Vos réponses sont enregistrées au fur et à mesure : vous pouvez vous arrêter et reprendre plus tard.',
    ],
    label: 'J\'ai lu ces informations et j\'accepte que mes données soient traitées dans ce cadre.',
    minorTitle: '',
    minorText: '',
    guardianLabel: '',
    link: 'Lire la politique de confidentialité',
    cta: 'Accéder à mon test',
    error: 'L\'enregistrement a échoué. Réessayez dans un instant.',
  },
  guardianBlocked: {
    title: 'Votre test n\'est pas encore disponible',
    text: 'Contactez A4P Mental pour l\'activer.',
  },
  inactive: {
    title: 'Accès indisponible',
    text: 'Cet accès n\'est pas disponible pour le moment. Contactez A4P Mental.',
  },
  thanks: {
    title: 'Merci, vos réponses ont été enregistrées.',
    text: 'Votre coach vous communiquera votre rapport.',
    sign: 'A4P Mental, Alexandre Griffet',
  },
  test: {
    kicker: 'Construction mentale',
    intro: 'Pour chaque situation, classez les réponses qui vous ressemblent (au moins trois).',
    start: 'Commencer',
    back: '← Retour',
    next: 'Situation suivante →',
    skip: 'Passer pour l\'instant',
    reset: 'Recommencer cette situation',
    overview: 'Récapitulatif',
    finish: 'Terminer →',
    situationOf: (n, t) => `${n} / ${t}`,
    instruction: [
      'Touchez la réponse qui vous correspond le mieux : votre 1er choix.',
      'Touchez maintenant votre 2e choix.',
      'Touchez enfin votre 3e choix.',
      'Ajoutez d\'autres réponses si elles vous ressemblent, ou passez à la suite.',
      'Les six réponses sont classées. Touchez une réponse pour la retirer et modifier.',
    ],
    hint: 'Classez de la plus proche de vous à la moins proche, au moins trois réponses. Ne touchez pas celles qui ne vous ressemblent pas.',
    rankLabels: ['1er', '2e', '3e', '4e', '5e', '6e'],
    saved: 'Brouillon enregistré',
    saving: 'Enregistrement...',
    saveError: 'Enregistrement impossible, nouvel essai à la prochaine réponse',
    resumeNotice: 'Vos réponses précédentes ont été retrouvées. Vous reprenez là où vous vous étiez arrêté.',
    progress: 'Progression',
    reviewTitle: 'Récapitulatif de vos réponses',
    reviewMissing: (n) => (n === 1 ? 'Il reste 1 situation à compléter.' : `Il reste ${n} situations à compléter.`),
    reviewComplete: 'Toutes les situations sont complétées. Vous pouvez valider.',
    goTo: 'Touchez un numéro pour revenir à la situation correspondante.',
    validate: 'Valider mes réponses',
    validateBlocked: 'Complétez toutes les situations pour valider.',
    confirmTitle: 'Valider définitivement ?',
    confirmText: 'Après validation, vous ne pourrez plus modifier ni repasser le test.',
    confirmYes: 'Oui, valider définitivement',
    confirmNo: 'Revenir à mes réponses',
    validating: 'Enregistrement...',
    errorSubmit: 'La validation a échoué. Vos réponses sont conservées, vous pouvez réessayer.',
    errorDone: 'Vos réponses ont déjà été enregistrées.',
    missingAria: (n) => `Situation ${n}, à compléter`,
  },
}

const TU: ClientTexts = {
  consent: {
    title: 'Avant de commencer',
    intro: 'Ton accès a été créé par A4P Mental. Prends un moment pour lire ce qui suit, puis valide pour accéder à ton test.',
    infoTitle: 'Traitement de tes données',
    bullets: [
      'Responsable du traitement : A4P Mental, Alexandre Griffet.',
      'Données traitées : ton identité (nom et e-mail), la catégorie de ton test et tes réponses.',
      'Finalité : établir ton Bilan de Construction Mentale dans le cadre de ton accompagnement.',
      `Durée de conservation : ${RETENTION}.`,
      'Ton rapport complet t\'est communiqué par ton coach, en dehors de cette plateforme. Il ne s\'affiche jamais ici.',
      'Le test ne peut être passé qu\'une seule fois. Tes réponses sont enregistrées au fur et à mesure : tu peux t\'arrêter et reprendre plus tard.',
    ],
    label: 'J\'ai lu ces informations et j\'accepte que mes données soient traitées dans ce cadre.',
    minorTitle: 'Test d\'un mineur éventuel',
    minorText: 'Ce test peut concerner un mineur. L\'accord du représentant légal a été recueilli par A4P Mental avant l\'ouverture de ton accès.',
    guardianLabel: 'Accord du représentant légal recueilli (information enregistrée par A4P Mental, tu n\'as rien à cocher).',
    link: 'Lire la politique de confidentialité',
    cta: 'Accéder à mon test',
    error: 'L\'enregistrement a échoué. Réessaie dans un instant.',
  },
  guardianBlocked: {
    title: 'Ton test n\'est pas encore disponible',
    text: 'Contacte A4P Mental pour l\'activer.',
  },
  inactive: {
    title: 'Accès indisponible',
    text: 'Cet accès n\'est pas disponible pour le moment. Contacte A4P Mental.',
  },
  thanks: {
    title: 'Merci, tes réponses ont été enregistrées.',
    text: 'Ton coach te communiquera ton rapport.',
    sign: 'A4P Mental, Alexandre Griffet',
  },
  test: {
    kicker: 'Construction mentale',
    intro: 'Pour chaque situation, classe les réponses qui te ressemblent (au moins trois).',
    start: 'Commencer',
    back: '← Retour',
    next: 'Situation suivante →',
    skip: 'Passer pour l\'instant',
    reset: 'Recommencer cette situation',
    overview: 'Récapitulatif',
    finish: 'Terminer →',
    situationOf: (n, t) => `${n} / ${t}`,
    instruction: [
      'Touche la réponse qui te correspond le mieux : ton 1er choix.',
      'Touche maintenant ton 2e choix.',
      'Touche enfin ton 3e choix.',
      'Ajoute d\'autres réponses si elles te ressemblent, ou passe à la suite.',
      'Les six réponses sont classées. Touche une réponse pour la retirer et modifier.',
    ],
    hint: 'Classe de la plus proche de toi à la moins proche, au moins trois réponses. Ne touche pas celles qui ne te ressemblent pas.',
    rankLabels: ['1er', '2e', '3e', '4e', '5e', '6e'],
    saved: 'Brouillon enregistré',
    saving: 'Enregistrement...',
    saveError: 'Enregistrement impossible, nouvel essai à la prochaine réponse',
    resumeNotice: 'Tes réponses précédentes ont été retrouvées. Tu reprends là où tu t\'étais arrêté.',
    progress: 'Progression',
    reviewTitle: 'Récapitulatif de tes réponses',
    reviewMissing: (n) => (n === 1 ? 'Il reste 1 situation à compléter.' : `Il reste ${n} situations à compléter.`),
    reviewComplete: 'Toutes les situations sont complétées. Tu peux valider.',
    goTo: 'Touche un numéro pour revenir à la situation correspondante.',
    validate: 'Valider mes réponses',
    validateBlocked: 'Complète toutes les situations pour valider.',
    confirmTitle: 'Valider définitivement ?',
    confirmText: 'Après validation, tu ne pourras plus modifier ni repasser le test.',
    confirmYes: 'Oui, valider définitivement',
    confirmNo: 'Revenir à mes réponses',
    validating: 'Enregistrement...',
    errorSubmit: 'La validation a échoué. Tes réponses sont gardées, tu peux réessayer.',
    errorDone: 'Tes réponses ont déjà été enregistrées.',
    missingAria: (n) => `Situation ${n}, à compléter`,
  },
}

export function clientTexts(tu: boolean): ClientTexts {
  return tu ? TU : VOUS
}
