// UI Components barrel export
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Input } from './Input';
export type { InputProps } from './Input';

export { PasswordInput } from './PasswordInput';
export type { PasswordInputProps } from './PasswordInput';

export { Card, CardHeader, CardBody, CardFooter } from './Card';
export type { CardProps, CardHeaderProps, CardBodyProps, CardFooterProps } from './Card';

export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge';

export { Alert } from './Alert';
export type { AlertProps, AlertVariant } from './Alert';

export { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';
export type { ModalProps, ModalHeaderProps, ModalBodyProps, ModalFooterProps, ModalSize } from './Modal';

export { Select } from './Select';
export type { SelectProps, SelectOption } from './Select';

export { Skeleton, SkeletonText, SkeletonTitle, SkeletonAvatar, SkeletonCard, SkeletonButton, SkeletonTable } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps } from './Tabs';

export { Toast, ToastContainer } from './Toast';
export type { ToastProps, ToastType, ToastContainerProps } from './Toast';

export { ToastProvider, useToast } from './ToastContext';

export { ProgressBar, ProgressRing, ProgressSteps } from './Progress';
export type { ProgressBarProps, ProgressRingProps, ProgressStepsProps, ProgressVariant, ProgressSize } from './Progress';
export { default as Progress } from './Progress';

export { EmptyState, EmptyPackages, EmptyRoutes, EmptyMessages, EmptyNotifications, EmptySearchResults, ErrorState } from './EmptyState';
export type { EmptyStateProps, EmptyStateVariant } from './EmptyState';

export { StatsCard, StatsCardInline, StatsGrid } from './StatsCard';
export type { StatsCardProps, StatsCardInlineProps, StatsGridProps, StatsCardVariant, StatsCardTrend } from './StatsCard';

export { ConnectionStatus, ConnectionStatusBadge } from './ConnectionStatus';
export type { ConnectionStatusProps, ConnectionStatusBadgeProps } from './ConnectionStatus';

export {
  DashboardSkeleton,
  SenderDashboardSkeleton,
  CourierDashboardSkeleton,
  AdminDashboardSkeleton,
  PackageDetailSkeleton,
  NotificationsSkeleton,
  MessagesSkeleton,
  ListSkeleton,
} from './PageSkeletons';
export { default as PageSkeletons } from './PageSkeletons';

// Animation components
export {
  AnimatedContainer,
  AnimatedList,
  PageTransition,
  FadeIn,
  SlideIn,
  ScaleIn,
  Pulse,
  HoverScale,
  HoverLift,
  Shimmer,
  CountUp,
  ProgressBar as AnimatedProgressBar,
  useRipple,
} from './Animations';
