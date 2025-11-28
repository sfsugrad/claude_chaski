import React from 'react'
import { render, screen } from '@testing-library/react'
import Home from '../page'

describe('Home Page', () => {
  describe('Rendering', () => {
    it('renders the main heading with Senders and Couriers', () => {
      render(<Home />)
      expect(screen.getByText(/connect/i)).toBeInTheDocument()
      // "Senders" and "Couriers" appear multiple times, so check the h1 specifically
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toHaveTextContent(/senders/i)
      expect(heading).toHaveTextContent(/couriers/i)
    })

    it('renders the tagline', () => {
      render(<Home />)
      expect(screen.getByText(/smart logistics platform/i)).toBeInTheDocument()
    })

    it('renders sender card', () => {
      render(<Home />)
      expect(screen.getByText("I'm a Sender")).toBeInTheDocument()
    })

    it('renders courier card', () => {
      render(<Home />)
      expect(screen.getByText("I'm a Courier")).toBeInTheDocument()
    })
  })

  describe('Sender Card', () => {
    it('has sender description', () => {
      render(<Home />)
      expect(screen.getByText(/need to send a package/i)).toBeInTheDocument()
    })

    it('has send package link', () => {
      render(<Home />)
      const sendLink = screen.getByRole('link', { name: /send a package/i })
      expect(sendLink).toBeInTheDocument()
      expect(sendLink).toHaveAttribute('href', '/sender')
    })

    it('displays package icon', () => {
      render(<Home />)
      // Check for SVG with package/box path
      const svgs = document.querySelectorAll('svg')
      expect(svgs.length).toBeGreaterThan(0)
    })
  })

  describe('Courier Card', () => {
    it('has courier description', () => {
      render(<Home />)
      expect(screen.getByText(/earn money by delivering/i)).toBeInTheDocument()
    })

    it('has find packages link', () => {
      render(<Home />)
      const courierLink = screen.getByRole('link', { name: /find packages/i })
      expect(courierLink).toBeInTheDocument()
      expect(courierLink).toHaveAttribute('href', '/courier')
    })
  })

  describe('Navigation Links', () => {
    it('has login link', () => {
      render(<Home />)
      const loginLinks = screen.getAllByRole('link', { name: /sign in/i })
      expect(loginLinks.length).toBeGreaterThan(0)
      expect(loginLinks[0]).toHaveAttribute('href', '/login')
    })

    it('has register link', () => {
      render(<Home />)
      const registerLinks = screen.getAllByRole('link', { name: /register|get started/i })
      expect(registerLinks.length).toBeGreaterThan(0)
      expect(registerLinks[0]).toHaveAttribute('href', '/register')
    })
  })

  describe('Styling', () => {
    it('has surface background', () => {
      render(<Home />)
      const main = screen.getByRole('main')
      expect(main).toHaveClass('bg-surface-50')
    })

    it('has minimum screen height', () => {
      render(<Home />)
      const main = screen.getByRole('main')
      expect(main).toHaveClass('min-h-screen')
    })
  })

  describe('Layout', () => {
    it('renders two main action cards', () => {
      render(<Home />)
      // Should have sender and courier cards
      expect(screen.getByText("I'm a Sender")).toBeInTheDocument()
      expect(screen.getByText("I'm a Courier")).toBeInTheDocument()
    })

    it('has features section', () => {
      render(<Home />)
      expect(screen.getByText(/why choose chaski/i)).toBeInTheDocument()
    })

    it('has CTA section', () => {
      render(<Home />)
      expect(screen.getByText(/ready to get started/i)).toBeInTheDocument()
    })
  })
})
