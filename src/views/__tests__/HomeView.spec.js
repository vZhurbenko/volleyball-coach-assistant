import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import HomeView from '../HomeView.vue'

describe('HomeView', () => {
  it('renders the placeholder heading', () => {
    const wrapper = mount(HomeView)
    expect(wrapper.text()).toContain('Помощник тренера')
  })
})
