import React from 'react';
import { ClientProfile } from '../types';
import { ProviderOnboarding } from './ProviderOnboarding';

export function MetaOnboarding({
  client,
  compact,
}: {
  client?: ClientProfile | null;
  compact?: boolean;
}) {
  return <ProviderOnboarding family="meta" client={client} compact={compact} />;
}
