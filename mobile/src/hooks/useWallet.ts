import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletService } from '../services/wallet';

export function useWallet() {
  return useQuery({ queryKey: ['wallet'], queryFn: walletService.getBalance });
}

export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: () => walletService.getTransactions(),
  });
}

export function useWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ amount, provider, phone }: { amount: number; provider: 'MTN' | 'ORANGE'; phone: string }) =>
      walletService.withdraw(amount, provider, phone),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallet'] }),
  });
}
