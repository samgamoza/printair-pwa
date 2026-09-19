import { createContext, useContext } from 'react';

export type CreateValue = {
  startProject: (categoryId?: string | null) => void;
  startDesign: () => void;
  /** Bumps whenever a create flow closes; list pages reload when it changes. */
  version: number;
};

export const CreateContext = createContext<CreateValue | null>(null);

export function useCreate(): CreateValue {
  const ctx = useContext(CreateContext);
  if (!ctx) throw new Error('useCreate must be used inside CustomerLayout');
  return ctx;
}
