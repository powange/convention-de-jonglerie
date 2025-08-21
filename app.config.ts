export default defineAppConfig({
  ui: {
    primary: 'blue',
    gray: 'neutral',
    card: {
      background: 'bg-white dark:bg-gray-900',
      border: 'border border-gray-200 dark:border-gray-800',
      body: {
        background: 'bg-white dark:bg-gray-900'
      }
    },
    button: {
      default: {
        color: 'neutral'
      }
    },
    modal: {
      background: 'bg-white dark:bg-gray-900',
      border: 'border border-gray-200 dark:border-gray-800'
    },
    dropdown: {
      background: 'bg-white dark:bg-gray-900',
      border: 'border border-gray-200 dark:border-gray-800'
    },
    input: {
      background: 'bg-white dark:bg-gray-900',
      border: 'border border-gray-200 dark:border-gray-700'
    },
    select: {
      background: 'bg-white dark:bg-gray-900',
      border: 'border border-gray-200 dark:border-gray-700'
    },
    textarea: {
      background: 'bg-white dark:bg-gray-900',
      border: 'border border-gray-200 dark:border-gray-700'
    }
  }
})