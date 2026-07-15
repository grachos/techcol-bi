import { useTranslation } from 'react-i18next'
import { ContentSection } from '../components/content-section'
import { AppearanceForm } from './appearance-form'

export function SettingsAppearance() {
  const { t } = useTranslation()
  return (
    <ContentSection
      title={t('Appearance')}
      desc={t(
        'Customize the appearance of the app. Automatically switch between day and night themes.'
      )}
    >
      <AppearanceForm />
    </ContentSection>
  )
}
