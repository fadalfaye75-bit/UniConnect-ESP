// Bibliothèque d'avatars UniConnect
// Utilise l'API DiceBear Avataaars avec des paramètres spécifiques pour différencier les rôles

const BASE_URL = "https://api.dicebear.com/7.x/avataaars/svg";

// Styles spécifiques par rôle
const STYLES = {
  student: {
    clothing: ['hoodie', 'graphicShirt', 'overall', 'shirtCrewNeck'],
    accessories: ['eyepatch', 'round', 'none', 'none', 'none'], // Mostly none or fun
    top: ['shaggy', 'shortCurly', 'shortFlat', 'shortRound', 'shortWaved', 'sides', 'fro', 'buns', 'longButNotTooLong']
  },
  delegate: {
    clothing: ['shirtCrewNeck', 'shirtScoopNeck', 'collarAndSweater'],
    accessories: ['round', 'prescription02', 'none', 'none'], // Intellectual look
    top: ['shortFlat', 'shortWaved', 'longButNotTooLong', 'bob', 'curly']
  },
  admin: {
    clothing: ['blazerAndShirt', 'collarAndSweater', 'shirtVNeck'],
    accessories: ['prescription01', 'prescription02', 'wayfarers', 'none'], // Professional glasses
    top: ['shortFlat', 'shortWaved', 'minnie', 'hat', 'hijab']
  }
};

const generateUrl = (seed: string, roleStyle: keyof typeof STYLES) => {
  const style = STYLES[roleStyle];
  // On construit une URL avec des paramètres fixes pour garantir la cohérence du style
  // Note: DiceBear sélectionne aléatoirement PARMI les options fournies séparées par des virgules
  const params = new URLSearchParams({
    seed: seed,
    clothing: style.clothing.join(','),
    accessories: style.accessories.join(','),
    top: style.top.join(','),
    // Background neutre et pro
    backgroundColor: 'b6e3f4,c0aede,d1d4f9', 
  });
  return `${BASE_URL}?${params.toString()}`;
};

export const AVATAR_LIBRARY = {
  students: Array.from({ length: 12 }).map((_, i) => ({
    id: `student_${i}`,
    url: generateUrl(`student_univ_${i}`, 'student'),
    label: `Étudiant ${i + 1}`
  })),
  delegates: Array.from({ length: 6 }).map((_, i) => ({
    id: `delegate_${i}`,
    url: generateUrl(`delegate_univ_${i}`, 'delegate'),
    label: `Délégué ${i + 1}`
  })),
  admins: Array.from({ length: 6 }).map((_, i) => ({
    id: `admin_${i}`,
    url: generateUrl(`admin_univ_${i}`, 'admin'),
    label: `Admin ${i + 1}`
  }))
};