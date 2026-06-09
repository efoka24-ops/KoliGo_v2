import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveryService, DeliveryStatus } from '../services/delivery';

export function useDeliveries(status?: DeliveryStatus) {
  return useQuery({
    queryKey: ['deliveries', status],
    queryFn: () => deliveryService.list({ status }),
    refetchInterval: 10000,
  });
}

export function useDelivery(id: string) {
  return useQuery({
    queryKey: ['delivery', id],
    queryFn: () => deliveryService.getById(id),
    refetchInterval: 5000,
  });
}

export function useDeliveryLocation(id: string, enabled = true) {
  return useQuery({
    queryKey: ['delivery-location', id],
    queryFn: () => deliveryService.getLocation(id),
    refetchInterval: 10000,
    enabled,
  });
}

export function useCreateDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deliveryService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deliveries'] }),
  });
}

export function useConfirmCollect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) =>
      deliveryService.confirmCollect(id, code),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ['delivery', id] }),
  });
}

export function useConfirmDeliver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, code, momoRef }: { id: string; code: string; momoRef?: string }) =>
      deliveryService.confirmDeliver(id, code, momoRef),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ['delivery', id] }),
  });
}
