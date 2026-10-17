import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import App from '../App.vue'

async function mountApp() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div>Экран</div>' } }],
  })
  await router.push('/')
  await router.isReady()

  return mount(App, { global: { plugins: [router] } })
}

describe('App', () => {
  it('renders the screen without the app header', async () => {
    const wrapper = await mountApp()

    expect(wrapper.find('.app-bar').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Помощник тренера')
  })
})
