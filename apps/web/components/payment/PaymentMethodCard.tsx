'use client'

import { PaymentMethod } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface PaymentMethodCardProps {
  paymentMethod: PaymentMethod
  onSetDefault?: (id: number) => void
  onDelete?: (id: number) => void
  isDeleting?: boolean
}

const CARD_ICONS: Record<string, string> = {
  visa: '/icons/visa.svg',
  mastercard: '/icons/mastercard.svg',
  amex: '/icons/amex.svg',
  discover: '/icons/discover.svg',
}

export function PaymentMethodCard({
  paymentMethod,
  onSetDefault,
  onDelete,
  isDeleting = false,
}: PaymentMethodCardProps) {
  const formatExpiry = () => {
    if (!paymentMethod.card_exp_month || !paymentMethod.card_exp_year) {
      return null
    }
    const month = String(paymentMethod.card_exp_month).padStart(2, '0')
    const year = String(paymentMethod.card_exp_year).slice(-2)
    return `${month}/${year}`
  }

  const getCardBrandDisplay = () => {
    const brand = paymentMethod.card_brand?.toLowerCase() || 'card'
    return brand.charAt(0).toUpperCase() + brand.slice(1)
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Card Icon */}
          <div className="w-12 h-8 bg-surface-100 rounded flex items-center justify-center">
            {paymentMethod.card_brand ? (
              <span className="text-xs font-semibold text-surface-600 uppercase">
                {paymentMethod.card_brand.slice(0, 4)}
              </span>
            ) : (
              <svg
                className="w-6 h-6 text-surface-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            )}
          </div>

          {/* Card Details */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {getCardBrandDisplay()} ****{paymentMethod.card_last_four}
              </span>
              {paymentMethod.is_default && (
                <Badge variant="primary" size="sm">
                  Default
                </Badge>
              )}
            </div>
            {formatExpiry() && (
              <p className="text-sm text-surface-500">
                Expires {formatExpiry()}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {!paymentMethod.is_default && onSetDefault && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetDefault(paymentMethod.id)}
            >
              Set Default
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(paymentMethod.id)}
              disabled={isDeleting}
              className="text-error-600 hover:text-error-700"
            >
              {isDeleting ? 'Removing...' : 'Remove'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
