import { defineAuth } from '@aws-amplify/backend';

/** Identity pool for guest Storage access (no sign-in UI required). */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
});
