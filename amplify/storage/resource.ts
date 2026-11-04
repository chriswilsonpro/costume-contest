import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'costumeContestMedia',
  access: (allow) => ({
    'contestant-images/*': [
      allow.guest.to(['read', 'write', 'delete']),
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
    'backgrounds/*': [
      allow.guest.to(['read', 'write', 'delete']),
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
});
