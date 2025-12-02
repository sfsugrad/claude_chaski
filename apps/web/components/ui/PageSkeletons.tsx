'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Skeleton, SkeletonText, SkeletonCard, SkeletonAvatar } from './Skeleton';
import { Card, CardBody, CardHeader } from './Card';

// Reusable skeleton patterns
function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div className={clsx('bg-white rounded-xl border border-surface-200 p-5', className)}>
      <div className="flex items-center gap-4">
        <Skeleton variant="rounded" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="40%" height={14} />
          <Skeleton variant="text" width="60%" height={24} />
        </div>
      </div>
    </div>
  );
}

function SkeletonPackageCard({ className }: { className?: string }) {
  return (
    <div className={clsx('bg-white rounded-xl border border-surface-200 overflow-hidden', className)}>
      {/* Status progress bar */}
      <div className="bg-surface-50 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <Skeleton variant="circular" width={32} height={32} />
                <Skeleton variant="text" width={40} height={12} className="mt-1" />
              </div>
              {i < 5 && <Skeleton variant="rectangular" className="flex-1 h-1 mx-2" />}
            </div>
          ))}
        </div>
      </div>
      {/* Content */}
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton variant="rounded" width={80} height={24} />
          <Skeleton variant="text" width={100} height={16} />
        </div>
        <Skeleton variant="text" width="70%" height={20} />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <Skeleton variant="circular" width={24} height={24} />
            <div className="flex-1 space-y-1">
              <Skeleton variant="text" width={60} height={12} />
              <Skeleton variant="text" width="90%" height={14} />
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Skeleton variant="circular" width={24} height={24} />
            <div className="flex-1 space-y-1">
              <Skeleton variant="text" width={60} height={12} />
              <Skeleton variant="text" width="90%" height={14} />
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <Skeleton variant="text" width={80} height={16} />
          <Skeleton variant="text" width={60} height={16} />
          <Skeleton variant="text" width={100} height={16} />
        </div>
      </div>
    </div>
  );
}

function SkeletonActionCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardBody>
        <div className="flex items-start gap-4">
          <Skeleton variant="rounded" width={56} height={56} />
          <div className="flex-1 space-y-3">
            <Skeleton variant="text" width="50%" height={20} />
            <Skeleton variant="text" width="80%" height={14} />
            <Skeleton variant="rounded" width={120} height={32} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// Dashboard Page Skeleton
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Navbar placeholder */}
      <div className="bg-white border-b border-surface-200 h-16" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 space-y-2">
          <Skeleton variant="text" width={300} height={32} />
          <Skeleton variant="text" width={250} height={16} />
        </div>

        {/* User Info Card */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton variant="text" width={140} height={20} />
              <Skeleton variant="rounded" width={60} height={24} />
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-surface-100 last:border-0">
                <Skeleton variant="circular" width={20} height={20} />
                <div className="flex-1 space-y-1">
                  <Skeleton variant="text" width={80} height={12} />
                  <Skeleton variant="text" width={150} height={14} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Quick Actions */}
        <Skeleton variant="text" width={120} height={20} className="mb-4" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonActionCard />
          <SkeletonActionCard />
          <SkeletonActionCard />
        </div>
      </div>
    </div>
  );
}

// Sender Dashboard Skeleton
export function SenderDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Navbar placeholder */}
      <div className="bg-white border-b border-surface-200 h-16" />

      {/* Page Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <Skeleton variant="text" width={200} height={32} />
              <Skeleton variant="text" width={250} height={16} />
            </div>
            <Skeleton variant="rounded" width={140} height={44} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-4 rounded-lg border-2 border-surface-200 bg-white">
              <Skeleton variant="text" width="50%" height={28} />
              <Skeleton variant="text" width="70%" height={14} className="mt-1" />
            </div>
          ))}
        </div>

        {/* Package List */}
        <div className="space-y-4">
          <SkeletonPackageCard />
          <SkeletonPackageCard />
          <SkeletonPackageCard />
        </div>
      </div>
    </div>
  );
}

