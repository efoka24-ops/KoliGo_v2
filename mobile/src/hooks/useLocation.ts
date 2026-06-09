import { useEffect } from 'react';
import { geoService } from '../services/geo';

export function useGpsStream(deliveryId: string | null, active: boolean) {
  useEffect(() => {
    if (!deliveryId || !active) return;
    geoService.startStreaming(deliveryId);
    return () => geoService.stopStreaming();
  }, [deliveryId, active]);
}
