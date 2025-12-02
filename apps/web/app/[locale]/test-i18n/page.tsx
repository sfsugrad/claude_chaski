import { useTranslations } from 'next-intl';
import { Card, CardBody } from '@/components/ui';

export default function TestI18nPage() {
  const t = useTranslations();

  return (
    <main className="min-h-screen bg-surface-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-surface-900 mb-8">
          {t('common.welcome')}
        </h1>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Common Translations */}
          <Card>
            <CardBody>
              <h2 className="text-xl font-semibold mb-4 text-primary-600">
                {t('common.details')}
              </h2>
              <div className="space-y-2">
                <p>
                  <strong>{t('common.name')}:</strong> Test User
                </p>
                <p>
                  <strong>{t('common.email')}:</strong> test@example.com
                </p>
                <p>
                  <strong>{t('common.phone')}:</strong> +1234567890
                </p>
                <p>
                  <strong>{t('common.status')}:</strong> {t('status.in_transit')}
                </p>
              </div>
            </CardBody>
          </Card>

          {/* Navigation */}
          <Card>
            <CardBody>
              <h2 className="text-xl font-semibold mb-4 text-secondary-600">
                {t('nav.home')}
              </h2>
              <ul className="space-y-2">
                <li>• {t('nav.dashboard')}</li>
                <li>• {t('nav.packages')}</li>
                <li>• {t('nav.messages')}</li>
                <li>• {t('nav.notifications')}</li>
                <li>• {t('nav.profile')}</li>
              </ul>
            </CardBody>
          </Card>

          {/* Auth */}
          <Card>
            <CardBody>
              <h2 className="text-xl font-semibold mb-4 text-success-600">
                {t('auth.login')}
              </h2>
              <div className="space-y-2">
                <p>• {t('auth.email')}</p>
                <p>• {t('auth.password')}</p>
                <p>• {t('auth.firstName')}</p>
                <p>• {t('auth.lastName')}</p>
                <p>• {t('auth.role')}: {t('auth.sender')} / {t('auth.courier')}</p>
              </div>
            </CardBody>
          </Card>

          {/* Package Status */}
          <Card>
            <CardBody>
              <h2 className="text-xl font-semibold mb-4 text-warning-600">
                {t('packages.title')}
              </h2>
              <ul className="space-y-2">
                <li>• {t('status.new')}</li>
                <li>• {t('status.open_for_bids')}</li>
                <li>• {t('status.bid_selected')}</li>
                <li>• {t('status.pending_pickup')}</li>
                <li>• {t('status.in_transit')}</li>
                <li>• {t('status.delivered')}</li>
              </ul>
            </CardBody>
          </Card>

          {/* Actions */}
          <Card className="md:col-span-2">
            <CardBody>
              <h2 className="text-xl font-semibold mb-4">
                {t('common.actions')}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary">
                  {t('common.save')}
                </button>
                <button className="btn-secondary">
                  {t('common.cancel')}
                </button>
                <button className="btn-ghost">
                  {t('common.edit')}
                </button>
                <button className="btn-danger">
                  {t('common.delete')}
                </button>
              </div>
            </CardBody>
          </Card>

          {/* Validation Messages */}
          <Card className="md:col-span-2">
            <CardBody>
              <h2 className="text-xl font-semibold mb-4 text-error-600">
                {t('errors.somethingWentWrong')}
              </h2>
              <div className="space-y-1 text-sm">
                <p className="text-error-600">• {t('errors.required')}</p>
                <p className="text-error-600">• {t('errors.invalidEmail')}</p>
                <p className="text-error-600">• {t('errors.passwordTooShort')}</p>
                <p className="text-error-600">• {t('errors.networkError')}</p>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="mt-8 p-6 bg-primary-50 border border-primary-200 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 text-primary-900">
            ✅ i18n Setup Complete!
          </h3>
          <p className="text-surface-700">
            Use the language selector in the navbar to switch between English, French, and Spanish.
            All the text on this page will update automatically!
          </p>
        </div>
      </div>
    </main>
  );
}
