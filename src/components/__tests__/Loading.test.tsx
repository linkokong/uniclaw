/**
 * Loading.test.tsx
 * Tests for Loading component — skeleton rendering, size variants, fullscreen mode.
 * Framework: Vitest + React Testing Library
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { Loading } from '../Loading'

// ─── Size variants ─────────────────────────────────────────────────────────

describe('Loading — skeleton rendering', () => {
  it('renders the loading spinner element', () => {
    const { container } = render(<Loading />)
    const spinner = container.querySelector('[class*="animate-spin"]')
    expect(spinner).toBeInTheDocument()
  })

  it('renders the outer flex container', () => {
    const { container } = render(<Loading />)
    // Flex centering wrapper
    const wrapper = container.querySelector('[class*="flex"]')
    expect(wrapper).toBeInTheDocument()
  })

  it('renders a rounded-full element', () => {
    const { container } = render(<Loading />)
    const circle = container.querySelector('[class*="rounded-full"]')
    expect(circle).toBeInTheDocument()
  })
})

// ─── Size variants ─────────────────────────────────────────────────────────

describe('Loading — size variants', () => {
  it('renders size "sm" (h-4 w-4)', () => {
    const { container } = render(<Loading size="sm" />)
    const spinner = container.querySelector('[class*="h-4"]')
    expect(spinner).toBeInTheDocument()
  })

  it('renders size "md" (h-8 w-8) — default', () => {
    const { container } = render(<Loading size="md" />)
    const spinner = container.querySelector('[class*="h-8"]')
    expect(spinner).toBeInTheDocument()
  })

  it('renders size "lg" (h-12 w-12)', () => {
    const { container } = render(<Loading size="lg" />)
    const spinner = container.querySelector('[class*="h-12"]')
    expect(spinner).toBeInTheDocument()
  })

  it('defaults to h-8 w-8 when no size prop given', () => {
    const { container } = render(<Loading />)
    const spinner = container.querySelector('[class*="h-8"]')
    expect(spinner).toBeInTheDocument()
  })
})

// ─── Fullscreen mode ───────────────────────────────────────────────────────

describe('Loading — fullscreen mode', () => {
  it('adds min-h-screen class when fullscreen=true', () => {
    const { container } = render(<Loading fullscreen />)
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toMatch(/min-h-screen/)
  })

  it('does NOT add min-h-screen when fullscreen=false', () => {
    const { container } = render(<Loading fullscreen={false} />)
    const wrapper = container.firstElementChild
    expect(wrapper?.className).not.toMatch(/min-h-screen/)
  })

  it('does NOT add min-h-screen when fullscreen prop is omitted', () => {
    const { container } = render(<Loading />)
    const wrapper = container.firstElementChild
    expect(wrapper?.className).not.toMatch(/min-h-screen/)
  })

  it('renders spinner inside fullscreen container', () => {
    const { container } = render(<Loading fullscreen />)
    const spinner = container.querySelector('[class*="animate-spin"]')
    expect(spinner).toBeInTheDocument()
  })
})

// ─── Exhaustive prop combinations ─────────────────────────────────────────

describe('Loading — prop combinations', () => {
  it('combines sm + fullscreen correctly', () => {
    const { container } = render(<Loading size="sm" fullscreen />)
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toMatch(/min-h-screen/)
    expect(container.querySelector('[class*="h-4"]')).toBeInTheDocument()
  })

  it('combines lg + fullscreen correctly', () => {
    const { container } = render(<Loading size="lg" fullscreen />)
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toMatch(/min-h-screen/)
    expect(container.querySelector('[class*="h-12"]')).toBeInTheDocument()
  })
})