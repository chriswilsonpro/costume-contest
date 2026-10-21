import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Contest: a
    .model({
      name: a.string().required(),
      isOpen: a.boolean().required().default(true),
      categories: a.hasMany('Category', 'contestId'),
      contestants: a.hasMany('Contestant', 'contestId'),
      ballots: a.hasMany('Ballot', 'contestId'),
      votes: a.hasMany('Vote', 'contestId'),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  Category: a
    .model({
      contestId: a.id().required(),
      contest: a.belongsTo('Contest', 'contestId'),
      name: a.string().required(),
      sortOrder: a.integer().required(),
      votes: a.hasMany('Vote', 'categoryId'),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  Contestant: a
    .model({
      contestId: a.id().required(),
      contest: a.belongsTo('Contest', 'contestId'),
      name: a.string().required(),
      sortOrder: a.integer().required(),
      votes: a.hasMany('Vote', 'contestantId'),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  Ballot: a
    .model({
      contestId: a.id().required(),
      contest: a.belongsTo('Contest', 'contestId'),
      submittedAt: a.datetime(),
      votes: a.hasMany('Vote', 'ballotId'),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  Vote: a
    .model({
      ballotId: a.id().required(),
      ballot: a.belongsTo('Ballot', 'ballotId'),
      contestId: a.id().required(),
      contest: a.belongsTo('Contest', 'contestId'),
      categoryId: a.id().required(),
      category: a.belongsTo('Category', 'categoryId'),
      contestantId: a.id().required(),
      contestant: a.belongsTo('Contestant', 'contestantId'),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