// Courier Dashboard Skeleton
export function CourierDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Navbar placeholder */}
      <div className="bg-white border-b border-surface-200 h-16" />

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <Skeleton variant="text" width={220} height={32} />
              <Skeleton variant="text" width={300} height={16} />
            </div>
            <Skeleton variant="rounded" width={150} height={44} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Active Route Card */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton variant="text" width={120} height={20} />
              <Skeleton variant="rounded" width={100} height={28} />
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Skeleton variant="circular" width={32} height={32} />
                  <div className="flex-1 space-y-1">
                    <Skeleton variant="text" width={80} height={12} />
                    <Skeleton variant="text" width="90%" height={16} />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Skeleton variant="circular" width={32} height={32} />
                  <div className="flex-1 space-y-1">
                    <Skeleton variant="text" width={80} height={12} />
                    <Skeleton variant="text" width="85%" height={16} />
                  </div>
                </div>
              </div>
              <Skeleton variant="rounded" height={200} className="w-full" />
            </div>
          </CardBody>
        </Card>

        {/* Matching Packages */}
        <Skeleton variant="text" width={180} height={24} className="mb-4" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardBody className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton variant="text" width="60%" height={18} />
                  <Skeleton variant="rounded" width={60} height={24} />
                </div>
                <div className="space-y-2">
                  <Skeleton variant="text" width="90%" height={14} />
                  <Skeleton variant="text" width="80%" height={14} />
                </div>
                <div className="flex gap-2">
                  <Skeleton variant="rounded" width={60} height={24} />
                  <Skeleton variant="rounded" width={50} height={24} />
                </div>
                <Skeleton variant="rounded" width="100%" height={36} />
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// Admin Dashboard Skeleton
export function AdminDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Navbar placeholder */}
      <div className="bg-white border-b border-surface-200 h-16" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 space-y-2">
          <Skeleton variant="text" width={200} height={32} />
          <Skeleton variant="text" width={300} height={16} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <Skeleton variant="text" width={140} height={18} />
            </CardHeader>
            <CardBody>
              <Skeleton variant="rounded" height={200} className="w-full" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton variant="text" width={140} height={18} />
            </CardHeader>
            <CardBody>
              <Skeleton variant="rounded" height={200} className="w-full" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton variant="text" width={140} height={18} />
            </CardHeader>
            <CardBody>
              <Skeleton variant="rounded" height={200} className="w-full" />
            </CardBody>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Skeleton variant="rounded" width={80} height={36} />
          <Skeleton variant="rounded" width={80} height={36} />
          <Skeleton variant="rounded" width={100} height={36} />
        </div>

        {/* Table */}
        <Card>
          <CardBody>
            <div className="space-y-4">
              {/* Header row */}
              <div className="flex gap-4 pb-3 border-b border-surface-200">
                <Skeleton variant="text" className="flex-1" height={14} />
                <Skeleton variant="text" className="flex-1" height={14} />
                <Skeleton variant="text" className="flex-1" height={14} />
                <Skeleton variant="text" width={80} height={14} />
              </div>
              {/* Data rows */}
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-4 py-3 items-center">
                  <div className="flex-1 flex items-center gap-2">
                    <SkeletonAvatar size="sm" />
                    <Skeleton variant="text" width="70%" height={14} />
                  </div>
                  <Skeleton variant="text" className="flex-1" height={14} />
                  <div className="flex-1">
                    <Skeleton variant="rounded" width={70} height={22} />
                  </div>
                  <Skeleton variant="text" width={80} height={14} />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// Package Detail Skeleton
