/**
 * Tests for LanguageSwitcher component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LanguageSwitcher from '../LanguageSwitcher';

// Mock next-intl
const mockUseLocale = jest.fn();
const mockUseTranslations = jest.fn();

jest.mock('next-intl', () => ({
  useLocale: () => mockUseLocale(),
  useTranslations: () => mockUseTranslations(),
}));

// Mock next/navigation
const mockRouterPush = jest.fn();
const mockUsePathname = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
  usePathname: () => mockUsePathname(),
}));

// Mock i18n/request
jest.mock('@/i18n/request', () => ({
  locales: ['en', 'fr', 'es'],
  localeNames: {
    en: 'English',
    fr: 'Français',
    es: 'Español',
  },
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocale.mockReturnValue('en');
    mockUseTranslations.mockReturnValue((key: string) => {
      const translations: Record<string, string> = {
        select: 'Select Language',
      };
      return translations[key] || key;
    });
    mockUsePathname.mockReturnValue('/en/dashboard');
  });

  describe('rendering', () => {
    it('should render select element', () => {
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('should display all locale options', () => {
      render(<LanguageSwitcher />);

      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('Français')).toBeInTheDocument();
      expect(screen.getByText('Español')).toBeInTheDocument();
    });

    it('should have current locale selected', () => {
      mockUseLocale.mockReturnValue('en');

      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('en');
    });

    it('should show French as selected when locale is fr', () => {
      mockUseLocale.mockReturnValue('fr');
      mockUsePathname.mockReturnValue('/fr/dashboard');

      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('fr');
    });

    it('should show Spanish as selected when locale is es', () => {
      mockUseLocale.mockReturnValue('es');
      mockUsePathname.mockReturnValue('/es/dashboard');

      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('es');
    });
  });

  describe('accessibility', () => {
    it('should have aria-label', () => {
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-label', 'Select Language');
    });
  });

  describe('locale change', () => {
    it('should navigate to French when selected', () => {
      mockUseLocale.mockReturnValue('en');
      mockUsePathname.mockReturnValue('/en/dashboard');

      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'fr' } });

      expect(mockRouterPush).toHaveBeenCalledWith('/fr/dashboard');
    });

    it('should navigate to Spanish when selected', () => {
      mockUseLocale.mockReturnValue('en');
      mockUsePathname.mockReturnValue('/en/dashboard');

      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'es' } });

      expect(mockRouterPush).toHaveBeenCalledWith('/es/dashboard');
    });

    it('should navigate to English when selected from French', () => {
      mockUseLocale.mockReturnValue('fr');
      mockUsePathname.mockReturnValue('/fr/packages');

      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'en' } });

      expect(mockRouterPush).toHaveBeenCalledWith('/en/packages');
    });

    it('should not navigate when selecting same locale', () => {
      mockUseLocale.mockReturnValue('en');
      mockUsePathname.mockReturnValue('/en/dashboard');

      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'en' } });

      expect(mockRouterPush).not.toHaveBeenCalled();
    });
  });

  describe('path handling', () => {
    it('should preserve path segments when changing locale', () => {
      mockUseLocale.mockReturnValue('en');
      mockUsePathname.mockReturnValue('/en/packages/123/edit');

      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'fr' } });

      expect(mockRouterPush).toHaveBeenCalledWith('/fr/packages/123/edit');
    });

    it('should handle root path', () => {
      mockUseLocale.mockReturnValue('en');
      mockUsePathname.mockReturnValue('/en');

      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'es' } });

      expect(mockRouterPush).toHaveBeenCalledWith('/es');
    });

    it('should handle complex nested paths', () => {
      mockUseLocale.mockReturnValue('en');
      mockUsePathname.mockReturnValue('/en/admin/users/456/packages');

      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'fr' } });

      expect(mockRouterPush).toHaveBeenCalledWith('/fr/admin/users/456/packages');
    });

    it('should handle path with query params preserved in pathname', () => {
      mockUseLocale.mockReturnValue('en');
      mockUsePathname.mockReturnValue('/en/search');

      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'es' } });

      expect(mockRouterPush).toHaveBeenCalledWith('/es/search');
    });
  });

  describe('styling', () => {
    it('should have dropdown icon', () => {
      render(<LanguageSwitcher />);

      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should have correct base classes', () => {
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('appearance-none');
      expect(select).toHaveClass('bg-white');
      expect(select).toHaveClass('border');
      expect(select).toHaveClass('rounded-md');
    });

    it('should have cursor-pointer class', () => {
      render(<LanguageSwitcher />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('cursor-pointer');
    });
  });

  describe('options', () => {
    it('should have three locale options', () => {
      render(<LanguageSwitcher />);

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
    });

    it('should have correct option values', () => {
      render(<LanguageSwitcher />);

      const options = screen.getAllByRole('option') as HTMLOptionElement[];
      expect(options[0].value).toBe('en');
      expect(options[1].value).toBe('fr');
      expect(options[2].value).toBe('es');
    });

    it('should display locale names in options', () => {
      render(<LanguageSwitcher />);

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveTextContent('English');
      expect(options[1]).toHaveTextContent('Français');
      expect(options[2]).toHaveTextContent('Español');
    });
  });
});
