import { Redirect } from 'expo-router';

/** Any unknown address goes to Home (or sign-in, via the root layout's guards). */
export default function NotFound() {
  return <Redirect href="/" />;
}
