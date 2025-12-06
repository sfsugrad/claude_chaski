import React from 'react'
import { render, screen } from '@testing-library/react'
import GoogleSignInButton from '../GoogleSignInButton'

// Override the global next-intl mock to return readable text for tests
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      continueWithGoogle: 'Continue with Google',
    }
    return translations[key] || key
  },
  useLocale: () => 'en',
}))

describe('GoogleSignInButton', () => {
  describe('Rendering', () => {
    it('renders button with Google text', () => {
      render(<GoogleSignInButton />)
      expect(screen.getByText(/continue with google/i)).toBeInTheDocument()
    })

    it('renders as a button element', () => {
      render(<GoogleSignInButton />)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('has type="button" to prevent form submission', () => {
      render(<GoogleSignInButton />)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('type', 'button')
    })

    it('renders Google SVG icon', () => {
      render(<GoogleSignInButton />)
      const svg = document.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  describe('Styling', () => {
    it('has full width class', () => {
      render(<GoogleSignInButton />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('w-full')
    })

    it('has border styling', () => {
      render(<GoogleSignInButton />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('border')
      expect(button).toHaveClass('border-gray-300')
    })

    it('has hover state', () => {
      render(<GoogleSignInButton />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('hover:bg-gray-50')
    })

    it('has rounded corners', () => {
      render(<GoogleSignInButton />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('rounded-md')
    })
  })

  describe('Google Icon', () => {
    it('renders all four colored paths of Google logo', () => {
      render(<GoogleSignInButton />)
      const paths = document.querySelectorAll('path')

      // Google logo has 4 colored paths
      expect(paths.length).toBe(4)
    })

    it('has correct Google blue color', () => {
      render(<GoogleSignInButton />)
      const bluePath = document.querySelector('path[fill="#4285F4"]')
      expect(bluePath).toBeInTheDocument()
    })

    it('has correct Google green color', () => {
      render(<GoogleSignInButton />)
      const greenPath = document.querySelector('path[fill="#34A853"]')
      expect(greenPath).toBeInTheDocument()
    })

    it('has correct Google yellow color', () => {
      render(<GoogleSignInButton />)
      const yellowPath = document.querySelector('path[fill="#FBBC05"]')
      expect(yellowPath).toBeInTheDocument()
    })

    it('has correct Google red color', () => {
      render(<GoogleSignInButton />)
      const redPath = document.querySelector('path[fill="#EA4335"]')
      expect(redPath).toBeInTheDocument()
    })

    it('icon has correct size', () => {
      render(<GoogleSignInButton />)
      const svg = document.querySelector('svg')
      expect(svg).toHaveClass('w-5')
      expect(svg).toHaveClass('h-5')
    })
  })

  describe('Accessibility', () => {
    it('is focusable', () => {
      render(<GoogleSignInButton />)
      const button = screen.getByRole('button')

      button.focus()

      expect(document.activeElement).toBe(button)
    })

    it('has focus ring styles', () => {
      render(<GoogleSignInButton />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('focus:outline-none')
      expect(button).toHaveClass('focus:ring-2')
    })

    it('button text is visible and readable', () => {
      render(<GoogleSignInButton />)
      const text = screen.getByText(/continue with google/i)
      expect(text).toBeVisible()
    })
  })

  describe('Layout', () => {
    it('uses flexbox for alignment', () => {
      render(<GoogleSignInButton />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('flex')
      expect(button).toHaveClass('items-center')
      expect(button).toHaveClass('justify-center')
    })

    it('has gap between icon and text', () => {
      render(<GoogleSignInButton />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('gap-3')
    })
  })
})
