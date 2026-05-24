import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: './lib/graphql/schema.graphql',
  documents: ['lib/graphql/operations/**/*.graphql'],
  generates: {
    './lib/graphql/generated/': {
      preset: 'client',
    },
  },
}

export default config
