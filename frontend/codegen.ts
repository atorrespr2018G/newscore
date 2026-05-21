import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: process.env.GRAPHQL_SCHEMA_URL ?? 'http://localhost:4000/graphql',
  documents: ['lib/graphql/**/*.graphql'],
  generates: {
    './lib/graphql/generated/': {
      preset: 'client',
    },
  },
}

export default config
