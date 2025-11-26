import React from 'react'
import { render, screen } from '@testing-library/react'
import SenderPage from '../page'

describe('SenderPage', () => {
  describe('Page Rendering', () => {
    it('renders the sender landing page', () => {
      render(<SenderPage />)

      expect(screen.getByText('Send Packages with Chaski')).toBeInTheDocument()
      expect(
        screen.getByText('Connect with trusted couriers traveling along your route')
      ).toBeInTheDocument()
    })

    it('renders the package icon', () => {
      const { container } = render(<SenderPage />)

      const icon = container.querySelector('.text-6xl')
      expect(icon).toBeInTheDocument()
      expect(icon?.textContent).toBe('📦')
    })
  })

  describe('Features Section', () => {
    it('renders all three feature cards', () => {
      render(<SenderPage />)

      expect(screen.getByText('Affordable Rates')).toBeInTheDocument()
      expect(screen.getByText('Fast Delivery')).toBeInTheDocument()
      expect(screen.getByText('Secure & Tracked')).toBeInTheDocument()
    })

    it('displays feature descriptions', () => {
      render(<SenderPage />)

      expect(
        screen.getByText('Save money compared to traditional courier services')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Get matched with couriers already traveling your route')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Real-time tracking and verified courier profiles')
      ).toBeInTheDocument()
    })

    it('renders feature icons', () => {
      const { container } = render(<SenderPage />)

      const icons = container.querySelectorAll('.text-3xl')
      expect(icons.length).toBeGreaterThanOrEqual(3)
      expect(icons[0].textContent).toBe('💰')
      expect(icons[1].textContent).toBe('🚀')
      expect(icons[2].textContent).toBe('🔒')
    })
  })

  describe('How It Works Section', () => {
    it('renders the how it works heading', () => {
      render(<SenderPage />)

      expect(screen.getByText('How It Works')).toBeInTheDocument()
    })

    it('renders all four steps', () => {
      render(<SenderPage />)

      expect(screen.getByText('Create Your Package Request')).toBeInTheDocument()
      expect(screen.getByText('Get Matched with Couriers')).toBeInTheDocument()
      expect(screen.getByText('Review and Confirm')).toBeInTheDocument()
      expect(screen.getByText('Track & Receive')).toBeInTheDocument()
    })

    it('displays step descriptions', () => {
      render(<SenderPage />)

      expect(
        screen.getByText(
          'Describe your package, set pickup and dropoff locations, and offer a price'
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Our platform automatically finds couriers traveling along your route'
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText('Choose your courier, confirm details, and schedule pickup')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Monitor your package in real-time and confirm delivery')
      ).toBeInTheDocument()
    })

    it('renders step numbers', () => {
      const { container } = render(<SenderPage />)

      const stepNumbers = container.querySelectorAll(
        '.bg-blue-600.text-white.rounded-full'
      )
      expect(stepNumbers.length).toBe(4)
      expect(stepNumbers[0].textContent).toBe('1')
      expect(stepNumbers[1].textContent).toBe('2')
      expect(stepNumbers[2].textContent).toBe('3')
      expect(stepNumbers[3].textContent).toBe('4')
    })
  })

  describe('Call-to-Action Buttons', () => {
    it('renders the register button', () => {
      render(<SenderPage />)

      const registerButton = screen.getByText('Get Started - Create Account')
      expect(registerButton).toBeInTheDocument()
      expect(registerButton.closest('a')).toHaveAttribute('href', '/register')
    })

    it('renders the sign in link', () => {
      render(<SenderPage />)

      const signInLink = screen.getByText('Sign In')
      expect(signInLink).toBeInTheDocument()
      expect(signInLink.closest('a')).toHaveAttribute('href', '/login')
    })

    it('renders already have account text', () => {
      render(<SenderPage />)

      expect(screen.getByText('Already have an account?')).toBeInTheDocument()
    })

    it('renders back to home link', () => {
      render(<SenderPage />)

      const backLink = screen.getByText('← Back to Home')
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/')
    })
  })

  describe('Styling and Layout', () => {
    it('applies gradient background', () => {
      const { container } = render(<SenderPage />)

      const mainDiv = container.querySelector('.bg-gradient-to-b.from-blue-50')
      expect(mainDiv).toBeInTheDocument()
    })

    it('renders feature cards with shadow', () => {
      const { container } = render(<SenderPage />)

      const featureCards = container.querySelectorAll('.shadow-md')
      expect(featureCards.length).toBeGreaterThanOrEqual(3)
    })

    it('renders how it works section with shadow', () => {
      const { container } = render(<SenderPage />)

      const howItWorksSection = container.querySelector('.shadow-lg')
      expect(howItWorksSection).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('uses proper heading hierarchy', () => {
      const { container } = render(<SenderPage />)

      const h1 = container.querySelector('h1')
      const h2 = container.querySelector('h2')
      const h3 = container.querySelector('h3')

      expect(h1).toBeInTheDocument()
      expect(h2).toBeInTheDocument()
      expect(h3).toBeInTheDocument()
    })

    it('has descriptive link text', () => {
      render(<SenderPage />)

      const links = [
        screen.getByText('Get Started - Create Account'),
        screen.getByText('Sign In'),
        screen.getByText('← Back to Home'),
      ]

      links.forEach((link) => {
        expect(link).toBeInTheDocument()
        expect(link.textContent).toBeTruthy()
      })
    })
  })
})
