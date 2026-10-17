import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import LineupView from '../LineupView.vue'

describe('LineupView', () => {
  it('renders the screen heading', () => {
    const wrapper = mount(LineupView)
    expect(wrapper.text()).toContain('Расстановка')
  })
})
