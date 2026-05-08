/**
 * Root redirector — sends first-launch users to /onboarding, everyone
 * else to /(main). Zero UI of its own.
 */
import { Redirect } from 'expo-router';
import { useCatStore } from '../src/state/catStore';

export default function IndexRedirect() {
  const hasOnboarded = useCatStore((s) => s.hasOnboarded);
  return <Redirect href={hasOnboarded ? '/(main)' : '/onboarding'} />;
}
