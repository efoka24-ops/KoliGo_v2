import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../services/api';

/**
 * Barrière d'accès, à appeler depuis les écrans d'accueil (Vendeur et Livreur).
 * À chaque affichage, relit le profil puis impose, dans l'ordre :
 *   1. l'acceptation de la dernière version des CGU,
 *   2. le KYC du rôle actif (obligatoire après la création du compte),
 *   3. le véhicule, pour un livreur.
 * Tant que le back-office n'a pas validé le KYC, l'utilisateur peut parcourir l'app mais le serveur
 * refuse de publier ou de livrer ; `kycBlocked` permet d'afficher un bandeau.
 */
export function useComplianceGate(navigation) {
  const { token, user, setUser } = useApp();

  useFocusEffect(useCallback(() => {
    if (!token || !user?.id || user.isTest) return undefined;
    let alive = true;
    (async () => {
      let u = user;
      try {
        const p = await apiFetch('/user/profile', {}, token);
        if (p?.id && alive) {
          u = { ...user, ...p };
          setUser((prev) => (prev ? { ...prev, ...p } : prev));
        }
      } catch { /* hors ligne : on garde ce que l'on sait */ }
      if (!alive) return;

      if (u.needsCgu) {
        navigation.navigate('Terms', { mode: 'accept' });
      } else if (['NONE', 'REJECTED'].includes(u.kycStatus)) {
        navigation.navigate('Kyc', { gate: true });
      } else if ((u.activeRole || '').toUpperCase() === 'DELIVERER' && !u.vehicleType) {
        navigation.navigate('Vehicle');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id, user?.activeRole]));

  return {
    kycBlocked: !!user && user.kycStatus !== 'VERIFIED',
    kycStatus: user?.kycStatus,
  };
}
