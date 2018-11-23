module.exports = {
  use: [
/*
    ['@neutrinojs/airbnb',
      {
        eslint: {
          'rules': {
            'import/extensions': 0,
            'react/prop-types': 'off',
            'no-underscore-dangle': 'off',
            'object-shorthand': 'off',
            'func-names': 'off',
            'no-param-reassign': 'off',
            'class-methods-use-this': 'warn',
            'no-console': 'warn',
            'no-plusplus': 'off',
            'no-unused-vars': 'warn',
            'prefer-destructuring': 'off',
            'prefer-template': 'warn',
            'react/prefer-stateless-function': 'warn',
            'react/jsx-closing-tag-location': 'warn',
            'max-len': ['warn', {'code': 120}]
          }
        }
      }
    ],
 */
    [
      '@neutrinojs/library',
      {
        name: 'freactal3'
      }
    ],
    ['@neutrinojs/jest', {
      testRegex: 'src/.*(_test|_spec|\\.test|\\.spec)\\.(js|jsx|vue|ts|tsx|mjs)$',
      'setupFiles': ['raf/polyfill']
    }],
  ]
};
