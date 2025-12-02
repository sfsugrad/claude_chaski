/**
 * Tests for utility functions
 */

import { cn } from '../utils';

describe('cn (class name utility)', () => {
  describe('basic functionality', () => {
    it('should return empty string when no arguments', () => {
      expect(cn()).toBe('');
    });

    it('should handle single string class', () => {
      expect(cn('foo')).toBe('foo');
    });

    it('should combine multiple string classes', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should combine many classes', () => {
      expect(cn('foo', 'bar', 'baz', 'qux')).toBe('foo bar baz qux');
    });
  });

  describe('conditional classes', () => {
    it('should handle true condition', () => {
      expect(cn('foo', true && 'bar')).toBe('foo bar');
    });

    it('should filter out false condition', () => {
      expect(cn('foo', false && 'bar')).toBe('foo');
    });

    it('should filter out null', () => {
      expect(cn('foo', null)).toBe('foo');
    });

    it('should filter out undefined', () => {
      expect(cn('foo', undefined)).toBe('foo');
    });

    it('should filter out empty strings', () => {
      expect(cn('foo', '', 'bar')).toBe('foo bar');
    });

    it('should filter out 0', () => {
      expect(cn('foo', 0, 'bar')).toBe('foo bar');
    });
  });

  describe('object syntax', () => {
    it('should include classes with truthy values', () => {
      expect(cn({ foo: true, bar: true })).toBe('foo bar');
    });

    it('should exclude classes with falsy values', () => {
      expect(cn({ foo: true, bar: false })).toBe('foo');
    });

    it('should handle mixed truthy/falsy', () => {
      expect(cn({ a: true, b: false, c: true })).toBe('a c');
    });

    it('should handle object with string values', () => {
      expect(cn({ foo: 'bar' })).toBe('foo');
    });

    it('should exclude object keys with null values', () => {
      expect(cn({ foo: null, bar: true })).toBe('bar');
    });

    it('should exclude object keys with undefined values', () => {
      expect(cn({ foo: undefined, bar: true })).toBe('bar');
    });

    it('should exclude object keys with 0', () => {
      expect(cn({ foo: 0, bar: true })).toBe('bar');
    });

    it('should exclude object keys with empty string', () => {
      expect(cn({ foo: '', bar: true })).toBe('bar');
    });
  });

  describe('array syntax', () => {
    it('should handle array of strings', () => {
      expect(cn(['foo', 'bar'])).toBe('foo bar');
    });

    it('should handle nested arrays', () => {
      expect(cn(['foo', ['bar', 'baz']])).toBe('foo bar baz');
    });

    it('should filter falsy values in arrays', () => {
      expect(cn(['foo', false, 'bar', null, undefined])).toBe('foo bar');
    });
  });

  describe('mixed syntax', () => {
    it('should handle string and object combined', () => {
      expect(cn('foo', { bar: true })).toBe('foo bar');
    });

    it('should handle string, object, and array combined', () => {
      expect(cn('foo', { bar: true }, ['baz'])).toBe('foo bar baz');
    });

    it('should handle complex conditional logic', () => {
      const isActive = true;
      const isDisabled = false;
      const hasError = true;

      expect(
        cn(
          'base',
          isActive && 'active',
          isDisabled && 'disabled',
          { error: hasError }
        )
      ).toBe('base active error');
    });
  });

  describe('real-world use cases', () => {
    it('should handle button classes', () => {
      const variant = 'primary';
      const size = 'large';
      const isDisabled = false;

      expect(
        cn(
          'btn',
          `btn-${variant}`,
          `btn-${size}`,
          isDisabled && 'btn-disabled'
        )
      ).toBe('btn btn-primary btn-large');
    });

    it('should handle conditional styling', () => {
      const isOpen = true;
      const isAnimated = true;

      expect(
        cn(
          'dropdown',
          { open: isOpen, animated: isAnimated }
        )
      ).toBe('dropdown open animated');
    });

    it('should handle Tailwind-like classes', () => {
      expect(
        cn(
          'px-4 py-2',
          'bg-blue-500',
          'hover:bg-blue-600',
          'text-white'
        )
      ).toBe('px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white');
    });

    it('should handle responsive classes', () => {
      const isMobile = false;
      expect(
        cn(
          'flex',
          isMobile ? 'flex-col' : 'flex-row',
          'gap-4'
        )
      ).toBe('flex flex-row gap-4');
    });
  });

  describe('edge cases', () => {
    it('should handle only falsy values', () => {
      expect(cn(null, undefined, false, '', 0)).toBe('');
    });

    it('should handle whitespace in class names', () => {
      expect(cn('foo bar', 'baz')).toBe('foo bar baz');
    });

    it('should handle deeply nested arrays', () => {
      expect(cn([['foo'], [['bar']]])).toBe('foo bar');
    });

    it('should handle mixed nested structures', () => {
      expect(cn('a', ['b', { c: true }], { d: true })).toBe('a b c d');
    });
  });
});
