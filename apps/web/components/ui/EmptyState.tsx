'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Button } from './Button';

export type EmptyStateVariant = 'default' | 'packages' | 'routes' | 'messages' | 'notifications' | 'search' | 'error';

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const defaultIcons: Record<EmptyStateVariant, React.ReactNode> = {
  default: (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
  packages: (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  routes: (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
  messages: (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  notifications: (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  search: (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  error: (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

export function EmptyState({
  variant = 'default',
  title,
  description,
  icon,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const displayIcon = icon || defaultIcons[variant];

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center py-12 px-6',
        className
      )}
    >
      <div className="w-20 h-20 rounded-full bg-surface-100 flex items-center justify-center text-surface-400 mb-4">
        {displayIcon}
      </div>
      <h3 className="text-lg font-semibold text-surface-900 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-surface-500 max-w-sm mb-6">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            <Button onClick={action.onClick} variant="primary">
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant="outline">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Preset empty states for common scenarios
export function EmptyPackages({ onCreatePackage }: { onCreatePackage?: () => void }) {
  return (
    <EmptyState
      variant="packages"
      title="No packages yet"
      description="You haven't created any packages. Start by creating your first package to get it delivered."
      action={onCreatePackage ? { label: 'Create Package', onClick: onCreatePackage } : undefined}
    />
  );
}

export function EmptyRoutes({ onCreateRoute }: { onCreateRoute?: () => void }) {
  return (
    <EmptyState
      variant="routes"
      title="No routes found"
      description="You don't have any delivery routes yet. Create a route to start accepting package deliveries."
      action={onCreateRoute ? { label: 'Create Route', onClick: onCreateRoute } : undefined}
    />
  );
}

export function EmptyMessages() {
  return (
    <EmptyState
      variant="messages"
      title="No messages"
      description="You don't have any conversations yet. Messages will appear here when you start chatting about packages."
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      variant="notifications"
      title="All caught up!"
      description="You don't have any notifications right now. We'll let you know when something happens."
    />
  );
}

export function EmptySearchResults({ query, onClear }: { query: string; onClear?: () => void }) {
  return (
    <EmptyState
      variant="search"
      title="No results found"
      description={`We couldn't find anything matching "${query}". Try adjusting your search or filters.`}
      action={onClear ? { label: 'Clear search', onClick: onClear } : undefined}
    />
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      variant="error"
      title="Something went wrong"
      description="We encountered an error while loading this page. Please try again."
      action={onRetry ? { label: 'Try again', onClick: onRetry } : undefined}
    />
  );
}

// Attach presets to component
EmptyState.Packages = EmptyPackages;
EmptyState.Routes = EmptyRoutes;
EmptyState.Messages = EmptyMessages;
EmptyState.Notifications = EmptyNotifications;
EmptyState.SearchResults = EmptySearchResults;
EmptyState.Error = ErrorState;

export default EmptyState;