export function PackageDetailSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Navbar placeholder */}
      <div className="bg-white border-b border-surface-200 h-16" />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Skeleton variant="text" width={100} height={16} className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <Skeleton variant="text" width={200} height={28} />
            <div className="flex gap-2">
              <Skeleton variant="rounded" width={80} height={24} />
              <Skeleton variant="text" width={100} height={20} />
            </div>
          </div>
          <Skeleton variant="rounded" width={120} height={36} />
        </div>

        {/* Map */}
        <Card className="mb-6">
          <CardBody>
            <Skeleton variant="rounded" height={350} className="w-full" />
          </CardBody>
        </Card>

        {/* Details Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <Skeleton variant="text" width={100} height={18} />
            </CardHeader>
            <CardBody className="space-y-3">
              <Skeleton variant="text" width="90%" height={14} />
              <Skeleton variant="text" width="70%" height={14} />
              <Skeleton variant="text" width="80%" height={14} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton variant="text" width={100} height={18} />
            </CardHeader>
            <CardBody className="space-y-3">
              <Skeleton variant="text" width="90%" height={14} />
              <Skeleton variant="text" width="70%" height={14} />
              <Skeleton variant="text" width="80%" height={14} />
            </CardBody>
          </Card>
        </div>

        {/* Package Info */}
        <Card>
          <CardHeader>
            <Skeleton variant="text" width={140} height={18} />
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-1">
                  <Skeleton variant="text" width={60} height={12} />
                  <Skeleton variant="text" width={80} height={16} />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// Notifications Page Skeleton
export function NotificationsSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Navbar placeholder */}
      <div className="bg-white border-b border-surface-200 h-16" />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton variant="text" width={160} height={28} />
          <Skeleton variant="rounded" width={120} height={36} />
        </div>

        {/* Notifications List */}
        <Card>
          <CardBody className="p-0 divide-y divide-surface-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-4 p-4">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="text" width="90%" height={16} />
                  <Skeleton variant="text" width="60%" height={14} />
                  <Skeleton variant="text" width={100} height={12} />
                </div>
                <Skeleton variant="circular" width={8} height={8} />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// Messages Page Skeleton
export function MessagesSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Navbar placeholder */}
      <div className="bg-white border-b border-surface-200 h-16" />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <Skeleton variant="text" width={140} height={28} className="mb-6" />

        <div className="grid md:grid-cols-3 gap-6">
          {/* Conversation List */}
          <Card className="md:col-span-1">
            <CardBody className="p-0 divide-y divide-surface-100">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <SkeletonAvatar />
                  <div className="flex-1 space-y-1">
                    <Skeleton variant="text" width="70%" height={14} />
                    <Skeleton variant="text" width="90%" height={12} />
                  </div>
                  <Skeleton variant="text" width={40} height={10} />
                </div>
              ))}
            </CardBody>
          </Card>

          {/* Chat Area */}
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <SkeletonAvatar />
                <div className="space-y-1">
                  <Skeleton variant="text" width={120} height={16} />
                  <Skeleton variant="text" width={80} height={12} />
                </div>
              </div>
            </CardHeader>
            <CardBody className="min-h-[400px] space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                  <Skeleton
                    variant="rounded"
                    width={i % 2 === 0 ? 200 : 250}
                    height={60}
                  />
                </div>
              ))}
            </CardBody>
            <div className="p-4 border-t border-surface-200">
              <div className="flex gap-2">
                <Skeleton variant="rounded" className="flex-1" height={40} />
                <Skeleton variant="rounded" width={80} height={40} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Generic list skeleton for smaller components
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-surface-200">
          <SkeletonAvatar size="sm" />
          <div className="flex-1 space-y-1">
            <Skeleton variant="text" width="60%" height={14} />
            <Skeleton variant="text" width="40%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default {
  Dashboard: DashboardSkeleton,
  SenderDashboard: SenderDashboardSkeleton,
  CourierDashboard: CourierDashboardSkeleton,
  AdminDashboard: AdminDashboardSkeleton,
  PackageDetail: PackageDetailSkeleton,
  Notifications: NotificationsSkeleton,
  Messages: MessagesSkeleton,
  List: ListSkeleton,
};
