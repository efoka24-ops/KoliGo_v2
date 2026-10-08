// Message lisible et code d'une erreur API (axios) : le serveur répond { error, code }.
export const errMsg = (e, fallback = 'Une erreur est survenue') => e?.response?.data?.error || e?.message || fallback;
export const errCode = (e) => e?.response?.data?.code || null;
