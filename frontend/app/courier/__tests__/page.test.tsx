import React from 'react'
import { render, screen } from '@testing-library/react'
import CourierPage from '../page'

describe('CourierPage', () => {
  describe('Page Rendering', () => {
    it('renders the courier landing page', () => {
      render(<CourierPage />)

      expect(screen.getByText('Earn Money as a Courier')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Turn your travels into income by delivering packages along your route'
        )
      ).toBeInTheDocument()
    })

    it('renders the car icon', () => {
      const { container } = render(<CourierPage />)

      const icon = container.querySelector('.text-6xl')
      expect(icon).toBeInTheDocument()
      expect(icon?.textContent).toBe('🚗')
    })
  })

  describe('Features Section', () => {
    it('renders all three feature cards', () => {
      render(<CourierPage />)

      expect(screen.getByText('Extra Income')).toBeInTheDocument()
      expect(screen.getByText('Flexible Schedule')).toBeInTheDocument()
      expect(screen.getByText('Easy to Start')).toBeInTheDocument()
    })

    it('displays feature descriptions', () => {
      render(<CourierPage />)

      expect(
        screen.getByText("Earn money on trips you're already making")
      ).toBeInTheDocument()
      expect(
        screen.getByText('Choose which packages to deliver based on your route')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Simple registration and instant matching with packages')
      ).toBeInTheDocument()
    })

    it('renders feature icons', () => {
      const { container } = render(<CourierPage />)

      const icons = container.querySelectorAll('.text-3xl')
      expect(icons.length).toBeGreaterThanOrEqual(3)
      expect(icons[0].textContent).toBe('💵')
      expect(icons[1].textContent).toBe('📅')
      expect(icons[2].textContent).toBe('✅')
    })
  })

  describe('How It Works Section', () => {
    it('renders the how it works heading', () => {
      render(<CourierPage />)

      expect(screen.getByText('How It Works')).toBeInTheDocument()
    })

    it('renders all four steps', () => {
      render(<CourierPage />)

      expect(screen.getByText('Create Your Profile')).toBeInTheDocument()
      expect(screen.getByText('Share Your Route')).toBeInTheDocument()
      expect(screen.getByText('Accept Deliveries')).toBeInTheDocument()
      expect(screen.getByText('Deliver & Get Paid')).toBeInTheDocument()
    })

    it('displays step descriptions', () => {
      render(<CourierPage />)

      expect(
        screen.getByText(
          'Sign up as a courier and set up your profile with vehicle details'
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Enter your travel plans and get matched with packages along your way'
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Review package details and accept deliveries that fit your schedule'
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Complete the delivery and receive payment directly to your account'
        )
      ).toBeInTheDocument()
    })

    it('renders step numbers', () => {
      const { container } = render(<CourierPage />)

      const stepNumbers = container.querySelectorAll(
        '.bg-green-600.text-white.rounded-full'
      )
      expect(stepNumbers.length).toBe(4)
      expect(stepNumbers[0].textContent).toBe('1')
      expect(stepNumbers[1].textContent).toBe('2')
      expect(stepNumbers[2].textContent).toBe('3')
      expect(stepNumbers[3].textContent).toBe('4')
    })
  })

  describe('Benefits Section', () => {
    it('renders the benefits heading', () => {
      render(<CourierPage />)

      expect(screen.getByText('Why Become a Chaski Courier?')).toBeInTheDocument()
    })

    it('renders all benefits', () => {
      render(<CourierPage />)

      expect(screen.getByText('No Extra Detours')).toBeInTheDocument()
      expect(screen.getByText('Be Your Own Boss')).toBeInTheDocument()
      expect(screen.getByText('Safe & Secure')).toBeInTheDocument()
      expect(screen.getByText('Quick Payments')).toBeInTheDocument()
    })

    it('displays benefit descriptions', () => {
      render(<CourierPage />)

      expect(
        screen.getByText('Only deliver packages that match your existing route')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Choose when and where you want to deliver')
      ).toBeInTheDocument()
      expect(
        screen.getByText('All packages are insured and senders are verified')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Get paid immediately after successful delivery')
      ).toBeInTheDocument()
    })

    it('renders benefits in a green background section', () => {
      const { container } = render(<CourierPage />)

      const benefitsSection = container.querySelector('.bg-green-50')
      expect(benefitsSection).toBeInTheDocument()
    })
  })

  describe('Call-to-Action Buttons', () => {
    it('renders the register button', () => {
      render(<CourierPage />)

      const registerButton = screen.getByText('Start Earning - Become a Courier')
      expect(registerButton).toBeInTheDocument()
      expect(registerButton.closest('a')).toHaveAttribute('href', '/register')
    })

    it('renders the sign in link', () => {
      render(<CourierPage />)

      const signInLink = screen.getByText('Sign In')
      expect(signInLink).toBeInTheDocument()
      expect(signInLink.closest('a')).toHaveAttribute('href', '/login')
    })

    it('renders already have account text', () => {
      render(<CourierPage />)

      expect(screen.getByText('Already have an account?')).toBeInTheDocument()
    })

    it('renders back to home link', () => {
      render(<CourierPage />)

      const backLink = screen.getByText('← Back to Home')
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/')
    })
  })

  describe('Styling and Layout', () => {
    it('applies gradient background', () => {
      const { container } = render(<CourierPage />)

      const mainDiv = container.querySelector('.bg-gradient-to-b.from-green-50')
      expect(mainDiv).toBeInTheDocument()
    })

    it('renders feature cards with shadow', () => {
      const { container } = render(<CourierPage />)

      const featureCards = container.querySelectorAll('.shadow-md')
      expect(featureCards.length).toBeGreaterThanOrEqual(3)
    })

    it('renders how it works section with shadow', () => {
      const { container } = render(<CourierPage />)

      const howItWorksSection = container.querySelector('.shadow-lg')
      expect(howItWorksSection).toBeInTheDocument()
    })

    it('uses green color scheme for branding', () => {
      const { container } = render(<CourierPage />)

      const greenButtons = container.querySelectorAll('.bg-green-600')
      expect(greenButtons.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Accessibility', () => {
    it('uses proper heading hierarchy', () => {
      const { container } = render(<CourierPage />)

      const h1 = container.querySelector('h1')
      const h2 = container.querySelector('h2')
      const h3 = container.querySelector('h3')

      expect(h1).toBeInTheDocument()
      expect(h2).toBeInTheDocument()
      expect(h3).toBeInTheDocument()
    })

    it('has descriptive link text', () => {
      render(<CourierPage />)

      const links = [
        screen.getByText('Start Earning - Become a Courier'),
        screen.getByText('Sign In'),
        screen.getByText('← Back to Home'),
      ]

      links.forEach((link) => {
        expect(link).toBeInTheDocument()
        expect(link.textContent).toBeTruthy()
      })
    })
  })

  describe('Content Differentiation', () => {
    it('uses different color scheme from sender page', () => {
      const { container } = render(<CourierPage />)

      // Courier page uses green, not blue
      expect(container.querySelector('.bg-green-600')).toBeInTheDocument()
      expect(container.querySelector('.from-green-50')).toBeInTheDocument()
    })

    it('displays courier-specific content', () => {
      render(<CourierPage />)

      // These are courier-specific terms (using getAllBy* because some appear multiple times)
      expect(screen.getAllByText(/earn money/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/courier/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/deliver/i).length).toBeGreaterThan(0)
    })
  })
})
