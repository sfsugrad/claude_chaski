import React from 'react'
import { render, screen } from '@testing-library/react'
import Home from '../page'

describe('Home Page', () => {
  describe('Rendering', () => {
    it('renders the welcome heading', () => {
      render(<Home />)
      expect(screen.getByText('Welcome to Chaski')).toBeInTheDocument()
    })

    it('renders the tagline', () => {
      render(<Home />)
      expect(screen.getByText(/smart courier matching platform/i)).toBeInTheDocument()
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
      const sendLink = screen.getByRole('link', { name: /send package/i })
      expect(sendLink).toBeInTheDocument()
      expect(sendLink).toHaveAttribute('href', '/sender')
    })

    it('displays package emoji', () => {
      render(<Home />)
      expect(screen.getByText('📦')).toBeInTheDocument()
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

    it('displays car emoji', () => {
      render(<Home />)
      expect(screen.getByText('🚗')).toBeInTheDocument()
    })
  })

  describe('Navigation Links', () => {
    it('has login link', () => {
      render(<Home />)
      const loginLink = screen.getByRole('link', { name: /login/i })
      expect(loginLink).toBeInTheDocument()
      expect(loginLink).toHaveAttribute('href', '/login')
    })

    it('has register link', () => {
      render(<Home />)
      const registerLink = screen.getByRole('link', { name: /register/i })
      expect(registerLink).toBeInTheDocument()
      expect(registerLink).toHaveAttribute('href', '/register')
    })
  })

  describe('Styling', () => {
    it('has gradient background', () => {
      render(<Home />)
      const main = screen.getByRole('main')
      expect(main).toHaveClass('bg-gradient-to-b')
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

    it('centers content', () => {
      render(<Home />)
      const heading = screen.getByText('Welcome to Chaski')
      expect(heading.closest('.text-center')).toBeInTheDocument()
    })
  })
})
